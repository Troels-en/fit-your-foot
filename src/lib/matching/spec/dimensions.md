# Dimension Mapping: Supabase → Algorithmus

## Foot (`scans` table)

| Spalte               | Typ      | Verwendung im Algo                           | Pflicht |
| -------------------- | -------- | -------------------------------------------- | ------- |
| `foot_length_mm`     | number   | Length-Score (allowance vs. inner_length)    | ✅ ja   |
| `ball_width_mm`      | number   | Ball-Width-Score, Width-Grade-Mapping        | ✅ ja   |
| `foot_width_mm`      | number   | Fallback wenn `ball_width_mm` fehlt          | nein    |
| `heel_width_mm`      | number   | Heel-Score                                   | nein    |
| `arch_type`          | enum     | Arch-Support-Score, Toebox-Höhe-Sub          | nein    |
| `eu_size`            | number   | Hard-Filter (Größenverfügbarkeit)            | nein    |
| `confidence`         | string   | Optional: bei `low` → Range-Reason hinzufügen | nein    |

## Shoe (`shoes` table)

| Spalte               | Typ      | Verwendung                                  | Gewicht |
| -------------------- | -------- | ------------------------------------------- | ------- |
| `inner_length_mm`    | number   | Length-Allowance                            | 30 %    |
| `outer_length_mm`    | number   | Fallback (≈ inner + 15 mm)                  | -       |
| `width_mm`           | number   | Last-Width am Ball (Fallback für forefoot)  | -       |
| `forefoot_width_mm`  | number   | Ball-Width-Score                            | 25 %    |
| `heel_width_mm`      | number   | Heel-Score                                  | 15 %    |
| `toebox_width_mm`    | number   | Toebox-Sub T1                               | 10 %    |
| `toebox_height_mm`   | number   | Toebox-Sub T3 (bei high arch)               | (10%)   |
| `toebox`             | string   | Toebox-Sub T2 (kategorisch)                 | (10%)   |
| `width_grade`        | string   | Width-Grade-Sanity                          |  5 %    |
| `arch_support`       | string   | Arch-Score                                  |  5 %    |
| `heel_drop_mm`       | number   | Drop-Score                                  |  5 %    |
| `heel_stack_mm`      | number   | Drop-Berechnung Sanity                      | -       |
| `forefoot_stack_mm`  | number   | Drop-Berechnung Sanity                      | -       |
| `retour_rate_pct`    | number   | Outcome-Modifier                            |  5 %    |
| `available_sizes`    | number[] | Hard-Filter                                 | -       |
| `gender`             | string   | Hard-Filter (falls Profil ein Gender hat)   | -       |
| `category`           | string   | Hard-Filter (Running)                       | -       |
| `runrepeat_score`    | number   | (informativ, nicht Teil der Fit-Score)      | -       |
| `weight_g`           | number   | (informativ)                                | -       |
| `passform`           | string   | (informativ; Brand-Selbstangabe)            | -       |
| `shoe_height_mm`     | number   | (informativ, Schaft-Höhe)                   | -       |
| `sole_height_mm`     | number   | (informativ, deckt sich teils mit stack)    | -       |

## Nicht in DB, aber wünschenswert (Future Work)

- **Heel-to-Ball-Length** (Flex-Point) — wichtig für 1. MTP-Alignment. Mom. via `inner_length × 0.68` schätzbar.
- **Instep height / Spannhöhe** — Volumental misst es; wir haben es nicht im Foot-Schema.
- **Ball girth** (Volumen statt linear) — höhere Vorhersagekraft als Width allein.
- **Insole stiffness** — relevant für Forefoot-Striker.
