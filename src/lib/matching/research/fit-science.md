# Fit Science: Tolerance-Daten für Laufschuhe

Alle Werte mit Quelle (siehe `sources.md`). Wo Quellen sich widersprechen: arithmetisches Mittel oder Spannweite dokumentiert.

## 1. Längen-Allowance (Zehraum)

**Definition:** Differenz zwischen Schuh-**Innenlänge** und längster Zehe (= Fußlänge gemessen vom Heel-Point).

**Konsens-Werte:**

| Quelle                              | Empfehlung           |
| ----------------------------------- | -------------------- |
| Brooks Running                      | 1× Daumenbreite      |
| ASICS                               | ½ Größe größer       |
| REI Expert Advice                   | ½ Zoll = 12,7 mm     |
| Running Warehouse                   | 6–13 mm              |
| Marathon Handbook                   | ½ Zoll = 12,7 mm     |
| Dr. Kinz / Doctors of Running       | 12 mm optimal, 10 mm Minimum |
| 2016 Studie (90. Perzentil Toe-Allowance, Kinder) | 9,8 mm ♀ / 11,5 mm ♂ |
| EU Mondopoint (Casual Last)         | 13–16 mm             |
| Brannock (US Last)                  | 0,66" = 16,8 mm      |

**Konsens für Running:** **10–15 mm**, Sweet-Spot **12 mm**.

### Profilspezifisch

Laufschuh ≠ Casual. Der Fuß **dehnt sich beim Laufen** durch Impact, schwillt über lange Distanzen, und prallt bergab in den Vorfuß.

| Runner-Profil   | Ideal-Range  | Begründung                                                |
| --------------- | ------------ | --------------------------------------------------------- |
| `casual` (Walk) | 8–12 mm      | Wenig Impact, kein Schwellen.                             |
| `racing`        | 8–11 mm      | Fester Grip für Performance, kurze Distanzen.             |
| `daily`         | 11–14 mm     | Standard-Training, mäßiges Schwellen.                     |
| `long`          | 13–16 mm     | Marathon / Long-Runs: Fuß schwillt 3–5 % über 2 h+.       |
| `trail`         | 14–17 mm     | Bergab-Stöße, robustere Toebox nötig.                     |

### Bewertung (für Algorithmus)

Sei `a = inner_length_mm − foot_length_mm` (allowance).

```
if a < ideal_min − 4:   score 0   (Schuh zu kurz, Black-Toe-Risiko)
if a < ideal_min − 2:   score 30  (zu eng)
if a < ideal_min:       score 70  (knapp)
if ideal_min ≤ a ≤ ideal_max:  score 100  (optimal)
if a > ideal_max + 3:   score 70  (locker)
if a > ideal_max + 6:   score 40  (rutscht, Blasen-Risiko)
if a > ideal_max + 10:  score 10  (definitiv zu lang)
```

---

## 2. Width-Matching (Ballenbreite)

**Definition:** Foot-`ball_width_mm` vs. Schuh-`forefoot_width_mm` (oder fallback `width_mm` = Last-Width am Ball).

**Schlüsselzahlen:**

- Foot-Width-Spread bei Länge 270 mm: **94–110 mm** (Volumental, n=Mio).
- Width-Grade-Inkrement: +6,35 mm Girth ≈ **+3–5 mm linear** pro Stufe (US D → E → 2E).
- Foot dehnt sich unter Impact ~3–5 % → **2–3 mm zusätzliche Lateral-Reserve nötig**.

**Konsens-Allowance:**

| Situation                                 | Width-Differenz `Δw = forefoot_shoe − ball_foot` |
| ----------------------------------------- | ------------------------------------------------ |
| Foot deutlich breiter als Leisten         | `Δw < 0`: kritisch                               |
| Foot = Leisten                            | `Δw = 0`: zu eng für Splay                       |
| Optimal (Splay-Reserve)                   | `Δw = 2–5 mm`                                    |
| Locker (kein Halt, blasenfördernd)        | `Δw > 8 mm`                                      |

### Bewertung

```
if Δw < −3:   score 0–20    (Foot deutlich breiter, drückt → Returns)
if Δw < 0:    score 40–70   (Foot leicht breiter)
if Δw 0–2:    score 80      (passabel, kein Splay-Raum)
if Δw 2–5:    score 100     (ideal)
if Δw 5–8:    score 80      (etwas locker)
if Δw > 8:    score 50      (zu locker)
```

---

## 3. Heel-Width

**Konsens:** Heel sollte **snug** sitzen, „little to no movement". Kein positiver Allowance.

| Differenz `Δh = shoe_heel − foot_heel`  | Wertung                       |
| --------------------------------------- | ----------------------------- |
| `Δh < −3 mm`                            | Drückt → 30                   |
| `Δh −3 … 0`                             | Snug, ideal → 100             |
| `Δh 0 … +2`                             | OK → 90                       |
| `Δh +2 … +4`                            | Beginn Heel-Slip → 60         |
| `Δh > +4`                               | Heel rutscht → 25             |

---

## 4. Toebox-Geometrie

Multi-Faktor:

1. **Toebox-Breite** (`toebox_width_mm`, gemessen 28,3 mm vor Spitze): Sollte ≥ 90 % der `forefoot_width_mm` sein. Sonst zu starker Taper.
2. **Toebox-Form** (`toebox`):
   - `roomy` / `rounded` / `square` → tolerant (alle Foot-Shapes)
   - `tapered` / `pointy` → nur für schmale Vorfüße
3. **Toebox-Höhe** (`toebox_height_mm`): Wichtig bei hohem Spann; ≥ 22 mm gilt als komfortabel.

**Penalty-Logik:**
- Foot ball ≥ 100 mm UND Toebox `tapered` → −15
- Toebox-Width < 0,9 × forefoot_width → −10
- Toebox-Höhe < 20 mm UND arch `high` → −5

---

## 5. Width-Grade Sanity-Check

Mapping (Erwachsene, Längen-normalisiert auf US M9 / EU 42,5):

| `ball_width_mm` (US M9) | Erwartetes Width-Grade |
| ----------------------- | ---------------------- |
| < 92                    | Narrow (B / 2A)        |
| 92–100                  | Regular (D / B)        |
| 100–106                 | Wide (2E / D)          |
| > 106                   | Extra-Wide (4E / 2E)   |

Für andere Längen: linear skalieren mit Faktor `foot_length_mm / 268`.

**Penalty:** Nur 2-Grade-Sprung (z. B. Foot Wide → Schuh Narrow): −5.

---

## 6. Arch-Type Match

| `foot.arch_type` | Schuh `arch_support` (gut)              |
| ---------------- | --------------------------------------- |
| `low` (Plattfuß) | `stability` / `motion-control` / `max`  |
| `medium`         | `neutral` / `stability`                 |
| `high` (Hohlfuß) | `neutral` / `cushion`                   |

**Penalty:** Mismatch (z. B. low arch + neutral) → −5.

---

## 7. Heel-Drop & Stack — Sekundär

Drop und Stack sind **Performance-Präferenzen**, kein hartes Fit-Kriterium. Daher klein gewichtet (5 %) und nur als Modifier:

- Beginner / Heavy-Heel-Striker: Drop 8–12 mm, Heel-Stack ≥ 28 mm.
- Forefoot-Striker: Drop 0–6 mm.
- Trail: Drop 4–8 mm üblich, Stack moderat.

In v2 nicht streng bewertet (nur informativer Reason), bis User-Profil das vorgibt.

---

## 8. Outcome-Modifier: Retour-Rate

**Volumental-Idee:** „Did not return" als Ground-Truth-Label. Unser Äquivalent ist `shoes.retour_rate_pct` (falls befüllt).

```
if retour_rate < 5  : score +2
if retour_rate 5–10 : score +0
if retour_rate 10–15: score −2
if retour_rate > 15 : score −5
```

Grenzen: Max-Modifier ±5 (soll Geometrie nicht überstimmen).

---

## 9. Foot-Schwellen über Distanz

Quellen-Konsens:
- Foot **schwillt 3–5 % in Volumen** bei 2-h-Run.
- Linear ≈ 1–2 mm in Länge, 2–3 mm in Breite.
- → Long-Distance-Profil bekommt bewusst mehr Allowance.

---

## 10. Fit-Preference-Modifier

`fit_preference` ist ein User-Tuning-Knopf:

| Preference | Effekt                                                        |
| ---------- | ------------------------------------------------------------- |
| `snug`     | `target_allowance −= 1.5 mm`, width-Reserve −1 mm             |
| `regular`  | Default                                                       |
| `roomy`    | `target_allowance += 1.5 mm`, width-Reserve +1 mm             |
