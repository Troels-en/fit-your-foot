# Photogrammetry-Scanner — Plan v1

**Status:** Draft, awaiting Phase 0 (Internal-Tools-Setup)
**Owner:** Troels (manuelle Validation), Claude (code)
**Last update:** 2026-05-02

> **Pivot vom ersten Plan:** Luma war wrong choice (3D-Capture-Service Ende
> 2024 eingestellt, jetzt nur noch Video/Bild-AI Dream Machine).
>
> Neuer Stack nach Recherche: **KIRI Engine API** für Spike + Production v1
> (dokumentiert, $7/Monat Premium oder Free-Tier mit 3 Scans/Woche, sehr
> ähnliches Feature-Set wie Luma damals, plus Gaussian Splatting + AI-LiDAR).
> Self-Host gsplat-on-Modal als Phase-4-Option wenn wir Vendor-Lock später
> auflösen wollen.

## Goal & Success Criteria

Aktueller 2-Foto-Scan: ±5-8mm. Matching v2 will ±2mm sonst sind
Width-Klassen-Grenzen unscharf.

**Success-Kriterien für v1:**
- ✅ Genauigkeit ±2-3mm bei guter Capture (Lineal/Brannock-Vergleich)
- ✅ Capture-Zeit ≤2 Min pro Fuß
- ✅ Reine Browser-Lösung — kein App-Install nötig
- ✅ Funktioniert auf normalen iPhone (kein Pro/LiDAR) + Android
- ✅ Existierende `/scan/:sessionId` Mobile-Flow ersetzbar ohne DB-Migration

**Nicht-Ziele für v1:**
- ±1mm Genauigkeit
- iPhone-LiDAR-Pfad
- 3D-Mesh-Visualisierung

## Stack-Decision (post Recherche)

| Option | Cost | Setup | Quality | Empfehlung |
|---|---|---|---|---|
| **KIRI Engine API** | $7/Monat Premium ODER Free-Tier (3 Scans/Woche) | 1-2 Tage | Sehr gut (Gaussian Splatting + AI-LiDAR + Photogrammetry) | **JA für Spike + v1** |
| **Polycam API** | Unklar/B2B-Anfrage | 2-3 Tage | Sehr gut, mobile-optimized | Alternative falls KIRI scheitert |
| **gsplat / nerfstudio selber hosten** | $0.10-0.15/Scan auf Modal | 4-5 Tage | Top, voll customizable | Phase 4 (Vendor-Lock-Out) |
| **Apple Object Capture** | Free + Mac mini ~750€ | 2 Wochen | Best-in-class | Nur wenn Apple-Native nötig wird |
| **Luma AI** | — | — | — | ❌ 3D-Service eingestellt |
| **Volumental** | — | — | Beste Hardware | ❌ B2B-only, kein API für Startups |

**Plan: starte mit KIRI Engine.** Free-Tier reicht für Spike. Bei Erfolg
$7/Monat Premium für Phase 2-3 Test-Captures. Self-Host kommt erst wenn
Volume rechtfertigt.

## Architektur

```
[Mobile-Browser]
  │ Video-Stream + DeviceMotion (Gyro)
  │ Pose-Indikator → Keyframe-Capture
  ▼
[Capture-UX] (eigene React-Component, pure Browser)
  │ 8-12 Keyframe-JPEGs + A4-Reference-Frame
  ▼
[Edge Function `photogrammetry-submit`]
  │ Upload an KIRI Engine API
  │ Polling auf Job-Completion
  ▼
[KIRI Engine] — Cloud-Photogrammetry
  │ → 3D-Mesh (PLY/OBJ/GLTF)
  ▼
[Modal Backend] (existing modal/measure/)
  │ Mesh laden → A4-Plane finden → Skala anwenden
  │ Length/Ball/Heel/Arch aus Mesh-Slices
  ▼
[Supabase scans] — selbe Spalten wie heute
  │
  ▼
[Frontend /profile + matching v2]
```

## Phasen + Timeline

### Phase 0: Internal-Tools-Setup (USER, ~10 Min)

**Ground-Truth für Validation** (nur Dev-Phase, NICHT kunden-facing):

| Option | Cost | Wo |
|---|---|---|
| **A: Schuhladen mit 3D-Scan** ⭐ | 0 € | siehe Liste unten |
| B: Brannock-Device | ~30 € | Amazon |
| C: Schiebmaß | ~10 € | Amazon |

**Empfohlen: Option A — kostenlos und gibt dir 3D-Mesh als Goldstandard.**

#### Shoe-Stores mit 3D-Foot-Scan in Deutschland

Konkretes Setup für unser Team (recherchiert + verifiziert):

**Essen (Troels):**
- **Sanitätshaus Luttermann** — Lauflabor mit 3D-Bewegungsanalyse → [luttermann.de](https://www.luttermann.de/leistungen/lauflabor/)
- **Laufsport Bunert** — Rüttenscheider Str. 184, Tel 0201-422851, etablierter Laufladen seit 1997

**Hamburg (Cofounder):**
- **Laufwerk Hamburg** ([3676-2 Info](https://www.laufwerk-hamburg.de/3676-2/)) — Footbalance 3D Footscan, €30 ODER **0 € wenn Schuh gekauft wird** (Gutschrift gegen Kauf in 4 Wochen). 3 Filialen: Eppendorf, Hoheluft, Eimsbüttel

**Flensburg (Cofounder):** ⭐ einfachster Pick
- **INTERSPORT HANS JÜRGENSEN** ([store-page](https://www.intersport.de/d/stores/24937-flensburg-intersport-hans-juergensen)) — **KOSTENLOSE 3D-Fußanalyse**, unverbindlich, größter Sportstore in Schleswig-Holstein
- **ZIPPEL'S Läuferwelt** ([zippels.de/standorte/flensburg/](https://www.zippels.de/standorte/flensburg/)) — Running-Spezialist seit 1982

**Andere Städte (Backup):**
- SportScheck-Filialen (26 in DE) — 2D-Footscan kostenlos, weniger präzise
- New-Balance-Stores mit Volumental-Scanner (vorher anrufen, nicht alle haben)
- Bauerfeind — medizinischer 3D-Scan, manche Filialen kostenlos für Beratung

**Skript fürs Anrufen:**
> „Hallo, ich plane Laufschuhe zu kaufen und brauche dazu meine genauen
> Fußmaße. Macht ihr 3D-Fußscan? Wenn ja: könnte ich einen Termin machen
> und die Werte für mich aufgeschrieben mitnehmen?" — die meisten geben
> das gerne mit.

**Welche Werte aufschreiben (pro Fuß, beide Seiten):**

Mindestens (matched unsere DB):
- Foot Length (mm)
- Ball Width (mm)
- Heel Width (mm)
- Arch Type (low / medium / high)
- EU-Size

Plus alles weitere was der Scanner ausgibt — wir brauchen es vielleicht
für Tuning oder DB-Erweiterung. Typische Extras:
- Spannhöhe / Instep (mm) — wichtig für Schnür-Fit
- Heel-to-Ball Length (mm) — Flex-Point-Position
- Ballenumfang / Foot Girth (mm) — Volumetric statt linear
- Bogen-Höhe (mm, exakt)
- Pronation-Index / Eversion
- Fußform-Kategorie (ägyptisch / griechisch / quadratisch)

**Easy-Path:** Print-Out abfotografieren + an mich senden. Ich tipp's ab.

→ Wenn du Maße hast (Length, Ball-Width, Heel-Width, ggf. Arch-Type):
sag „phase 0 done" + nenn mir deine Werte. Dann starte ich Phase 1.

### Phase 1: Spike (3-5 Tage, Decision Gate)

**Ziel:** Beweisen dass die Pipeline ±3mm liefert. Free-Tier reicht.

| Tag | Deliverable |
|---|---|
| 1 | KIRI Engine API-Account anlegen + Free-Test-Mode + Capture-UX-Prototyp (Browser-Video, manueller Snapshot) |
| 2 | Edge Function `photogrammetry-submit` (KIRI API upload, poll, mesh download) |
| 3 | Modal-Pipeline erweitern: Mesh laden → A4-Plane → Length/Ball/Heel extrahieren |
| 4 | Validation: 3× Captures deines Fußes, Vergleich mit Ground-Truth |
| 5 | Puffer (Pipeline-Tuning oder iOS-Safari-Quirks) |

**Decision-Gate Ende Phase 1:**
- ≤±3mm → Phase 2 commitet
- ±3-5mm → Pivot: mehr Frames, Polycam-Alternative, oder andere Reconstruction-Settings
- > ±5mm → Stop, Plan überdenken

### Phase 2: Production Build (8-10 Tage)

| Track | Deliverable | Tage |
|---|---|---|
| **Capture-UX-Polish** | Pose-Indikator, automatische Keyframe-Selektion, A4-Live-Detection (OpenCV.js), Retake-Flow | 4-5 |
| **Backend** | Async Job-Pattern, Cost-Tracking, Failure-Handling, KIRI-Premium-Subscription falls Volume nötig | 2 |
| **Frontend-Integration** | `/scan/:sessionId` umstellen, alte 2-Foto als Fallback | 2 |
| **DB** | Optional: mesh_url, capture_quality_score Spalten | 1 |

### Phase 3: Tuning + Launch (3-5 Tage)

- 10+ Test-Captures mit verschiedenen Füßen
- Edge-Cases: schlechtes Licht, dunkle Haut, Schatten, Fuß-Position
- Performance-Feedback an User
- Failure-Modes graceful

**Total realistisch: 14-20 Arbeitstage = 3-4 Wochen.**

## Genauigkeits-Erwartungen

| Phase | Erwartet | Begründung |
|---|---|---|
| Phase 1 Spike (1 Capture) | ±3-5mm | Single-Test, ungetuned |
| Phase 2 Build (gute Capture) | ±2-3mm | KIRI Premium 200-Frames, A4-Skala |
| Phase 3 Tuning | ±2mm | Edge-Cases addressiert |
| Real-World-Average | ±2.5-4mm | User-Captures variieren |

## Manuelle Steps (Checkliste)

```
[ ] Phase 0:
    [ ] EINS von:
        [ ] Schuhladen mit 3D-Scan finden + hingehen ⭐ (siehe Liste oben)
        [ ] Brannock-Device kaufen (~30 €)
        [ ] Schiebmaß kaufen (~10 €)
    [ ] Maße aufschreiben: Length, Ball-Width, Heel-Width, Arch-Type
    [ ] Sagen: "phase 0 done"

[ ] Phase 1 (du):
    [ ] KIRI-Account anlegen (free) auf kiriengine.app
    [ ] API-Key generieren
    [ ] KIRI_API_KEY als Supabase-Secret hinterlegen
    [ ] Eigene Füße scannen (8 Fotos manuell als Test)

[ ] Phase 2 + 3 (gemeinsam):
    [ ] UX-Reviews
    [ ] Beta-Test mit 3-5 Personen
```

## Risiken + Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| KIRI API rate-limits / auch eingestellt wie Luma | Mittel | Hoch | Polycam als 2nd-Option, gsplat-Self-Host als 3rd |
| iOS Safari MediaStream / DeviceMotion quirks | Hoch | Hoch | Phase 1 spike auf Safari testen |
| A4-Detection bei schwachem Licht | Hoch | Mittel | UX-Feedback „mehr Licht", Brightness-Threshold |
| Genauigkeit < ±3mm trotz tuning | Mittel | Hoch | Polycam/Apple-Object-Capture als Fallback |
| User-Capture-Qualität schlecht | Hoch | Mittel | Pose-Guidance + Quali-Score + Retake-Hint |
| KIRI-Subscription-Cost bei Scale | Niedrig | Mittel | Self-Host-Migration in Phase 4 wenn >1000 Scans/Monat |

## Cost-Estimation

| Phase | Cost |
|---|---|
| Phase 0 Validation | 0-30 € (Schuhladen kostenlos, sonst Brannock/Schiebmaß) |
| Phase 1 Spike | $0 (KIRI Free-Tier) |
| Phase 2 Build | $7/Monat (KIRI Premium) während Dev |
| Phase 3 Tuning | $7-21 (1-3 Monate Dev-Phase) |
| **Total für v1** | **~30-50 €** |

Production-Cost steady-state:
- Bei <1000 Scans/Monat: KIRI Premium $7/Monat (200 Photos/Scan, unlimited exports)
- Bei mehr: Self-Host gsplat (~$0.10-0.15 GPU pro Scan auf Modal, breakeven ~50 Scans/Monat vs $7-Sub)

**Kein zusätzlicher Setup-Aufwand. Free-Tier ohne Card. Wenn skaliert, auf Self-Host wechseln.**

## Out-of-Scope (Phase 4+)

- iPhone-Pro-LiDAR-optimierter Capture-Pfad (Genauigkeits-Boost)
- Self-Hosting gsplat/nerfstudio (Vendor-Lock-Out)
- 3D-Foot-Visualization für User
- Pronation-Erkennung aus Mesh-Geometry

## Tech-Stack Decisions

- **Capture**: Browser Video API + Canvas + DeviceMotion. Kein Framework.
- **A4-Detection**: OpenCV.js für Live-Edge-Detection
- **Pose-Guidance**: Gyro-Diff vs Target-Angles. Visual Overlay.
- **Reconstruction**: KIRI Engine API (cloud, Gaussian Splatting + Photogrammetry)
- **Mesh-Format**: PLY oder GLTF (KIRI exports both)
- **Measurement**: Open3D in Modal — laden, A4-Plane finden, Slices messen

## Wie wir entscheiden

Spike ist die Wahrheit. Decision-Gate Phase-1-Ende. Bei ±3mm: Vollgas mit
KIRI. Bei nicht: ehrlicher Pivot.

---

**Nächster Schritt:** Phase 0 (10 Min) → Maße holen, idealerweise im
Schuhladen mit 3D-Scan kostenlos.
