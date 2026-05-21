// Persistent foot profile for the public Fitly site.
// Stored in localStorage so a visitor can browse /shoes after one scan and
// keep seeing personalised fit scores across sessions.
//
// When a user is logged in, the latest scan in the `scans` table is the source
// of truth — see `useFitProfile` which prefers DB → localStorage in that order.

import type { FootMm } from "@/lib/matchDb";

const KEY = "fitly.profile.v1";

export type StoredProfile = FootMm & {
  scan_id?: string;
  client_token?: string;
  updated_at: string; // ISO
};

export function loadProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    if (!parsed.foot_length_mm || !parsed.ball_width_mm) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(p: Omit<StoredProfile, "updated_at">): void {
  if (typeof window === "undefined") return;
  const payload: StoredProfile = { ...p, updated_at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
