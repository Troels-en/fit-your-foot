import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Footprints, Loader2, RefreshCw, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import FitChat from "@/components/FitChat";
import { fetchAllShoes, type ShoeRow } from "@/lib/shoeQueries";
import { scoreShoe, rankAlternatives, type FootMm, type MatchScore } from "@/lib/matchDb";
import { buildScanUrl } from "@/lib/scanRedirectUrls";
import type { ScanRow } from "@/lib/api";

type SessionStatus = "pending" | "scanning" | "complete" | "error";

const FitVisualization3D = lazy(() => import("./FitVisualization3D"));

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400";

const BAND_COLOR: Record<MatchScore["band"], string> = {
  great: "#10b981",
  ok: "#f59e0b",
  poor: "#ef4444",
};

function productNameWithoutBrand(shoe: ShoeRow) {
  const brand = shoe.brand_name?.trim();
  const name = shoe.name.trim();
  return brand && name.toLowerCase().startsWith(brand.toLowerCase())
    ? name.slice(brand.length).trim()
    : name;
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={radius} stroke="#e5e5e5" strokeWidth="10" fill="none" />
      <circle
        cx="65"
        cy="65"
        r={radius}
        stroke={color}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 65 65)"
      />
      <text
        x="65"
        y="74"
        textAnchor="middle"
        className="fill-neutral-900"
        style={{ fontSize: "30px", fontWeight: 700 }}
      >
        {score}%
      </text>
    </svg>
  );
}

function toFoot(session: {
  foot_length_mm: number | null;
  ball_width_mm: number | null;
  heel_width_mm: number | null;
  foot_toebox_height_mm?: number | null;
  preferred_drop_mm?: number | null;
  arch_type: string | null;
  eu_size: number | null;
}): FootMm | null {
  const len = Number(session.foot_length_mm);
  const ball = Number(session.ball_width_mm);
  const heel = Number(session.heel_width_mm);
  const eu = Number(session.eu_size);
  const toeboxHeight = Number(session.foot_toebox_height_mm);
  const preferredDrop = Number(session.preferred_drop_mm);
  const arch = (session.arch_type ?? "medium") as FootMm["arch_type"];
  if (!Number.isFinite(len) || !Number.isFinite(ball) || !Number.isFinite(heel) || !Number.isFinite(eu)) {
    return null;
  }
  return {
    foot_length_mm: len,
    ball_width_mm: ball,
    heel_width_mm: heel,
    arch_type: arch === "low" || arch === "high" ? arch : "medium",
    eu_size: eu,
    ...(Number.isFinite(toeboxHeight) ? { foot_toebox_height_mm: toeboxHeight } : {}),
    ...(Number.isFinite(preferredDrop) ? { preferred_drop_mm: preferredDrop } : {}),
  };
}

export default function FitlyWidget({
  shoe,
  sessionId,
  session,
  status,
  onStartCheck,
  onRescan,
  starting = false,
  showQrModal = false,
  onCloseQrModal,
}: {
  shoe: ShoeRow;
  sessionId: string | null;
  session: ScanRow | null;
  status: SessionStatus;
  onStartCheck: () => void;
  onRescan: () => void;
  starting?: boolean;
  showQrModal?: boolean;
  onCloseQrModal?: () => void;
}) {
  const navigate = useNavigate();
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") : null;

  const envBaseUrl = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  const baseUrl =
    envBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const qrUrl = sessionId ? buildScanUrl({ sessionId, productPath: `/produkt/${shoe.slug}`, origin: baseUrl }) : "";
  const showPreviewWarning =
    !envBaseUrl &&
    typeof window !== "undefined" &&
    /lovableproject\.com$/.test(window.location.hostname);

  

  const { data: allShoes } = useQuery({
    queryKey: ["shoes-all"],
    queryFn: fetchAllShoes,
  });

  // When the mobile flow completes while QR modal is open, auto-close it
  useEffect(() => {
    if (status === "complete" && showQrModal && onCloseQrModal) {
      onCloseQrModal();
    }
  }, [status, showQrModal, onCloseQrModal]);

  const [activeShoeId, setActiveShoeId] = useState<string>(shoe.id);
  const [activeSourceShoeId, setActiveSourceShoeId] = useState<string>(shoe.id);
  useEffect(() => {
    setActiveShoeId(shoe.id);
    setActiveSourceShoeId(shoe.id);
  }, [shoe.id]);

  const isComplete = status === "complete";
  const foot = session && isComplete ? toFoot(session) : null;
  const alts =
    foot && allShoes ? rankAlternatives(foot, allShoes, shoe.id, 3) : [];
  const visibleActiveShoeId = activeSourceShoeId === shoe.id ? activeShoeId : shoe.id;
  const activeShoe = alts.find(({ shoe: alt }) => alt.id === visibleActiveShoeId)?.shoe ?? shoe;
  const match = foot ? scoreShoe(foot, activeShoe) : null;

  const changeActiveShoe = (id: string) => {
    setActiveSourceShoeId(shoe.id);
    setActiveShoeId(id);
  };

  const ringColor = match ? BAND_COLOR[match.band] : "#f59e0b";

  return (
    <section
      id="fitly-widget"
      className="border-2 border-neutral-900 rounded-2xl p-8 bg-neutral-50"
    >
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
        powered by Fitly
      </div>
      <h2 className="text-xl font-bold text-neutral-900 mb-6">Fitly Passform-Check</h2>

      {!isComplete && (
        <div className="flex flex-col items-start gap-4">
          <Footprints className="h-10 w-10 text-neutral-900" />
          <h3 className="text-2xl font-bold text-neutral-900">
            Passt dieser Schuh zu deinem Fuß?
          </h3>
          <p className="text-neutral-600 max-w-2xl">
            Wir matchen deine Fuß-Anatomie mit der Leisten-Geometrie dieses Schuhs. 60 Sekunden,
            keine App nötig.
          </p>
          <button
            onClick={onStartCheck}
            disabled={starting}
            className="mt-2 bg-neutral-900 text-white rounded-full h-12 px-8 font-semibold hover:bg-neutral-800 transition disabled:opacity-60 inline-flex items-center gap-2"
          >
            {starting && <Loader2 className="h-4 w-4 animate-spin" />}
            Passform-Check starten
          </button>
        </div>
      )}

      {isComplete && (
        <div className="flex flex-col gap-6">
          {!match ? (
            <div className="flex items-center gap-3 text-neutral-600">
              <Loader2 className="h-5 w-5 animate-spin" /> Lade Ergebnis…
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-5 gap-6 items-start">
                <div className="md:col-span-2 flex flex-col sm:flex-row md:flex-col items-start gap-4">
                  <ScoreRing score={match.score} color={ringColor} />
                  <div>
                    <div
                      className="text-sm font-semibold uppercase tracking-wide"
                      style={{ color: ringColor }}
                    >
                      {match.label}
                    </div>
                    <button
                      onClick={onRescan}
                      className="mt-2 text-sm text-neutral-600 hover:text-neutral-900 underline inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Nochmal scannen
                    </button>
                    <ul className="text-neutral-700 mt-2 list-disc pl-5 space-y-1 text-sm">
                      {match.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="md:col-span-3 w-full">
                  <Suspense
                    fallback={
                      <div className="h-[300px] flex items-center justify-center text-sm text-neutral-400 bg-white rounded-xl border border-neutral-200">
                        3D-Visualisierung lädt…
                      </div>
                    }
                  >
                    <FitVisualization3D
                      foot={foot}
                      shoe={shoe}
                      alternatives={alts}
                      activeShoeId={visibleActiveShoeId}
                      onActiveShoeChange={changeActiveShoe}
                    />
                  </Suspense>
                </div>
              </div>

              {alts.length > 0 && (
                <div>
                  <h4 className="font-bold text-neutral-900 mb-3">
                    Besser passende Alternativen:
                  </h4>
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-4 pb-3">
                      {alts.map(({ shoe: alt, match: m }) => (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() =>
                            navigate(
                              `/produkt/${alt.slug}${sessionId ? `?session=${sessionId}${token ? `&t=${token}` : ""}` : ""}`
                            )
                          }
                          onMouseEnter={() => setActiveShoeId(alt.id)}
                          onMouseLeave={() => changeActiveShoe(shoe.id)}
                          className="w-64 shrink-0 bg-white border border-neutral-200 rounded-xl p-3 text-left cursor-pointer hover:border-neutral-400 hover:ring-2 hover:ring-neutral-900/10 active:scale-[0.98] transition"
                        >
                          <div className="aspect-square bg-neutral-50 rounded-lg overflow-hidden mb-3">
                            <img
                              src={alt.image_url ?? PLACEHOLDER_IMG}
                              alt={alt.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                {alt.brand_name}
                              </div>
                              <div className="font-bold text-neutral-900 truncate">
                                {productNameWithoutBrand(alt)}
                              </div>
                              <div className="text-xs text-neutral-600 mt-1 whitespace-normal">
                                {m.reasons[0]}
                              </div>
                            </div>
                            <span className="bg-green-600 text-white text-xs font-bold rounded-full px-2 py-1 shrink-0">
                              {m.score}%
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  <p className="text-xs text-neutral-500 mt-2">
                    Klicke auf eine Alternative — deine Fußdaten nehmen wir mit, kein erneuter Scan.
                  </p>
                </div>
              )}

              {isComplete && foot && <FitChat foot={foot} currentShoe={activeShoe} />}
            </>
          )}
        </div>
      )}

      <Dialog
        open={showQrModal}
        onOpenChange={(open) => !open && onCloseQrModal?.()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Scanne mit deinem Handy</DialogTitle>
          </DialogHeader>
          {!sessionId ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              <p className="text-sm text-neutral-500">Session wird vorbereitet…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="bg-white p-4 rounded-lg border border-neutral-200">
                <QRCodeSVG value={qrUrl} size={200} />
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Warte auf Scan…
            </div>
            <p className="text-xs text-neutral-400 break-all text-center">{qrUrl}</p>
            {showPreviewWarning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 text-center">
                Hinweis: Die Preview-URL erfordert Login. Für die Live-Demo bitte in Lovable
                publizieren und <code>VITE_PUBLIC_BASE_URL</code> setzen.
              </p>
            )}
            <button
              onClick={() => onCloseQrModal?.()}
              className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
            >
              <X className="h-4 w-4" /> Abbrechen
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
