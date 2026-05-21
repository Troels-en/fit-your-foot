# Fitly

**Find shoes that actually fit.** Scan your foot with your phone and get a personalized fit score for every shoe in the catalog.

Live demo: **https://my-shoe-fit.lovable.app**

Fitly turns a few phone photos into a 3D model of your foot, then scores how well each shoe in a catalog fits *that specific foot* — surfaced through a 3D visualization and a guided chat.

## How it works

1. **Capture** — guided in-browser foot capture (two-photo and full photogrammetry modes)
2. **Reconstruct** — a Modal-hosted Python pipeline turns the photos into a 3D foot mesh and measurements
3. **Match** — a fit engine scores catalog shoes against the foot profile
4. **Explore** — 3D foot/shoe visualization (Three.js) plus a chat that explains the fit

## Stack

- **Frontend:** TypeScript, React, Vite, Tailwind, shadcn/ui, Three.js (`@react-three/fiber` + `drei`)
- **Backend:** Supabase (Postgres, 21 migrations, Edge Functions), Modal (Python photogrammetry/measurement compute)
- **Tests:** Vitest

See `EMPIRICAL-VALIDATION-2026Q2.md` for scan-accuracy validation.

## Credits

Concept and majority of the build mine. Built with Simon and Johannes.

## Local setup

```bash
cp .env.example .env   # fill in Supabase + backend URLs
bun install
bun run dev
```
