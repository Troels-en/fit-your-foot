# Running-Shoe Matching Algorithm (v2)

Geometrischer Multi-Kriterien-Matcher: Fußmaße aus `scans` werden gegen Schuh-Leistenmaße aus `shoes` gematcht und liefern einen **Fit-Score (0–100)**, eine **Kategorie** (`great` / `ok` / `poor`) sowie **erklärbare Gründe** und Aktionsflags (`needsBigger`, `needsWider`, …).

## Warum v2

`src/lib/matchDb.ts` (v1) bewertet nur Ballenbreite, Fersenbreite, Toebox-Form und Width-Grade. Es **fehlt komplett**:

- **Längen-Allowance** (Zehraum, der Hauptgrund für Black-Toe-Nails und Returns)
- **Toebox-Breite/-Höhe** als numerische Maße (nur Form-Kategorie)
- **Stack/Drop** vs. Läufertyp
- **Retour-Rate** als Outcome-Signal
- **Runner-Profil** (Casual / Daily / Long / Trail / Racing) mit unterschiedlichen Längen-Bedarfen

v2 nutzt **alle** in der Supabase-Tabelle `shoes` verfügbaren Dimensionen und ist parametrisiert nach Läufertyp + Fit-Präferenz.

## Folder-Struktur

```
src/lib/matching/
├── README.md            ← dieses Dokument
├── research/
│   ├── competitors.md   ← RunRepeat, Volumental, Safesize, StrutFit, etc.
│   ├── fit-science.md   ← Toe-Allowance, Mondopoint, Width-Girth, Swelling
│   └── sources.md       ← URLs (Bibliographie)
├── spec/
│   ├── algorithm.md     ← Mathematische Spezifikation
│   ├── dimensions.md    ← Mapping DB-Spalte → Algorithmus-Verwendung
│   └── tolerances.md    ← Tolerance-Tabellen mit Quellenangaben
├── types.ts
├── constants.ts
├── scorers.ts           ← per-Dimension Scoring-Funktionen (pure)
├── matcher.ts           ← Aggregator + ranker
├── index.ts             ← public API
└── matcher.test.ts      ← Vitest-Tests (≥ 95 % Branch-Coverage)
```

## Public API

```ts
import { scoreShoe, rankShoes, type FootProfile, type FitResult } from "@/lib/matching";

const foot: FootProfile = {
  foot_length_mm: 268,
  ball_width_mm: 102,
  heel_width_mm: 67,
  arch_type: "medium",
  runner_type: "daily",       // optional, default "daily"
  fit_preference: "regular",  // optional, default "regular"
};

const result = scoreShoe(foot, shoe);
// → { score: 87, band: "great", reasons: [...], flags: { needsWider: false, ... } }

const top3 = rankShoes(foot, allShoes, { excludeId: shoe.id, limit: 3 });
```

## Migration von v1

`src/lib/matchDb.ts` bleibt bestehen. Wenn v2 produktiv geht:

1. In `FitlyWidget.tsx` und `FitVisualization3D.tsx` Import auf `@/lib/matching` umstellen.
2. `FootMm` → `FootProfile` (Felder kompatibel, plus `runner_type`/`fit_preference`).
3. `MatchScore.label` ist v2 immer en-DE (z. B. „Passt sehr gut").
4. v1-File deprecaten oder löschen, sobald Frontend migriert.

## Test & Lint

```bash
bun run test src/lib/matching         # Vitest
bun run lint                           # ESLint
```
