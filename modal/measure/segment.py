"""Foot segmentation via Grounding-DINO + SAM2.

Strategy:
1. Grounding-DINO zero-shot object detection with prompt "a foot.". Returns
   bounding boxes with scores. Works on bare feet, socked feet, and shoes.
2. Pick the highest-scoring foot box.
3. SAM2 (Hiera Base Plus) takes the box as a prompt and returns a
   pixel-accurate binary mask.

Both models are cached inside the Modal image at build time (see
`download_models` in `modal/app.py`), so runtime import is instant;
first GPU inference adds ~0.5s for model→GPU transfer.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np

from .models import PhotoView


class FootNotFoundError(Exception):
    pass


GROUNDING_DINO_MODEL = "IDEA-Research/grounding-dino-tiny"
SAM2_MODEL = "facebook/sam2.1-hiera-base-plus"
FOOT_PROMPT = "a foot."
# Grounding-DINO returns a lot of weak boxes; keep the threshold low enough
# that a socked foot still passes but high enough to reject noise.
DINO_BOX_THRESHOLD = 0.25
DINO_TEXT_THRESHOLD = 0.20


@lru_cache(maxsize=1)
def _device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


@lru_cache(maxsize=1)
def _dino():
    import torch
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

    device = _device()
    processor = AutoProcessor.from_pretrained(GROUNDING_DINO_MODEL)
    model = (
        AutoModelForZeroShotObjectDetection.from_pretrained(GROUNDING_DINO_MODEL)
        .to(device)
        .eval()
    )
    return processor, model


@lru_cache(maxsize=1)
def _sam2():
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    return SAM2ImagePredictor.from_pretrained(SAM2_MODEL, device=_device())


def segment_foot(image: np.ndarray, view: PhotoView) -> np.ndarray:
    """Return a uint8 HxW binary mask (0 or 255) of the foot."""
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("expected HxWx3 RGB image")

    import torch
    from PIL import Image

    pil = Image.fromarray(image)
    processor, model = _dino()

    inputs = processor(images=pil, text=FOOT_PROMPT, return_tensors="pt").to(_device())
    with torch.no_grad():
        outputs = model(**inputs)

    results = processor.post_process_grounded_object_detection(
        outputs,
        inputs.input_ids,
        box_threshold=DINO_BOX_THRESHOLD,
        text_threshold=DINO_TEXT_THRESHOLD,
        target_sizes=[pil.size[::-1]],
    )[0]

    boxes = results["boxes"]
    if len(boxes) == 0:
        raise FootNotFoundError(f"foot_not_detected_{view}")

    scores = results["scores"]
    best_idx = int(scores.argmax())
    box_xyxy = boxes[best_idx].detach().cpu().numpy()

    predictor = _sam2()
    predictor.set_image(image)
    masks, _sam_scores, _logits = predictor.predict(
        box=box_xyxy[None, :],
        multimask_output=False,
    )
    mask_bool = masks[0].astype(bool) if masks.ndim == 3 else masks.astype(bool)
    return (mask_bool.astype(np.uint8) * 255)


def mask_touches_border(mask: np.ndarray, margin: int = 2) -> bool:
    h, w = mask.shape[:2]
    return bool(
        mask[:margin, :].any()
        or mask[h - margin:, :].any()
        or mask[:, :margin].any()
        or mask[:, w - margin:].any()
    )
