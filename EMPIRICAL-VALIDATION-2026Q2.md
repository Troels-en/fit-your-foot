# Empirical Validation Plan — Q2 2026

**Status:** PRE-LAUNCH GATE
**Owner:** @troels
**Created:** 2026-05-05
**Bar:** Quick-Scan-Lite ±5mm · Premium-Scan-Pro ±3mm (RSS-typical)
**Decision-Gate:** falls n=30 die Bar nicht erreicht → Bar-Reduce ODER HF-2/3/4
Adds VOR Public-Launch (kein Soft-Release mit Disclaimer).

---

## 1. Why this plan exists

Die ±3mm RSS-typical Premium-Pro-Bar (HANDOFF Section 1) ist budget-rechnerisch
(Worst-Case ±5.1mm linear), aber UNVALIDATED auf realer Geräte+Licht-
Kombinatorik. Ohne empirische Validation fliegen wir blind in Public-Launch.

Genau **eine** Frage soll der Plan beantworten:

> Erreicht der gesamte Capture-Pipeline-Stack (UA-Prior-Intrinsics, ArUco-
> Detection, PnP-Pose, Joint-3D-Reconstruction) die deklarierten ±-Toleranzen
> auf typischer Endkunden-Hardware unter typischer Endkunden-Beleuchtung?

Falls NEIN → entweder Bar reduzieren (User-facing-Disclaimer "±5mm typical")
ODER High-Frequency-Adds 2/3/4 (Per-Capture-Intrinsics-Drift, Rolling-Shutter,
IPPE-Disambig) implementieren. Soft-Launch ohne Validation = User-Trust-Schaden
wenn Marketing-±3mm in Wirklichkeit ±7mm ist.

---

## 2. Test-Setup

### 2.1 Reference-Measurement: Brannock Device + Digital Caliper

| Maß | Tool | Genauigkeit |
|-----|------|-------------|
| Foot-Length (Heel→Longest-Toe) | Brannock Device, Inch-Skala 1/16" | ±0.4mm |
| Ball-Width (1./5. Metatarsal) | Digital-Caliper Mitutoyo CD-15PSX | ±0.02mm |
| Heel-Width | Digital-Caliper | ±0.02mm |
| Foot-Toebox-Height | Digital-Caliper, vertikal am Hallux | ±0.02mm |

**Procedure:**
1. Subject sitzt auf Stuhl, Knie über Fuß, Füße flach am harten Boden.
2. Foot-Length mit Brannock — Ferse plant gegen die Wand-am-Brannock, Wert
   beim längsten Zeh ablesen, in mm rechnen (1mm = 1/25.4").
3. Ball-Width: Caliper über breitester Stelle (ca. 1./5. Metatarsal-Köpfe),
   2x messen, Mittelwert.
4. Heel-Width: Caliper am breitesten der Ferse, 2x messen, Mittelwert.
5. Toebox-Height: Caliper vertikal vom Boden zur Hallux-Oberseite.
6. Werte in mm in `fixtures/empirical-validation-2026Q2.csv` schreiben.

### 2.2 Capture-Setup pro Set

Pro Subject + Phone + Lighting:

1. Print A4 (oder A3 wenn Schuhgröße ≥43) ArUco-Mat auf weißem 80g/m²-Papier
   bei 100% Skalierung. **Verifier**: 60mm-Strecke (A4) bzw. 90mm-Strecke (A3)
   mit Caliper messen — Δ <2% sonst Mat verwerfen + neu drucken.
2. Hartboden-Confirm: Fliesen, Holz, Laminat, PVC.
3. Mat mit kurzer Kante an die Wand legen.
4. Subject sitzt; gewählter Fuß auf Mat, Ferse berührt Wand.
5. Quick-Scan-Lite ausführen via `/photogrammetry-test?v11=true` mit:
   - selectedFoot = subject's selected
   - matFormat = A4 (oder A3)
   - Voice-Coach off (zum Fokus)
6. CSV-Eintrag: Set-ID, Phone, Lighting, Caliper-Werte, Scan-Werte, Foot-Side.
7. Premium-Scan-Pro im selben Set ausführen wenn Backend deployed (Phase-5).

### 2.3 Phone-Matrix (≥5 Modelle)

Mindest-5-Coverage über typische Endkunden-Phones 2024-2025:

| # | Modell | Released | Camera-Sensor | UA-Prior-validated |
|---|--------|----------|---------------|---------------------|
| 1 | iPhone 15 / 15 Pro | 2023 | 48MP, 1/1.28" | ✅ in `_DEVICE_DATABASE` |
| 2 | iPhone 13 mini | 2021 | 12MP, 1/1.7" | ✅ |
| 3 | Samsung Galaxy S24 Ultra | 2024 | 200MP HP2 | ✅ |
| 4 | Samsung Galaxy A54 | 2023 | 50MP | TBD — extend lookup |
| 5 | Google Pixel 8 / 8a | 2023-24 | 64MP | ✅ |
| **+1 Bonus** | OnePlus 12 / Xiaomi 14 / Sony Xperia | für variance | TBD |

Für n=30 ergibt das ≥6 Sets/Phone. Wenn Phone nicht in UA-Prior: zuerst
Premium-Pro testen (Zhang-Calibration funktioniert UA-prior-frei) und
parallel UA-Lookup-Eintrag adden.

### 2.4 Lighting-Matrix (≥3 Conditions)

| # | Condition | Setup | Brightness-Mean (Probe-Lite) |
|---|-----------|-------|-------------------------------|
| L1 | Tageslicht-soft | Wohnraum mit indirektem Fenster, Bewölkung | 110-160 |
| L2 | Innenraum-Kunstlicht | Deckenlampe LED 4000K, kein Tageslicht | 80-120 |
| L3 | Mixed + harter Schatten | Sonnenfenster + Schatten an einer Seite des Mats | 70-200, Gradient >0.15 |

Für n=30 ergibt das ≥10 Sets/Lighting × verteilt über Phones.

### 2.5 Subject-Pool

Mindest 5 Subjects mit verschiedenen Fußgrößen:

| Subject | EU-Size | Foot-Length-Range |
|---------|---------|--------------------|
| S1 | 38-39 | 240-250mm |
| S2 | 41-42 | 260-270mm |
| S3 | 43-44 | 275-285mm |
| S4 | 45-46 | 290-300mm |
| S5 | 36-37 | 230-240mm |

Mehrere Sets pro Subject (verschiedene Phones × Lightings) ergeben die n=30.

---

## 3. CSV-Fixture-Format

Datei: `fixtures/empirical-validation-2026Q2.csv`

```csv
set_id,subject_id,phone_model,lighting,foot_side,mat_format,
caliper_length_mm,caliper_ball_width_mm,caliper_heel_width_mm,
scan_tier,scan_length_mm,scan_ball_width_mm,scan_heel_width_mm,
scan_completed_at,notes
```

**Beispiel:**

```csv
set_id,subject_id,phone_model,lighting,foot_side,mat_format,caliper_length_mm,caliper_ball_width_mm,caliper_heel_width_mm,scan_tier,scan_length_mm,scan_ball_width_mm,scan_heel_width_mm,scan_completed_at,notes
001,S1,iPhone-15-Pro,L1,right,A4,247.3,93.2,62.5,quick-lite,249.1,94.0,63.1,2026-05-12T10:15:00,
002,S1,iPhone-15-Pro,L1,left,A4,247.0,93.0,62.4,quick-lite,250.3,93.7,63.5,2026-05-12T10:18:00,Brannock-1mm-rounded
003,S2,Samsung-S24-Ultra,L2,right,A4,265.0,99.1,68.0,quick-lite,266.5,100.0,68.7,2026-05-12T11:02:00,
004,S2,Samsung-S24-Ultra,L2,right,A4,265.0,99.1,68.0,premium-pro,265.4,99.3,68.1,2026-05-12T11:05:00,
```

Felder:

| Feld | Type | Wert |
|------|------|------|
| set_id | string | Eindeutige ID `NNN` |
| subject_id | string | `S1..S5+` |
| phone_model | string | Slugified Modell-Name |
| lighting | enum | `L1`, `L2`, `L3` |
| foot_side | enum | `left`, `right` |
| mat_format | enum | `A4`, `A3` |
| caliper_*_mm | float | Reference-Messung (Brannock/Caliper) |
| scan_tier | enum | `quick-lite`, `premium-pro` |
| scan_*_mm | float | Pipeline-Output aus `/measure` |
| scan_completed_at | ISO-8601 | UTC |
| notes | string | Anomalien oder Disclaimer |

---

## 4. Statistical-Analyse via `scripts/empirical_validation.py`

Run after capturing 30+ sets:

```bash
uv run python scripts/empirical_validation.py \
    --input fixtures/empirical-validation-2026Q2.csv \
    --output reports/empirical-validation-2026Q2.md
```

Per Tier (Quick-Lite, Premium-Pro) computed:

- n (sample-count)
- delta-Statistik per Maß (length, ball-width, heel-width):
  - Mean (bias)
  - Std-Dev
  - p50, p95, p99
  - Max
  - Pass-Rate vs. Bar (±5mm Quick / ±3mm Premium)
- Per-Phone breakdown (passed-rate)
- Per-Lighting breakdown (passed-rate)
- Per-Subject breakdown (rules out Brannock-Mess-Bias)
- Pass-Gate: ≥85% sets innerhalb Toleranz für Launch-Approval

---

## 5. Decision-Gate (Pre-Launch)

| Bedingung | Action |
|-----------|--------|
| Quick-Lite ≥85% pass + Premium-Pro ≥90% pass | ✅ LAUNCH approved |
| Quick-Lite 70-84% pass | 🟡 Bar-Reduce auf ±7mm + Disclaimer |
| Quick-Lite <70% pass | ❌ HF-Adds nötig — kein Public-Launch |
| Premium-Pro 70-89% pass | 🟡 Bar-Reduce auf ±5mm |
| Premium-Pro <70% pass | ❌ Pipeline-Refactor nötig |

Failure-Modes-Triage:
- Bias >2mm (mean-delta off-zero) → systematischer Pipeline-Bug, NICHT Bar-fix
- Std-Dev hoch (>3mm) bei Quick + niedrig bei Pro → UA-Prior-Issue, neue
  Phones in Lookup adden + retest
- Pass-Rate niedrig in L3 nur → Lighting-Gate verschärfen
- Pass-Rate niedrig auf 1 Phone-Modell → UA-Prior-Validation-Issue, fix UA

---

## 6. Known-Limitations

- **Kein 3D-Reference**: Caliper misst Punkt-zu-Punkt-Distanzen, NICHT
  3D-Foot-Volumen. Phase-5 könnte Structured-Light-Reference (Aetrex Albert)
  einsetzen für Volume-Maße — Q3 2026 Backlog.
- **n=30 ist Untergrenze**: Statistical-Power für CI-95% braucht ≥50 Sets bei
  std=3mm. Wenn Variance hoch: erweitern auf n=60 vor Launch.
- **Brannock-Rundung**: Brannock-Skala ist 1/16"-Schritte (~1.6mm). Wir runden
  auf 1mm — ergibt ±0.5mm-Reference-Bias. Für Length akzeptabel da Bar ±3-5mm.
- **No-Distortion-Capture**: Tests basieren auf statischer Capture. Motion-
  Blur (Phone-Wackeln) nicht systematisch getestet — `Gyro-Variance`-Gate
  fängt ab, aber Subject-Bewegung während Foto wird nicht reproduziert.
- **Nur EU-Märkte-Phones**: Asian-flagship-Phones (Honor, Xiaomi-China) nicht
  abgedeckt.

---

## 7. Reporting + Sign-Off

Nach Datenerfassung:

1. Run statistical-script (Section 4) → `reports/empirical-validation-2026Q2.md`
2. Manuelle Sichtprüfung (`scan_*_mm` <40mm oder >400mm = ausreißer flagen)
3. Decision-Gate (Section 5) → Tabelle ausfüllen, Decision dokumentieren
4. Sign-off Commit: `docs(validation): Q2-2026 empirical results — <decision>`
5. Falls Decision = LAUNCH: User-facing-Spec-Page updaten mit echten ±-Werten
   statt RSS-Theorie

---

## 8. Workplan-Tracking

- [ ] **W1 (2026-05-12 → 18):** Phones besorgen (eigene + Freunde-Pool)
- [ ] **W1:** Brannock + Caliper kalibrieren
- [ ] **W2 (2026-05-19 → 25):** 15 Sets erfassen (Subjects S1-S3, Phones P1-P3, alle Lightings)
- [ ] **W3 (2026-05-26 → 06-01):** 15 Sets erfassen (S4-S5, P4-P6)
- [ ] **W3:** Run script + initial-Report
- [ ] **W4 (2026-06-02 → 08):** Falls Decision="LAUNCH" → User-Spec-Update + Marketing-Copy
- [ ] **W4:** Falls Decision="REDUCE" → Disclaimer-Text + UI-Changes
- [ ] **W4:** Falls Decision="REJECT" → Backlog-Refactor-Plan

---

## 9. Backend-Deploy-Prerequisite

Validation kann ERST starten wenn Modal-Backend deployed ist (`/probe-lite`,
`/probe-pro`, `/detect-extended`, `/measure` alle live). Aktueller Stand
2026-05-05: foundation committed aber `modal deploy` noch nicht ausgeführt.

User-Action: `modal deploy modal/app.py` → URL in `.env.production`-
`VITE_BACKEND_URL` paste → Lovable Publish.
