/**
 * Detection des Scan-Capability-Levels für das aktuelle Device.
 *
 * Wir unterscheiden 3 Tiers:
 *  - "lidar"     — WebXR + Depth-Sensing-API + Apple-LiDAR-Device. Premium-
 *                  Pfad mit ±0.5mm Genauigkeit (TODO: Capture-Pfad in Sprint 6.5)
 *  - "webxr-ar"  — WebXR ohne Depth (Android Chrome ARCore). Mid-Tier;
 *                  könnte irgendwann mit ML-Depth-Inferenz arbeiten.
 *  - "photogrammetry" — Default-Fallback. Aktueller Hand-Held-Capture-Flow
 *                  via Camera + Gyro + KIRI.
 *
 * Detection läuft async weil WebXR-Support-Checks Promises returnen. Cached
 * für die Lebenszeit der Page (Capabilities ändern sich nicht zur Laufzeit).
 */

export type ScanTier = "lidar" | "webxr-ar" | "photogrammetry";

export type ScanCapabilities = {
  tier: ScanTier;
  webxrAvailable: boolean;
  immersiveArSupported: boolean;
  depthSensingSupported: boolean;
  /** UA-basierte Heuristik: ist's ein iPhone Pro / iPad Pro mit LiDAR? */
  appleLidarLikely: boolean;
  /** Klartext für UI-Display ("iPhone 14 Pro · LiDAR verfügbar"). */
  display: string;
};

let cached: ScanCapabilities | null = null;

/** Heuristik: iPhone Pro/iPad Pro 2020+ haben LiDAR. UA gibt nur "iPhone"
 *  ohne Modell-Generation, also matchen wir auf "iPhone" + iOS 14+ und
 *  hoffen das stimmt. False positive ist ok (User sieht "Premium" Badge
 *  obwohl no-LiDAR; bei tatsächlichem capture fallen wir auf
 *  Photogrammetry zurück). */
function checkAppleLidarLikely(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/iPhone|iPad/.test(ua)) return false;
  // iOS 14+ erforderlich für WebXR / Depth-API
  const iosVersion = ua.match(/OS (\d+)_(\d+)/);
  if (!iosVersion) return false;
  return parseInt(iosVersion[1], 10) >= 14;
}

export async function detectScanCapabilities(): Promise<ScanCapabilities> {
  if (cached) return cached;

  let webxrAvailable = false;
  let immersiveArSupported = false;
  // Depth-Sensing-Probe via requestSession() würde User-Permission-Prompt
  // auslösen schon beim Page-Load — schlechte UX. Wir bleiben bei
  // isSessionSupported() (passiv, kein Prompt). depthSensingSupported wird
  // erst geklärt wenn User aktiv den Premium-Pfad startet (späterer Sprint).
  const depthSensingSupported = false;
  const appleLidarLikely = checkAppleLidarLikely();

  if (typeof navigator !== "undefined" && "xr" in navigator) {
    webxrAvailable = true;
    try {
      const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
      if (xr) {
        immersiveArSupported = await xr.isSessionSupported("immersive-ar");
      }
    } catch {
      immersiveArSupported = false;
    }
  }

  // Tier-Bestimmung ohne Session-Probe = nur grobe Schätzung. Solange wir
  // keinen LiDAR-Capture-Pfad haben, geben wir conservative kein "lidar"-Tier
  // raus (UA-Heuristik ist zu unzuverlässig — iPhone 11 hat keinen LiDAR
  // aber matched das User-Agent "iPhone + iOS 14+").
  // Wenn wir Sprint 6.5 implementieren, kommt hier ein echter Session-Probe
  // hin und wir können dann "lidar" assignen.
  let tier: ScanTier = "photogrammetry";
  if (immersiveArSupported) {
    tier = "webxr-ar";
  }

  const display = buildDisplay(tier, appleLidarLikely);

  cached = {
    tier,
    webxrAvailable,
    immersiveArSupported,
    depthSensingSupported,
    appleLidarLikely,
    display,
  };
  return cached;
}

function buildDisplay(tier: ScanTier, lidar: boolean): string {
  switch (tier) {
    case "lidar":
      return lidar
        ? "iPhone Pro / iPad Pro mit LiDAR — Premium-Scan verfügbar"
        : "WebXR + Depth-Sensing — Premium-Scan verfügbar";
    case "webxr-ar":
      return "WebXR-AR verfügbar";
    case "photogrammetry":
    default:
      return "Photogrammetry-Modus (Standard)";
  }
}

/**
 * Reset für Tests. NICHT in Production aufrufen — Capabilities sind
 * device-stable und sollten gecached bleiben.
 */
export function _resetCapabilitiesCache() {
  cached = null;
}
