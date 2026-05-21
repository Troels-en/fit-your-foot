import { describe, expect, it } from "vitest";

import { ALL_VOICE_KEYS, getVoiceString } from "./voiceStrings";

describe("voiceStrings — selectedFoot-Mirror", () => {
  it("returns non-empty German string for every key + both feet", () => {
    for (const key of ALL_VOICE_KEYS) {
      const left = getVoiceString(key, "left");
      const right = getVoiceString(key, "right");
      expect(left.length, `key=${key} foot=left empty`).toBeGreaterThan(0);
      expect(right.length, `key=${key} foot=right empty`).toBeGreaterThan(0);
    }
  });

  it("foot-aware-keys produce different strings for left vs right", () => {
    const footAwareKeys = [
      "phase-top-enter",
      "phase-side-enter",
      "hint-side-yaw",
      "validation-error-retake-top",
    ] as const;
    for (const key of footAwareKeys) {
      const left = getVoiceString(key, "left");
      const right = getVoiceString(key, "right");
      expect(left, `${key} should differ between left/right`).not.toBe(right);
    }
  });

  it("foot-neutral-keys produce identical strings for both feet", () => {
    const neutralKeys = [
      "phase-orientation-switch",
      "phase-done",
      "hint-phone-flat",
      "hint-stillness",
    ] as const;
    for (const key of neutralKeys) {
      expect(getVoiceString(key, "left")).toBe(getVoiceString(key, "right"));
    }
  });

  it("phase-top-enter uses correct German foot-side for selectedFoot=right", () => {
    const r = getVoiceString("phase-top-enter", "right");
    expect(r).toContain("rechten Fuß");
    expect(r).not.toContain("linken Fuß");
  });

  it("phase-top-enter uses correct German foot-side for selectedFoot=left", () => {
    const l = getVoiceString("phase-top-enter", "left");
    expect(l).toContain("linken Fuß");
    expect(l).not.toContain("rechten Fuß");
  });

  it("phase-side-enter uses lateral-direction matching selectedFoot", () => {
    expect(getVoiceString("phase-side-enter", "right")).toContain("rechts");
    expect(getVoiceString("phase-side-enter", "left")).toContain("links");
  });
});
