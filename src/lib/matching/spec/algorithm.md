# Algorithmus-Spezifikation (v2)

## Pipeline

```
foot + shoe + (optional profile)
  │
  ├─▶ hardFilters()           ← drop wenn Größe nicht verfügbar
  │
  ├─▶ scoreLength()       30%
  ├─▶ scoreBallWidth()    25%
  ├─▶ scoreHeelFit()      15%
  ├─▶ scoreToebox()       10%
  ├─▶ scoreWidthGrade()    5%
  ├─▶ scoreArchSupport()   5%
  ├─▶ scoreDropStack()     5%   ← informativ
  ├─▶ scoreReturnSignal()  5%
  │
  ├─▶ aggregate()             ← Σ wᵢ · sᵢ , clamp [0,100]
  ├─▶ classifyBand()          ← great ≥80, ok ≥60, sonst poor
  └─▶ generateReasons()       ← Top-3 Subscores < 70 → German-language Reason
```

## Subscores (alle 0–100)

### 1. Length (30 %)

```
allowance = inner_length_mm − foot_length_mm

range = TARGET_ALLOWANCE[runner_type] ± fit_preference_offset
ideal = [range.min, range.max]

if allowance < ideal.min − 4:        score 0       (zu kurz, hartes Problem)
if allowance < ideal.min − 2:        score 30
if allowance < ideal.min:            score 70
if ideal.min ≤ allowance ≤ ideal.max: score 100    (perfekt)
if allowance > ideal.max + 3:        score 70
if allowance > ideal.max + 6:        score 40
if allowance > ideal.max + 10:       score 10      (zu lang)
```

Fallback: Wenn `inner_length_mm` fehlt → `outer_length_mm − 15` als Schätzung. Wenn auch das fehlt → score `50`, Reason „Schuh-Innenlänge unbekannt".

### 2. Ball Width (25 %)

```
shoe_ball = forefoot_width_mm ?? width_mm
delta     = shoe_ball − foot.ball_width_mm  (positiv = Schuh weiter)

target_min = 2 + fit_preference_width_offset   (z. B. snug → 1)
target_max = 5 + fit_preference_width_offset   (snug → 4)

if delta < −3:               score 10
if delta < 0:                score 40 + (delta+3)*10        // 40..70
if delta < target_min:       score 70 + (delta)*5            // 70..80
if target_min ≤ delta ≤ target_max:   score 100
if delta < target_max + 3:   score 80
if delta < target_max + 6:   score 60
else:                        score 40
```

### 3. Heel Fit (15 %)

```
delta = shoe.heel_width_mm − foot.heel_width_mm  (pos = Schuh weiter)

if delta < −3: score 30      // drückt
if −3 ≤ delta < 0: score 100 // snug
if 0 ≤ delta < 2: score 90
if 2 ≤ delta < 4: score 60   // beginnt zu rutschen
else:               score 25  // Heel-Slip
```

Fallback: Heel-Daten fehlen → score 75 (mild positiv, nicht ausschlaggebend).

### 4. Toebox (10 %)

Sub-Komponenten gemittelt:

```
T1: toebox_width vs forefoot_width
    ratio = toebox_width_mm / forefoot_width_mm
    if ratio ≥ 0.95:  100
    if ratio ≥ 0.90:   85
    if ratio ≥ 0.85:   65
    else:              35

T2: Form-Match (kategorisch)
    foot_is_wide = ball_width_mm ≥ 100
    toebox in {roomy, rounded, square}: 100
    toebox in {regular}: 80
    toebox in {tapered, pointy}:
        if foot_is_wide: 25 else 70

T3: Toebox-Höhe
    if toebox_height_mm ≥ 22: 100
    if toebox_height_mm ≥ 18:  80
    else:                      55
    Skip dieses Sub wenn arch_type !== "high".

score = avg([T1, T2, T3 falls vorhanden])
```

### 5. Width-Grade (5 %)

```
expected_grade = mapBallWidthToGrade(ball_width_mm, foot_length_mm)
shoe_grade     = parseGrade(shoe.width_grade)

gap = |gradeIndex(expected) − gradeIndex(shoe_grade)|

if gap == 0: 100
if gap == 1:  80
if gap == 2:  50
if gap >= 3:  20
```

`mapBallWidthToGrade` normalisiert `ball_width_mm` auf eine Referenzlänge von 268 mm (US M9):

```
normalized_width = ball_width_mm × (268 / foot_length_mm)
< 92:  Narrow
< 100: Regular
< 106: Wide
≥ 106: ExtraWide
```

### 6. Arch Support (5 %)

```
match table:
  low    × {motion-control, max, stability}: 100
  low    × {neutral, cushion}:                65
  medium × {neutral, stability}:              100
  medium × {motion-control, max, cushion}:    80
  high   × {neutral, cushion}:                100
  high   × {stability, motion-control, max}:  60
```

Fallback: Felder fehlen → score 80.

### 7. Drop & Stack (5 %)

Nur grobe Sanity, kein hartes Filter:

```
if heel_drop_mm in [4,12]: 100
if heel_drop_mm < 4 or > 14: 70
else:                          85
```

Profile-spezifisch nur Reason-Text (z. B. „13 mm Drop — eher Heel-Striker-Typ").

### 8. Return Signal (5 %)

```
if retour_rate_pct == null: 80
if retour_rate_pct < 5:     100
if retour_rate_pct < 10:     90
if retour_rate_pct < 15:     70
if retour_rate_pct < 25:     50
else:                        25
```

## Aggregation

```
total = Σᵢ wᵢ · sᵢ                  (Σwᵢ = 1.0)
total = clamp(round(total), 0, 100)

band:
  total ≥ 80: "great"
  total ≥ 60: "ok"
  else:       "poor"
```

## Reasons

- Generiere Reason je Subscore mit `s < 70`.
- Sortiere absteigend nach `(weight × (100 − s))` (= „Impact").
- Top 3 in `reasons[]`.
- Fallback wenn alle ≥ 70: „Leisten-Geometrie passt zu deiner Fuß-Anatomie."

## Flags

```
needsBigger              = length-allowance < ideal.min
needsSmaller             = length-allowance > ideal.max + 6
needsWider               = ball-delta < 0
needsNarrower            = ball-delta > target_max + 6
needsRoomierToebox       = toebox-T2 < 70
needsMoreArchSupport     = arch-score < 70 AND foot.arch_type === "low"
```

## Hard Filters (vor Scoring)

- `shoe.available_sizes` enthält `foot.eu_size` (oder ±0.5 Toleranz).
  → Wenn nicht: kein Score, Schuh wird in `rankShoes` ausgefiltert (oder mit `score = 0, band = "poor", reason = "Größe nicht verfügbar"` zurückgegeben, je nach Aufruf).
