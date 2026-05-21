# Competitor Analysis: Shoe-Fit Recommendation Engines

Recherche-Stand: Mai 2026. Quellen siehe `sources.md`.

## RunRepeat

**Methodik:** Eigenes Lab, Gel-Verfahren misst Innenraum jedes Schuhs in mm.

**Gemessene Dimensionen:**
- **Innenlänge** (insole length)
- **Innenbreite** (am breitesten Punkt)
- **Toebox-Breite** an einem standardisierten Punkt **28,3 mm vor der Spitze** (dort, wo der große Zeh endet)
- **Toebox-Höhe**
- **Heel stack** bei 12 % der Innenlänge (zentral)
- **Forefoot stack** bei 75 % der Innenlänge (zentral)
- **Heel drop** = heel stack − forefoot stack
- **Midsole-Härte** (Asker C, Raumtemp + nach 20 min Tiefkühler)
- **Torsions-Steifigkeit** (10° Rotation, custom rig)
- **Outsole-Abrieb** (Dremel-Test)

**Klassifikation:** RunRepeat publiziert keine festen mm-Schwellen für „narrow/wide" — Rohwerte werden **gegen ihren Datensatz-Mittelwert** verglichen. Beispielwerte:
- Nike Pegasus 41 Toebox-Breite: 72,9 mm
- Altra Torin 8 Toebox-Breite: 83,6 mm

**Implikation für uns:** Liefert **objektive Leistenmaße**, keine Foot-zu-Schuh-Matching-Logik. Dimensionen-Schema zum Abgleichen nutzen.

---

## Volumental

**Methodik:** 3D-Scanner, ±1 mm Genauigkeit, 5 Sekunden Scan-Zeit. AI-Engine („Fit Engine®") trifft Empfehlung.

**Gemessene Foot-Dimensionen:**
1. Length
2. Width (Ball-Bereich)
3. Arch (Längsgewölbe-Höhe)
4. Instep (Spannhöhe)
5. Heel width

**Empfehlungs-Logik:** **Hybride aus Geometrie + Collaborative Filtering.** Engine vergleicht User-Fuß mit ≥ 40 Mio. Scans, sucht Nutzer mit **ähnlichen Füßen, die einen bestimmten Schuh gekauft und _nicht zurückgegeben_ haben**. „Did-not-return" als Ground-Truth-Label.

**Foot-Distribution (Männer, 270 mm Länge, 5 %–95 % Perzentil):**
- Breite: 94–110 mm (16 mm Spread)
- Spannhöhe: 55–71 mm (16 mm Spread)

**Implikation für uns:**
- Wir haben kein 40-Mio-Scan-Dataset → reines ML/CF nicht möglich.
- ABER: **Retour-Rate (`shoes.retour_rate_pct`)** ist unser kleines Äquivalent. Niedrige Retour-Rate bei einem Schuh → der Leisten passt im Mittel gut → leichter Score-Bonus.
- Die 5 Volumental-Dimensionen decken sich mit unserem Schema: `foot_length_mm`, `ball_width_mm`, `arch_type`, (Instep haben wir nicht), `heel_width_mm`.

---

## Safesize

**Methodik:** 3D-Scanner + selbstlernender Algorithmus. Sport-spezifisch (>20 Sportarten, inkl. Running).

**Personalisierung:**
- Sport-spezifische Anforderungen (Running ≠ Football ≠ Ski)
- Persönliche Tightness-Präferenz (snug/loose)
- Real-time Feedback wird ins Modell zurückgespielt

**Implikation für uns:**
- **`runner_type`** (`casual` / `daily` / `long` / `trail` / `racing`) als Eingabe — modifiziert vor allem die **Längen-Allowance**.
- **`fit_preference`** (`snug` / `regular` / `roomy`) als Tuning-Knopf.

---

## StrutFit

**Methodik:** Smartphone-Scan via Computer Vision. Misst:
- Length
- Width
- **Flex point** (Heel-zu-Ball-Position!)
- Toebox

**Empfehlung:** Mappt gemessene Dimensionen gegen Hersteller-Größentabellen + ML-Modell.

**Implikation für uns:**
- **Flex point / Heel-zu-Ball** ist eine wichtige Dimension (1. MTP-Joint muss am breitesten Punkt sitzen). Wir haben sie aktuell nicht — **TODO: Spalte hinzufügen oder aus `inner_length_mm × ~0,68` schätzen** (Ratio Heel-Ball / Total bei adulten Füßen).

---

## Branchen-Standards (aggregiert)

**Mondopoint (ISO):**
- Länge in mm = Schuhgröße
- Toleranz: ±2,5 mm pro halbe Größe (Casual), ±3,75 mm Spezial-Footwear
- 5-mm-Halbgrößen-Schritte, 10-mm-Ganzgrößen

**Brannock (US):**
- Misst Heel-to-Toe, Ball-Width, **Heel-to-Ball-Length**
- Last ist 0,66" (16,8 mm) länger als Fuß

**EU-Standard:**
- Last ist 13–16 mm länger als Fuß (2–2,5 Paris-Points)

**Width-Grade (US D → E):**
- +1/4 Zoll (6,35 mm) **Girth** pro Stufe
- ≈ +3–5 mm linearer Width-Anstieg pro Stufe

---

## Synthese: Was wir aus dem Markt lernen

| Aspekt                       | Ansatz                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Längen-Allowance             | **Hauptfaktor**. 10–15 mm Standard, profilabhängig (Trail mehr, Race weniger).   |
| Width-Matching               | Linear in mm + Width-Grade als Sanity-Check.                                     |
| Personalisierung             | Sport-Profil + Tightness-Präferenz.                                              |
| Outcome-Signal               | Volumental nutzt „did not return" → wir nutzen `retour_rate_pct` als Modifier.   |
| Heel-zu-Ball / Flex-Point    | Wichtige Dimension; aktuell nicht in DB → später ergänzen.                       |
| ML/CF                        | Out of scope für v2 (zu wenig Daten). Reine Geometrie + Outcome-Modifier.        |
