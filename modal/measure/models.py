"""Pydantic models shared between the FastAPI layer and the measurement core."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

ArchType = Literal["low", "medium", "high"]
Confidence = Literal["low", "medium", "high"]
PhotoView = Literal["top", "side"]


class Measurements(BaseModel):
    foot_length_mm: float = Field(ge=50, le=500)
    foot_width_mm: float = Field(ge=20, le=300)
    ball_width_mm: float = Field(ge=20, le=300)
    heel_width_mm: float = Field(ge=20, le=300)
    arch_type: ArchType
    arch_height_mm: Optional[float] = Field(default=None, ge=0, le=80)
    instep_height_mm: Optional[float] = Field(default=None, ge=0, le=120)
    eu_size: int = Field(ge=15, le=55)
    confidence: Confidence


class MeasureResponse(BaseModel):
    ok: bool
    measurements: Measurements
    warnings: list[str] = []


class ValidationResult(BaseModel):
    ok: bool
    issues: list[str] = []
