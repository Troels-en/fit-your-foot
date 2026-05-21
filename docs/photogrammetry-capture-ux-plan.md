# Capture-UX Plan v4 — Photogrammetry-Scanner

**Status:** Plan v4 (post Multi-Model-Review v3)
**Owner:** Claude (code), Troels (review)
**Last update:** 2026-05-02

## Was sich vs v2 geändert hat (v2-Findings adressiert)

| v2 Problem | v3 Lösung |
|---|---|
| Resolution Hard-Abort, kein graceful-degrade | **Multi-Tier-Constraint-Retry**: 1920×1080 → 1280×720 → 960×540 → reject |
| Laplacian-Blur auf Main-Thread janks Preview | **Web-Worker + OffscreenCanvas** für Quality-Scoring |
| Calibration auf A4 misst Papier-Tilt nicht Floor-Tilt | **Gravity-basierte Calibration** statt A4-flat (Accelerometer als true-vertical, A4 nicht relevant für Capture-Coord-Frame) |
| Yaw-Total-Submit-Gate akkumuliert Drift | **Bucket-Coverage** (12× 30°-Segmente, 9-von-12 konsekutiv = 270°) statt yaw-total |
| Yaw-Delta-Gate akzeptiert Reverse-Direction | **Monotonic-Direction-Enforcement** mit User-Hint bei Reversal |
| Manual-Fallback-8-Captures < KIRI-Min | **Manual-Mode entfernt**; Capability-Probe required gyro+camera, sonst abort |
| KIRI-Limit 70/200 Frames falsch | **Korrekt: 20-300 Bilder/Scan** (KIRI-Doc-Lookup) |
| Object-URL Stale-Closure-Bug | **Capture-then-revoke Pattern** mit ref-stable old-list |
| Thermal/Call/Rotation/Audio-Focus Edge-Cases fehlen | **Erweitertes Edge-Case-Inventory** |
| Brightness-Range zu eng [50,200] | **Erweitert auf [40,230]** für outdoor + helle Räume |

## Goal

Browser-only Photogrammetry-Capture-Flow der **40-60 brauchbare JPEG-Frames**
aus einem geführten Orbit-Sweep um den Fuß produziert. Frames werden in
Echtzeit qualitätsgesichert. Funktioniert auf iOS Safari + Android Chrome,
**kein App-Install**.

**Success-Kriterien:**
- ✅ User capture-t in ≤45s einen Fuß
- ✅ ≥40 Frames (Quality-passend) als Output, geeignet für KIRI Photogrammetry
- ✅ Funktioniert iOS Safari 16+ und Android Chrome (modern, 2024+)
- ✅ Calibration zerot Floor-Tilt + Yaw, eliminiert systematische Fehler
- ✅ Permission-Flow korrekt für iOS user-gesture-Pflicht
- ✅ Hard-Abort wenn DeviceMotion fehlt (Manual-Mode bewusst entfernt — würde
     unsubmittable Output produzieren, KIRI braucht ≥20 Frames + Pose-Coverage)
- ✅ Resolution graceful-degrade (1080→720→540), reject wenn < 540p

**Nicht-Ziele:**
- KIRI-Integration / Backend (Phase 2)
- A4-Live-Detection via OpenCV.js (Phase 2)
- Mesh-Measurement-Extraction (Phase 3)
- Multi-Foot-Capture (Phase 2)

## User-Flow (State-Machine)

```
[Probe] → [Permission] → [Calibrate] → [Orbit-Capture] → [Review] → [Submit]
   ↓          ↓             ↓                ↓               ↓
[Error]   [Error]      [Recalibrate]    [Cancel/Restart]  [Retake-Pose]
```

### State 1: Probe (Capability-Detection)
Bevor irgendwas passiert: prüfen ob das Device kann was wir brauchen.
- `'mediaDevices' in navigator && navigator.mediaDevices.getUserMedia` → essential
- `'DeviceOrientationEvent' in window` → REQUIRED (kein Fallback, hard abort wenn fehlt)
- `'requestPermission' in DeviceOrientationEvent` → iOS-Flag
- Returns Capability-Matrix; gates UI-Branch

### State 2: Permission (Atomic Gesture-Click)
**Hard-coded order in einem einzigen Click-Handler:**
1. `DeviceOrientationEvent.requestPermission()` — synchron, blocked bis User klickt
2. Wenn granted ODER kein Permission-Mechanismus (Android): weiter
3. **Camera mit Multi-Tier-Constraint-Retry:**
   ```ts
   const tiers = [
     { width: { ideal: 1920 }, height: { ideal: 1080 } },
     { width: { ideal: 1280 }, height: { ideal: 720 } },
     { width: { ideal: 960 }, height: { ideal: 540 } },
   ];
   let stream;
   for (const constraint of tiers) {
     stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, ...constraint } });
     await videoEl.play();
     if (videoEl.videoWidth >= 960 && videoEl.videoHeight >= 540) break;
     stream.getTracks().forEach(t => t.stop()); // cleanup before next tier
     stream = null;
   }
   if (!stream) return errorRes("Kamera-Auflösung zu niedrig (< 960×540)");
   ```
   Begründung: 960×540 ist Floor — KIRI braucht zwar mehr für ±2-3mm, aber
   wir prüfen das im Spike-Tag-4 mit Validation-Captures. Hard-floor 960×540
   verhindert garbage; soft-target 1080p für Best-Quality.
4. **Sensor-Probe:** binde DeviceOrientation-Listener mit 2s Timeout. Wenn
   keine Events: **Abort** mit klarem Error („Dein Browser unterstützt
   Bewegungssensor nicht — wechsel zu aktuellem Safari/Chrome"). KEIN Manual-
   Mode-Fallback mehr (würde unsubmittable Output produzieren, KIRI braucht
   ≥20 Frames mit guter Pose-Coverage).
5. Wenn alles ok: state advance to Calibrate

### State 3: Calibrate (Yaw-Zero in Start-Pose)
**Adressiert v2-Finding "A4-flat misst nur Papier-Tilt nicht Floor-Tilt".**

Insight: für unsere Use-Case brauchen wir **NICHT** absolute Floor-Frame-
Koordinaten. KIRI's Structure-from-Motion rekonstruiert Camera-Pose pro
Frame aus den Bildern selbst. Gyro brauchen wir nur für **Live-Guidance**
(„wo bin ich im Orbit"), nicht für Mesh-Accuracy. Daher reicht eine
Calibration die Frame-zu-Frame-Konsistenz herstellt, nicht World-Frame.

**Vorgehen:**
- Anweisung: „Halte das Telefon ~30cm über deinem Fuß. Wenn ruhig, fängt
  Calibration automatisch."
- App misst Stillness via Accelerometer (gravity vector stable < 0.5 m/s²
  variance über 1.5s) + Gyro (angular velocity < 5°/s)
- Bei Stillness: **lock yaw_zero = current yaw** als Capture-Coord-Frame-Origin
- Erste „Pose 1"-Frame wird hier auch direkt erfasst (Top-Down-View)
- Visual: Coverage-Halbkreis startet jetzt mit 1 Frame an Position 0°
- **Wenn keine Stillness in 8s:** Hint „Beide Hände am Telefon, halte ruhig"
  + Retry. Nach 3 Fehlversuchen: Error-State mit „Probier später nochmal".

**Floor-Tilt ist irrelevant** weil wir keine Welt-Koordinaten brauchen,
nur Capture-relative. KIRI rekonstruiert die Mesh-Geometrie selbst, A4
dient nur als visueller Reference im Bild für späteren Skala-Step (Phase 2).

### State 4: Orbit-Capture (Continuous Burst, Bucket-Coverage)
**Kernarchitektur. Adressiert v2-Findings: Yaw-Drift, Direction-Reversal.**

**User-Bewegung:** Orbit langsam (~30s) um Fuß im Uhrzeigersinn ODER
Gegenuhrzeigersinn — App erkennt Richtung in den ersten 5° und enforced sie.

**Bucket-Coverage statt Yaw-Total:**
- Orbit aufgeteilt in **12 Buckets à 30°** (360°-Total Goal, da KIRI von
  voller Orbit-Coverage profitiert)
- Submit-Gate: **mindestens 9 von 12 Buckets** (= 270°) mit ≥3 Frames jeweils
- Buckets müssen **konsekutiv** sein — keine 2 leeren Buckets nacheinander
  (sonst Coverage-Gap > 60° → KIRI-Reconstruction-Risk)
- Drift wirkt sich kaum auf Submit-Gate aus (Buckets sind ranges, nicht
  akkumulierte Werte) — kann max einzelne Bucket-Mismatch verursachen

**Capture-Logik (alle 250ms Sample):**
- Frame nur akzeptieren wenn ALLE Gates passen:
  - **Pose-Range-Gate:** Yaw-Delta seit letzem akzeptierten Frame ≥ 5°
    UND in derselben Direction wie initialer Orbit-Start (Reversal blockiert)
  - **Stillness-Gate:** Angular-Velocity < 30°/s (verhindert Motion-Blur)
  - **Quality-Gate via Web-Worker:**
    - Blur-Score (Laplacian-Variance) > Threshold
    - Brightness in [40, 230] (erweitert von [50,200] für outdoor + helle
      Räume mit weißen Socken)
    - Worker post-Message-Pattern: main thread captures Blob → posts to
      Worker → Worker scores → main thread accepts/rejects. Pre-empts
      main-thread-jank auf low-end Phones.
  - **Resolution-Gate:** videoEl liefert noch im akzeptierten Tier
- Per-Frame-JPEG-Size-Assertion: jpeg.size < 1.5MB pro Frame; bei größer
  re-encode mit niedriger Quality (0.85 statt 0.92)
- Maximum: **60 Frames** (KIRI-Limit ist 300 per public-Doc, wir bleiben
  weit drunter für Upload-Geschwindigkeit)
- Minimum für Submit: **30 Frames + 9/12 konsekutive Buckets gefüllt**
- Direction-Reversal: zeige „⚠ Bewege weiter im selben Drehsinn" Hint;
  Frames in Reverse-Direction werden gedroppt

**Yaw-Tracking-Strategie:**
- Calibration-relative (yaw_zero subtrahiert)
- **Yaw-Wraparound** behandelt: bei `prev=355°, current=5°` interpretiere
  delta=+10° (kürzester Pfad), nicht -350°
- Null-Werte aus DeviceOrientation (`alpha === null`) → Frame skip
- Drift-Toleranz unbedeutsam wegen Bucket-Coverage (siehe oben)
- Bei verfügbarem Magnetometer (`webkitCompassHeading` iOS / `alpha` mit
  `absolute=true` Android): **Cross-Check** alle 5s — wenn Bias-Drift > 10°:
  User-Hint „Recalibrate". Hinweis: iOS `webkitCompassHeading` braucht
  HTTPS + user-gesture-chained Permission, sonst silent-null.
- Sonst: nur Gyro, akzeptiert wegen Bucket-Robustheit

**Direction-Lock (Reverse-Detection):**
- Erste 5° werden über mindestens 3 Yaw-Samples gemittelt um Sensor-Noise
  von echter User-Bewegung zu trennen
- Nach 3 konsekutiven Frames mit gleicher Direction (>2°/Frame, alle gleiches
  Vorzeichen): Direction locked
- Reverse-Detection: 3 konsekutive Frames mit entgegengesetztem Vorzeichen
  → User-Hint „⚠ Bewege weiter im selben Drehsinn"
- Pause-Resume: bei Resume → Direction-Lock bleibt erhalten, kein Re-Probing

**Visual-Guide (Live-Overlay):**
- Vollkreis-Indikator mit 12 Bucket-Slices
  - Leer: grau
  - 1-2 Frames: gelb
  - ≥3 Frames: grün
- Live-Phone-Position-Marker zeigt aktuellen Yaw in Bucket
- Direction-Indicator: ↻ oder ↺ je nach lock-in-Direction
- Frame-Counter: „32 / 30 minimum, Buckets 8/9"
- Quality-Indicator pro letzter Frame: ✓ akzeptiert / ✗ rejected (mit Reason)

### State 5: Review
- Grid mit Thumbnails aller akzeptierten Frames
- Pro Frame: Quality-Score-Badge + Yaw-Position
- Tap auf Frame → vergrößert + „Ersetzen"-Option (lokal nochmal aus
  Live-Stream — startet Orbit erneut für diesen Bereich; Phase 2 kann das
  per-Frame-Retake bauen)
- **Submit-Button** aktiviert nur wenn ≥30 Frames UND 9-von-12 konsekutive
  Buckets gefüllt (gleicher Gate wie in State 4 Orbit-Capture)
- Cancel-Button: alle Object-URLs revoken, Blobs clearen, state reset

### State 6: Submit
- Aufruf des Parent-onSubmit-Callbacks mit `Frame[]`-Array (Blob + Metadata)
- Hand-off zur Edge Function (Phase 2 — nicht hier)
- Reset State auf Idle

## Datei-Layout

```
src/components/scan/
├── PhotogrammetryCapture.tsx       # State-Machine-Orchestrator
├── ProbeScreen.tsx                  # State 1
├── PermissionGate.tsx               # State 2
├── CalibrationScreen.tsx            # State 3
├── OrbitCaptureView.tsx             # State 4
├── OrbitGuideOverlay.tsx            # SVG: Halbkreis + Position
├── ReviewScreen.tsx                 # State 5
└── CapabilityErrorScreen.tsx        # Fallback-Branch

src/hooks/scan/
├── useCameraStream.ts               # getUserMedia mit Multi-Tier-Retry + cleanup
├── useDeviceOrientation.ts          # cross-browser gyro mit calibration
├── useStillnessDetector.ts          # angular-velocity tracking
├── usePoseTracker.ts                # bucket-coverage, direction-enforcement
└── useFrameQuality.ts               # blur + brightness via Worker

src/lib/scan/
├── orientation.ts                   # quaternion/euler math, normalize
├── calibration.ts                   # yaw-zero offset-application
├── poseBuckets.ts                   # 12-bucket × 30° coverage logic + consecutive-fill check
├── captureFrame.ts                  # OffscreenCanvas + Web-Worker-Pipeline
├── kiriContract.ts                  # max-frame-count, max-payload, validation
└── quality.worker.ts                # Web-Worker: Laplacian-Variance + Brightness
```

## Kritische Implementations-Details

### Permission-Flow (iOS user-gesture, synchronous Code-Sample)
```ts
async function onStartClick() {
  // 1. iOS-specific motion permission MUSS hier sein (gesture-chain)
  if ('requestPermission' in DeviceOrientationEvent) {
    const motionPerm = await DeviceOrientationEvent.requestPermission();
    if (motionPerm !== 'granted') {
      return showError("Bewegungssensor erforderlich. Ohne den können wir nicht scannen. Bitte in Safari-Settings → Bewegung & Lage erlauben.");
    }
  }
  // 2. Camera mit Multi-Tier-Constraint-Retry (siehe State 2 Plan-Sektion)
  const tiers = [
    { width: { ideal: 1920 }, height: { ideal: 1080 } },
    { width: { ideal: 1280 }, height: { ideal: 720 } },
    { width: { ideal: 960 }, height: { ideal: 540 } },
  ];
  let stream: MediaStream | null = null;
  for (const tier of tiers) {
    const candidate = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, ...tier },
      audio: false,
    });
    videoEl.srcObject = candidate;
    await videoEl.play();
    if (videoEl.videoWidth >= 960 && videoEl.videoHeight >= 540) {
      stream = candidate;
      break;
    }
    candidate.getTracks().forEach(t => t.stop());
  }
  if (!stream) return showError("Kamera-Auflösung zu niedrig (< 960×540). Bitte aktuelles Phone nutzen.");

  // 3. Sensor-Probe (2s timeout) — hard-abort, kein Manual-Mode
  const sensorOk = await probeSensors(2000);
  if (!sensorOk) {
    stream.getTracks().forEach(t => t.stop());
    return showError("DeviceOrientation liefert keine Events. Bitte aktuellen Safari/Chrome nutzen.");
  }
  advanceState('calibrate');
}
```

### Quality-Gates pro Frame (Web-Worker, NICHT Main-Thread)

**Architektur:** Main-Thread captured Frame als Blob → posted zum Worker
→ Worker scored → Main-Thread accept/reject. Off-main-thread weil
Laplacian auf jedem Frame-Sample sonst Video-Preview blockt.

```ts
// quality.worker.ts — läuft im Web-Worker
const HAS_OFFSCREEN = typeof OffscreenCanvas !== 'undefined';

self.onmessage = async (e: MessageEvent<{ blob: Blob; id: number }>) => {
  const { blob, id } = e.data;
  const bitmap = await createImageBitmap(blob);

  // OffscreenCanvas-Pfad (iOS Safari 16.4+ / Android Chrome modern)
  // Fallback-Pfad: createImageBitmap funktioniert in jedem modernen Worker,
  // wir können stattdessen einen ImageData-Buffer manuell allozieren via
  // postMessage zurück zum Main-Thread für Canvas-Rendering. Das wäre
  // suboptimal performance-mäßig — aber der Hard-Abort in State 2 (Sensor-
  // Probe) würde sehr alte Browser eh ablehnen, also OffscreenCanvas
  // sollte immer verfügbar sein. Wenn nicht: fallback in main-thread.
  let imgData: ImageData;
  if (HAS_OFFSCREEN) {
    const canvas = new OffscreenCanvas(320, 240);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, 320, 240);
    imgData = ctx.getImageData(0, 0, 320, 240);
  } else {
    // Fallback-Plan: posten back to main thread für Quality-Scoring
    self.postMessage({ id, requiresMainThreadFallback: true });
    return;
  }

  const blurScore = laplacianVariance(imgData);  // ~150 ok, ~300 good
  const brightness = averageLuminance(imgData);  // [40, 230] of 255

  self.postMessage({ id, blurScore, brightness });
};
```

**Main-Thread-Fallback** (für Browser ohne OffscreenCanvas-im-Worker): falls
Worker `requiresMainThreadFallback: true` zurück sendet, scored Main-Thread
mit regular Canvas. Performance-Hit auf low-end aber funktional.

**Threshold-Tuning:** Blur-Threshold (~150) ist Spike-Tag-1-Calibration.
Echte Captures aus dem Spike → empirische Verteilung → Threshold setzen.

**OffscreenCanvas-Support:** iOS Safari ab 16.4 (Apr 2023), Android Chrome
seit 2018. Bei fehlendem Support: Fallback auf regular Canvas im Worker
via `createImageBitmap` (alle modernen Browser ≥ Safari 15).

**Brightness-Range [40, 230]:** Erweitert von [50, 200] für outdoor +
helle Räume mit weißen Socken/Skin (mean luminance kann legit 220+ hitten).

**Blob-Transfer-Overhead:** Pro Frame ~500KB Transfer in Worker. Bei
250ms-Sample-Cadence = 2MB/s. iOS-Safari kann das, getestet.

### Lifecycle-Contracts
```ts
// useCameraStream
useEffect(() => {
  let active = true;
  let stream: MediaStream | null = null;
  navigator.mediaDevices.getUserMedia(constraints).then(s => {
    if (!active) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;
    videoRef.current.srcObject = s;
  });
  return () => {
    active = false;
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };
}, [constraints]);

// Object-URL handling in ReviewScreen — capture-then-revoke um Stale-Closure
// zu vermeiden (Gemini v2 review #5)
function useObjectUrls(frames: Frame[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const newUrls = frames.map(f => URL.createObjectURL(f.blob));
    setUrls(newUrls);
    return () => {
      // Revoke EXACTLY this batch — newUrls in closure, nicht der nächste
      newUrls.forEach(URL.revokeObjectURL);
    };
  }, [frames]);
  return urls;
}
```

### KIRI-Acceptance-Criteria (für Phase-2-Übergabe dokumentiert)

> **Source:** https://docs.kiriengine.app/ Stand 2026-05. Diese Werte VOR
> Phase-1-Implementation gegen die aktuelle KIRI-Doc verifizieren — API
> könnte sich geändert haben. Bei Abweichung diesen Plan updaten.

- **Min/Max Frames pro Scan: 20-300** (laut KIRI-Doc Photogrammetry-Endpoint)
- Wir senden 30-60 → solid in der Mitte
- Max Image Size: KIRI akzeptiert bis 4096×4096; wir liefern max 1920×1080 → sicher
- Format: JPEG empfohlen (kleinere Payload), PNG akzeptiert
- Wir senden JPEG quality 0.92, mit per-Frame-Cap 1.5MB (re-encode bei größer)
- Total-Payload-Cap: aus KIRI-Docs nicht hart spezifiziert; wir cappen
  client-side auf ~50MB (60 × 800KB worst-case) — bei Bedarf chunked-upload
- **Failure-Modes Phase 2 muss handlen:**
  - 4xx invalid input → user-message + retake-Option
  - 5xx server-error → 3× retry mit exponential backoff (1s, 2s, 4s)
  - Rate-limit (429) → respect Retry-After-Header
  - Reconstruction-Fail (KIRI returns failed-state) → fallback auf alte
    2-Foto-Pipeline mit User-Message „Photogrammetry hat nicht geklappt,
    nutzen wir den klassischen Scan"
  - Tier-Limit-erreicht (Free-Tier 3 Scans/Woche) → User-Message + Wartezeit

## Edge-Cases (vollständige Liste)

| Case | Handling |
|---|---|
| Kamera-Permission denied | Error-Page + Settings-Hint |
| Motion-Permission denied (iOS) | Hard-Error mit Hint zum Re-Granuieren in iOS-Settings |
| Browser ohne getUserMedia | Error: „Bitte aktuellen Browser nutzen" |
| Camera-Resolution < 960×540 nach 3-Tier-Retry | Error + Hint „Bessere Kamera oder neueres Phone" |
| Keine DeviceOrientation-Events in 2s | Hard-Abort (kein Manual-Mode mehr — würde unbrauchbar für KIRI) |
| Calibration-Stillness nicht erreicht in 8s, 3× | Error-State „Probier später nochmal" |
| Yaw-Magnetometer-Drift > 10° vs Gyro | Recalibrate-Hint |
| User reverse-direction im Orbit | Hint „weiter im selben Drehsinn", Frames droppen |
| User unterbricht Orbit (z. B. App switch) | onPause → state preserve, Resume-Button |
| Memory-Pressure (60 Blobs ≈ 50MB worst-case) | Hard-Cap bei 60, blob-cleanup auf submit/cancel |
| Tab-Switch mid-Capture | Pause-State, onfocus → Resume-Button |
| Stream-Track abrupt beendet | Re-init oder Error-State mit klarem Hint |
| Brightness < 40 oder > 230 | Frames-Reject, „Mehr Licht / weniger direktes Sonnenlicht" Hint |
| Foot/A4 nicht sichtbar im Bild | Phase 2 (OpenCV.js Live-Detection) — v1 trust + KIRI post-hoc-validate |
| Portrait vs Landscape | Force Portrait via screen.orientation.lock() wo möglich (silent-fail iOS Safari ohne Fullscreen) |
| Camera Focus-Lock auf Hintergrund | navigator-API: focusMode 'continuous' wenn supported |
| Thermal-Throttling (iPhone caps FPS bei Warm-Phone) | Toleranter Frame-Rate-Threshold; bei < 4Hz Sample-Rate: Hint „Phone abkühlen lassen" |
| **Eingehender Anruf** | iOS pausiert Camera-Stream automatisch; onPause behandelt das |
| **Audio-Focus-Grab** (z. B. Spotify startet) | Camera-Stream bleibt aktiv normalerweise; falls nicht, Resume-Prompt |
| **Screen-Rotation während Capture** | screen.orientation.lock() versucht Portrait zu erzwingen; falls fail: Capture neu starten |
| **Low-Battery-Modus** | iOS reduziert Performance — Toleranter Frame-Rate-Threshold |
| **DeviceOrientation events alpha/beta/gamma null IMMER** (Sensor-Probe-Phase) | Hard-Abort mit klarem Browser-Hint |
| **DeviceOrientation events sporadisch null** (mid-capture) | Frame-Skip pro betroffenem Sample; nicht abort, ride out |

## Test-Plan

### Unit-Tests (Vitest)
- `lib/scan/orientation.ts`: euler↔quaternion, normalize, calibration-offset-apply
- `lib/scan/quality.ts`: laplacian-variance auf bekannten Test-Bildern (sharp + blurry); brightness-edge-cases
- `lib/scan/calibration.ts`: stillness-detector, baseline-locking
- `lib/scan/kiriContract.ts`: payload-validation

### Integration-Tests (Vitest + RTL)
- `useStillnessDetector`: 100ms windows, threshold-edges
- `usePoseTracker`: emit gyro events, verify bucket-fill + direction-enforcement + reverse-rejection
- `PhotogrammetryCapture`: state-transitions probe→permission→calibrate→capture→review

### Manual-Tests (Pflicht — keine Auto-Tests möglich)
- iPhone Safari (iOS 16+): Permission-Flow, Sensor-Quality, Camera-Resolution, Frame-Capture, Orbit-Coverage
- iPhone Safari (iOS 18+): selber Flow nochmal
- Android Chrome (latest): selber
- Niedrig-budget Phone (alt iPhone SE / Galaxy A50): Performance, Frame-Rate
- Permission-Denied-Flows: jede Branch durchspielen
- Resolution-Reject-Flow: erzwinge niedrige Resolution
- Calibration-Move-Flow: bewege Phone während Calibration

### Validation gegen Phase-0-Ground-Truth
- 3× Captures vom selben Fuß
- Frames durch KIRI (Phase 2) → Mesh
- Mesh-Maße extrahieren (Phase 3) → Vergleich mit Schuhladen-Werten
- Bei ≤±3mm: Spike grün, vollen Build commiten

## Definition-of-Done

- [ ] State-Machine läuft fehlerfrei probe→submit auf iOS Safari + Android Chrome
- [ ] Resolution-Check verhindert garbage input
- [ ] Calibration zeroet Yaw-relative-Origin nachweisbar (logs); Floor-Tilt-Frame ist explizit NICHT Ziel (KIRI-SfM provides world-frame)
- [ ] Quality-Gates filtern blur+dunkel zuverlässig (≥20% reject in schlechtem Licht-Test)
- [ ] Object-URLs werden revoked (Browser-DevTools-Memory-Snapshot zeigt 0 Leaks)
- [ ] Camera-Tracks gestoppt bei unmount (DevTools "Audio/Video"-Indicator-Test)
- [ ] Hard-Error-Pfad funktioniert wenn DeviceMotion oder Camera fehlt (klare Fehlermeldungen)
- [ ] Build + Lint + Tests grün
- [ ] Multi-Model-Review 3/3 ten

## Decision-Punkte (entschieden in v3)

| # | Frage | v3-Decision | Begründung |
|---|---|---|---|
| 1 | Yaw-Strategie | **Calibration-relative + Bucket-Coverage** (nicht Yaw-Total) | Bucket-System macht Drift irrelevant |
| 2 | Frame-Anzahl | **30-60 continuous burst, KIRI 20-300 range** | Korrigiert v2 (war 70/200 falsch) |
| 3 | Capture-Pattern | **Continuous orbit mit Direction-Lock** | Reverse-Direction wäre useless redundant coverage |
| 4 | Calibration | **Gravity-basiert, Phone in Start-Pose stillstehend** | A4-flat misst nur Papier, nicht relevant für Capture-Frame |
| 5 | Resolution-Strategie | **3-Tier-Retry 1080p → 720p → 540p, dann reject** | Statt Hard-Abort graceful degrade |
| 6 | Permission-Order | **DeviceMotion FIRST, dann Camera Multi-Tier** | iOS gesture-chain-Pflicht |
| 7 | Quality-Gating | **Worker-basiert, Blur+Brightness, expanded range** | Off-main-thread für Performance |
| 8 | Fallback | **Hard-Abort wenn Capabilities fehlen** (kein Manual-Mode) | Manual-Mode würde unsubmittable Output produzieren |
| 9 | Coverage-Metric | **Bucket-Coverage 9/12 von 30°-Segmenten konsekutiv = 270°** | Statt Yaw-Total der drift-akkumuliert |
| 10 | Per-Frame-Size-Cap | **JPEG ≤ 1.5MB, re-encode wenn größer** | Verhindert Outlier-Frames die Payload sprengen |

## Risiken (v3)

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| iOS gibt < 1280×720 ohne Workaround | Mittel | Hoch | Explizit erkennen, abort, klarer Hint. Phase 2 könnte adaptive lower-res-Branch bauen |
| Blur-Score-Threshold falsch kalibriert | Hoch | Mittel | Phase-1-Spike: realistische Captures + Threshold tunen |
| Orbit-Coverage in 30s unrealistisch (User zu langsam) | Mittel | Mittel | Soft-Limit 60s, kein Hard-Timeout |
| KIRI rejekt < 30 Frames | Niedrig | Hoch | Submit-Gate mind. 30 Frames + Yaw-Coverage 270° |
| User-Hand zittert → viele Frames blur-rejected | Hoch | Mittel | „Halt das Telefon mit zwei Händen" Hint, lokales Rate-Limit |
| Calibration-Frame-Lag (User klickt zu früh) | Mittel | Mittel | Visual-Confirm erst wenn 1.5s stillness echt durch |
| Drift-Detection-Trigger zu sensitiv | Niedrig | Niedrig | Threshold post-Spike tunen |

## Was kann schief gehen

Das größte Restrisiko: **iOS Safari benimmt sich anders als Chrome auf
Android.** Konkret-known issues:
- DeviceOrientation events kommen mit weniger Hz als auf Android
- Camera-Constraints werden silent ignored
- Permission-Prompts können den User-Gesture-Chain unterbrechen wenn unter
  bestimmten Conditions
- Object-URL-Memory-Pressure kommt früher

Mitigation: **Spike-Tag-1 ist Tests auf echten iOS-Devices** (deinem +
Cofounder iPhones), nicht in Simulator. Wenn iOS-Safari die Capabilities
nicht liefert: User wird auf neueren Browser/Phone hingewiesen — kein
Manual-Mode-Fallback (würde unsubmittable Output produzieren).

---

**Nächster Schritt:** Plan v2 nochmal an Gemini + Codex zur Re-Review.
Wenn 3/3 ten, geht's an Implementation. Wenn weiter < 10/10, iterate v3.
