/**
 * Parametrized Voice-Hint-Strings für selectedFoot-Mirror end-to-end.
 *
 * Vorher: hardcoded strings in TwoPhotoCapture (e.g. "stell deinen Fuß"). Mit
 * selectedFoot=left würde "rechte Fuß" sagen — wrong-side Anweisung.
 *
 * Jetzt: getVoiceString(key, foot) → string mit korrekter Spiegelung.
 *
 * Tests: voiceStrings.test.ts garantiert dass jede Key non-empty deutsch
 * String für beide Foot-Varianten returnt.
 */

export type SelectedFoot = "left" | "right";

export type VoiceKey =
  | "phase-top-enter"
  | "phase-side-enter"
  | "phase-seated-prompt"
  | "phase-orientation-switch"
  | "phase-done"
  | "hint-phone-flat"
  | "hint-phone-tilted-side"
  | "hint-phone-rotate-landscape"
  | "hint-foot-bbox-edge"
  | "hint-marker-coverage"
  | "hint-heel-wand-gap"
  | "hint-foot-confidence"
  | "hint-side-yaw"
  | "hint-pnp-z-too-high"
  | "hint-pnp-z-too-low"
  | "hint-brightness-low"
  | "hint-brightness-high"
  | "hint-stillness"
  | "validation-error-retake-top"
  | "validation-error-retake-side"
  | "validation-error-ua-unknown";

const sideLabel = (f: SelectedFoot) => (f === "right" ? "rechten" : "linken");
const lateralDirection = (f: SelectedFoot) => (f === "right" ? "rechts" : "links");

const TEMPLATES: Record<VoiceKey, (foot: SelectedFoot) => string> = {
  // Phase-Transitions
  "phase-top-enter": (f) =>
    `Foto eins von oben. Stell deinen ${sideLabel(f)} Fuß auf das Blatt, Ferse an die Wand. Phone parallel zum Boden über dem Fuß.`,
  "phase-side-enter": (f) =>
    `Foto zwei von der Seite. Phone seitlich von ${lateralDirection(f)}, Camera horizontal Richtung Fuß.`,
  "phase-seated-prompt": () =>
    "Foto eins ist im Kasten. Setz dich jetzt hin, Fuß bleibt auf dem Blatt.",
  "phase-orientation-switch": () =>
    "Drehe das Phone seitlich für Foto zwei. Querformat.",
  "phase-done": () => "Scan erfolgreich. Maße werden berechnet.",

  // Live-Gate-Hints
  "hint-phone-flat": () => "Phone parallel zum Boden halten — wie ein Tablett.",
  "hint-phone-tilted-side": () => "Phone seitlich kippen, Camera Richtung Fuß.",
  "hint-phone-rotate-landscape": () =>
    "Phone seitlich drehen — querformat, Lade-Buchse an der Seite.",
  "hint-foot-bbox-edge": () => "Fuß ins Bild rücken — Phone weiter weg.",
  "hint-marker-coverage": () => "Phone weiter weg — alle Marker müssen sichtbar sein.",
  "hint-heel-wand-gap": () => "Ferse fest gegen die Wand drücken.",
  "hint-foot-confidence": () =>
    "Fuß teilweise verdeckt — Hosenbein hochkrempeln, Knöchel frei, Zehen sichtbar.",
  "hint-side-yaw": (f) =>
    `Phone gerade ausrichten, parallel zum Fuß — Camera von ${lateralDirection(f)} zur Mitte.`,
  "hint-pnp-z-too-high": () => "Phone tiefer halten — auf Knöchelhöhe.",
  "hint-pnp-z-too-low": () => "Phone etwas höher halten.",
  "hint-brightness-low": () => "Mehr Licht bitte.",
  "hint-brightness-high": () =>
    "Zu hell — direktes Sonnenlicht meiden, Schatten vermeiden.",
  "hint-stillness": () => "Halt das Phone ruhiger.",

  // Validation-Errors
  "validation-error-retake-top": (f) =>
    `Foto eins muss neu gemacht werden. Stell deinen ${sideLabel(f)} Fuß wieder auf das Blatt.`,
  "validation-error-retake-side": () =>
    "Foto zwei muss neu gemacht werden. Phone seitlich, Camera horizontal.",
  "validation-error-ua-unknown": () =>
    "Dein Phone-Modell wird im Quick-Scan nicht unterstützt. Bitte Premium-Scan verwenden.",
};

/**
 * Liefert deutschen Voice-String für gegebene Key + selectedFoot.
 *
 * Caller-Pattern:
 *   const voice = getVoiceString("phase-top-enter", selectedFoot);
 *   speak(voice, { force: true });
 */
export function getVoiceString(key: VoiceKey, foot: SelectedFoot): string {
  const template = TEMPLATES[key];
  if (!template) {
    // Defensive: should never happen weil VoiceKey union exhaustive
    return "";
  }
  return template(foot);
}

/**
 * Liefert ALLE Voice-Keys für test-coverage. Tests iterieren das + asserten
 * dass jeder key beide Foot-Varianten supportet.
 */
export const ALL_VOICE_KEYS: VoiceKey[] = Object.keys(TEMPLATES) as VoiceKey[];
