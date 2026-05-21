/**
 * User-Feedback Helpers für den Capture-Flow:
 *  - Web Speech API (TTS, gratis, in-browser, kein API-Cost)
 *  - Vibration API (Haptics, gratis, mobile-only)
 *
 * Beide werden Fire-and-Forget benutzt — wenn API nicht supportet (Desktop
 * Firefox ohne Speech, iOS ohne Vibration), no-op statt crash.
 *
 * Speech-Throttle: zwei Calls innerhalb 1500ms cancelled die alte Utterance
 * damit User nicht in einer queue von Anweisungen ertränkt wird.
 */

let lastSpeak = 0;
const SPEECH_MIN_INTERVAL_MS = 1500;

let speechEnabled = true;
let hapticsEnabled = true;

export function setSpeechEnabled(enabled: boolean) {
  speechEnabled = enabled;
  if (!enabled && typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Spricht einen kurzen Hint per TTS. Throttled auf SPEECH_MIN_INTERVAL_MS
 * damit nicht jeder Ticker eine neue Utterance triggert. Wenn neuer Call
 * innerhalb der Cooldown kommt, wird die laufende abgebrochen und ersetzt
 * (→ User hört IMMER die jeweils neueste relevante Anweisung).
 */
export function speak(text: string, opts?: { force?: boolean; lang?: string }) {
  if (!speechEnabled) return;
  if (!isSpeechSupported()) return;
  const now = Date.now();
  if (!opts?.force && now - lastSpeak < SPEECH_MIN_INTERVAL_MS) return;
  lastSpeak = now;
  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = opts?.lang ?? "de-DE";
    utt.rate = 1.05;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  } catch (err) {
    console.warn("speech failed", err);
  }
}

/**
 * Vibration mit pattern. iOS Safari supportet Vibration NICHT, Android
 * Chrome ja. No-op wenn nicht da.
 */
export function vibrate(pattern: number | number[]) {
  if (!hapticsEnabled) return;
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch (err) {
    console.warn("vibrate failed", err);
  }
}

/** Bucket gefüllt → kurzer Tap. */
export function hapticBucketFilled() {
  vibrate(40);
}

/** Submit-ready erreicht → Pattern (zwei kurze Taps). */
export function hapticSubmitReady() {
  vibrate([60, 80, 60]);
}

/** Calibration done → ein langer Tap. */
export function hapticCalibrated() {
  vibrate(120);
}
