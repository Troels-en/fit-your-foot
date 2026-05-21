# Tolerance-Tabellen (numerische Werte des Algorithmus)

Alle Werte aus Recherche (`research/fit-science.md`). Diese Datei spiegelt 1:1 das, was `constants.ts` exportiert.

## Length-Allowance (mm)

```
TARGET_ALLOWANCE_BY_RUNNER_TYPE = {
  casual:  { min:  8, max: 12 },
  racing:  { min:  8, max: 11 },
  daily:   { min: 11, max: 14 },
  long:    { min: 13, max: 16 },
  trail:   { min: 14, max: 17 },
}
```

Quelle: REI, RW, ASICS, Brooks, Mondopoint, Brannock.

## Fit-Preference Offset

```
FIT_PREFERENCE_LENGTH_OFFSET = {
  snug:    -1.5,
  regular:  0,
  roomy:   +1.5,
}

FIT_PREFERENCE_WIDTH_OFFSET = {
  snug:    -1,
  regular:  0,
  roomy:   +1,
}
```

## Width-Targets

```
BALL_WIDTH_TARGET_DELTA = { min: 2, max: 5 }   // mm shoe wider than foot
BALL_WIDTH_HARD_TIGHT   = -3                     // mm; below = score ≤ 10
BALL_WIDTH_HARD_LOOSE   = +11                    // mm; above = score ≤ 40
```

## Heel-Targets

```
HEEL_TARGET_DELTA = { min: -3, max: 0 }   // mm shoe minus foot (negative = snug)
```

## Toebox

```
TOEBOX_RATIO_THRESHOLDS = { perfect: 0.95, good: 0.90, ok: 0.85 }
TOEBOX_HEIGHT_THRESHOLDS = { good: 22, ok: 18 }
WIDE_FOOT_THRESHOLD_MM = 100
```

## Width-Grade

```
WIDTH_GRADE_BOUNDS_MM = { Narrow: 92, Regular: 100, Wide: 106 }   // upper bounds
WIDTH_GRADE_REFERENCE_LENGTH = 268   // foot length used for normalization
```

## Drop & Stack

```
DROP_SWEET_SPOT = { min: 4, max: 12 }   // mm
DROP_HARD_BOUNDS = { min: 0, max: 14 }
```

## Return Signal

```
RETOUR_RATE_THRESHOLDS_PCT = { excellent: 5, good: 10, ok: 15, poor: 25 }
```

## Aggregation Weights

```
WEIGHTS = {
  length:      0.30,
  ballWidth:   0.25,
  heelFit:     0.15,
  toebox:      0.10,
  widthGrade:  0.05,
  archSupport: 0.05,
  dropStack:   0.05,
  returnSig:   0.05,
}
```

Summe = 1.00 ✓

## Bands

```
BAND_THRESHOLDS = { great: 80, ok: 60 }
```
