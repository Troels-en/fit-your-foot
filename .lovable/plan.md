# Fitly: From Demo to Validated Fit Engine (Research-First, No Affiliate)

## Reframe

We are **not** competing with RunRepeat and **not** monetizing their data. The public site exists to:

1. Show the matching algorithm working on a real catalog (RunRepeat-sourced geometry, attributed, non-commercial).
2. Collect anonymous scan + feedback data to **validate and tune** the algorithm and the photogrammetry pipeline.
3. Serve as a credible live demo when approaching B2B retailers and brands — "here is the engine, here are the accuracy numbers, here is what integration looks like".

Affiliate / shop links stay out. Each shoe page links out to the brand's own page (or RunRepeat as the data source) for reference only, with a clear data-attribution footer.

---

## Phase 1 — Public catalog + fit profile (the demo becomes a site)

Goal: a visitor lands on `fitly.app`, sees the catalog, can scan their feet once, and then browses any shoe with a personalized fit score.

Routes to add:

```text
/                    Home — what Fitly is, "Scan your feet" CTA, attribution
/shoes               Catalog (51 shoes, brand/category filters, sort by fit if profile exists)
/shoes/:slug         Shoe detail — geometry, fit score (if profile), 3 alternatives, link to brand site + RunRepeat source
/scan                Entry point: desktop shows QR, mobile starts scan flow directly
/profile             Current fit profile (foot mm, last scan date, "rescan" button, "delete my data")
/about               How it works, data sources, privacy, non-commercial use statement
```

Replace `Index.tsx` (currently redirects to one Keller product) with a real homepage. Keep `/produkt/:slug` as a separate "retailer demo" route used only for B2B pitch sessions.

Fit profile is stored client-side (localStorage) keyed by an anonymous `profile_id`, plus mirrored into `scans` so we can analyze in aggregate. Visitor can wipe it from `/profile`.

## Phase 2 — Data model cleanup

`shoes` table additions:

- `data_source` (text, e.g. `"runrepeat"`, `"manual"`, `"brand_spec"`)
- `source_url` (text, link back to the originating RunRepeat page)
- `geometry_confidence` (`"measured" | "estimated" | "spec"`)
- `brand_url` (text, official product page on brand site — replaces `shop_url` semantically)
- Keep `image_url` as-is (already fixed via Keller CDN migration).

New `feedback` table for algorithm validation:

```text
feedback(
  id uuid pk,
  scan_id uuid references scans(id),
  shoe_id uuid references shoes(id),
  predicted_score int,            -- what we said
  user_rating smallint,           -- 1-5: actual perceived fit
  owns_shoe boolean,              -- did they actually try it?
  notes text,
  created_at timestamptz
)
```

RLS: insert open to authenticated session-token holders only (same pattern as `scans`); select restricted.

## Phase 3 — Algorithm validation harness

Currently `src/lib/matchDb.ts` is hand-tuned with magic weights (0.3 / 0.15 / 0.25 / 0.05 / 0.25). We need a way to know whether changing them makes things better or worse.

Build a small evaluation script (`scripts/eval-matcher.ts`) that:

1. Loads all `feedback` rows joined with foot measurements + shoe geometry.
2. Runs the current `scoreShoe()` against each.
3. Reports MAE between predicted score and `user_rating * 20`, plus a confusion matrix for the `great / ok / poor` bands.
4. Optional: a tiny grid search over weights to find a better config.

This is the artifact we show in B2B meetings: "here is our backtest accuracy on N real users".

A `/internal/metrics` page (admin role only, using the existing `user_roles` pattern) renders the same numbers live.

## Phase 4 — Photogrammetry validation protocol

Independent of the website work. Document exists in `modal/`. We need:

1. A reference dataset: 20–50 feet measured with calipers + scanned with the Modal pipeline.
2. A notebook in `modal/eval/` reporting per-measurement error (length, ball width, heel width, arch).
3. Targets: length ±3 mm, ball/heel width ±4 mm, arch class ≥85% accuracy.
4. Publish the methodology + results page at `/about/accuracy` once we have numbers.

Out of scope for this codebase change — but the website needs the placeholder page so we can fill it in.

## Phase 5 — B2B-ready polish

After Phases 1–3 land:

- A `/for-retailers` page describing the widget integration (the `/produkt/:slug` flow is the live demo).
- A `/for-brands` page describing the data API (geometry-in, fit-prediction-out).
- A "Request pilot" form that drops into a `leads` table.

No pricing, no Stripe — this is a pre-revenue lead-gen surface.

---

## What ships in the first sprint (concretely)

1. New `Home`, `Catalog`, `ShoeDetail`, `Profile`, `About` pages + routing.
2. Move the current Vaporfly product page logic into a shared `<FitProductView>` component used by both `/shoes/:slug` and `/produkt/:slug`.
3. `data_source`, `source_url`, `geometry_confidence`, `brand_url` columns on `shoes` (migration + backfill `data_source='runrepeat'` for the existing 51 rows).
4. `feedback` table + RLS + a "Was this fit prediction accurate?" widget on `ShoeDetail` after a scan.
5. Footer with RunRepeat attribution and non-commercial-use statement on every page.
6. Replace the homepage redirect in `src/pages/Index.tsx`.

Phases 2-final, the eval harness, and the photogrammetry validation are follow-up sprints.

---

## Technical notes

- Keep the existing Supabase schema; only additive migrations.
- Reuse `FitlyWidget`, `FitChat`, `FitVisualization3D`, `useSessionRealtime` — they are already route-agnostic.
- `matchDb.ts` stays as the single source of truth for scoring; the eval script imports it directly so production and backtest always agree.
- No new third-party deps required for Phase 1.
- Attribution: a small `<DataAttribution />` component in the footer, plus a per-shoe "Geometry source: RunRepeat" line on `ShoeDetail`.

## Open questions before we build

1. Should `/produkt/:slug` (the Keller-branded retailer demo) stay reachable in production, or be gated behind `?demo=keller` so the public site looks clean?
2. For `/profile`, do we want truly anonymous (localStorage only, no auth) or optional Supabase auth so users can sync across devices?
3. Do we want the `feedback` widget to ask only "rate this prediction" (1–5) or also "do you own this shoe?" + free-text — the latter is much more useful for tuning but has lower response rate.

Answer those and I'll start with the first sprint.
