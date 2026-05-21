// Simple shared-password gate for /pitch and /produkt/:slug?demo=keller.
// NOT meant as real security — just to keep the public site uncluttered for visitors
// while we share these views with investors / pilot retailers via direct link.
//
// Password: stored in localStorage after first successful unlock (persists across sessions).

const KEY = "fitly.gate.unlocked";
const PASSWORD = "demo_fitly";

export function isGateUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1";
}

export function unlockGate(input: string): boolean {
  if (input.trim() === PASSWORD) {
    if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}

export function lockGate(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  }
}
