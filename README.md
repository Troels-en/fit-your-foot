# Fitly

> **Status & ownership.** Built with Claude Code; the concept and majority of the build are mine, alongside teammates Simon and Johannes. Live demo below. The two-photo measurement path is wired end-to-end; full photogrammetry mesh reconstruction and the KIRI integration are Phase-3 WIP (the KIRI client is an explicit stub). Scan-accuracy validation is a documented methodology (Brannock + caliper ground truth, ArUco scale, ±3–5mm target), not yet a produced result. I owned product scope, scan UX, and the measurement-pipeline architecture.

**Find shoes that actually fit.** Scan your foot with your phone and get a personalized fit score for every shoe in the catalog.

Live demo: **https://my-shoe-fit.lovable.app**

Fitly turns a few phone photos into a 3D foot profile — a printed ArUco scale mat keeps the measurements metric — then scores how well each shoe in the catalog fits *that specific foot*, surfaced through a 3D visualization and a guided chat.

## How it works

1. **Capture** — guided in-browser foot capture (two-photo quick mode and full photogrammetry mode) over a printed ArUco mat for metric scale
2. **Reconstruct** — a Modal-hosted Python pipeline estimates a 3D foot mesh and key measurements from the photos
3. **Match** — a fit engine scores catalog shoes against the foot profile
4. **Explore** — 3D foot/shoe visualization (Three.js) plus a chat that explains the fit

## Stack

- **Frontend:** TypeScript, React, Vite, Tailwind, shadcn/ui, Three.js (`@react-three/fiber` + `drei`)
- **Backend:** Supabase (Postgres, Edge Functions), Modal (Python photogrammetry/measurement compute)
- **Tests:** Vitest

The scan-accuracy validation methodology (Brannock + caliper ground truth, ArUco scale reference, ±3–5mm target, statistical pass gates) is documented in `EMPIRICAL-VALIDATION-2026Q2.md`.

## Credits

Concept and majority of the build mine. Built with Simon and Johannes.

## Local setup

Frontend only — the Modal photogrammetry backend runs in the cloud and is not part of local dev.

```bash
cp .env.example .env   # fill in Supabase + backend URLs
bun install
bun run dev
```
