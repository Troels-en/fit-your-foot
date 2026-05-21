import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Heart, Star, Check, Footprints, Sparkles } from "lucide-react";
import KellerHeader from "@/components/KellerHeader";
import FitlyWidget from "@/components/FitlyWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { fetchShoeBySlug } from "@/lib/shoeQueries";
import { createSession } from "@/lib/api";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";

const KELLER_RED = "#E30613";
const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900";

const DEFAULT_SIZES = [40, 41, 42, 43, 44, 45, 46];

type PendingAction =
  | { kind: "size"; size: number }
  | { kind: "cart" }
  | null;

export default function RetailerProduct() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const clientToken = searchParams.get("t");
  const navigate = useNavigate();

  const [size, setSize] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const { data: shoe, isLoading, isError } = useQuery({
    queryKey: ["shoe", slug],
    queryFn: () => fetchShoeBySlug(slug!),
    enabled: !!slug,
  });

  const { session, status } = useSessionRealtime(sessionId, clientToken);
  const isComplete = status === "complete";
  const recommendedSize =
    isComplete && session?.eu_size != null ? Number(session.eu_size) : null;

  // Pre-select the recommended size once the scan completes (only if user hasn't picked one)
  useEffect(() => {
    if (recommendedSize != null && size == null) {
      setSize(recommendedSize);
    }
  }, [recommendedSize, size]);

  useEffect(() => {
    const id = "google-fonts-inter";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const sizes: number[] = (shoe?.available_sizes as number[] | null | undefined) ?? DEFAULT_SIZES;
  const heroImg = shoe?.image_url ?? PLACEHOLDER_IMG;

  const scrollToWidget = () => {
    document
      .getElementById("fitly-widget")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startFitCheck = async (forceNew = false) => {
    if (!shoe) return;
    // If already complete, just scroll to results
    if (isComplete && !forceNew) {
      scrollToWidget();
      return;
    }
    try {
      setStarting(true);
      const mobileNow =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 768px)").matches;

      // Desktop: open modal immediately with spinner, create session in background
      if (!mobileNow) {
        setShowQrModal(true);
      }

      const { session_id, client_token } = await createSession({
        shoe_slug: shoe.slug,
        brand_id: shoe.brand_id ?? null,
      });
      const tokenParam = client_token ? `&t=${client_token}` : "";
      if (mobileNow) {
        navigate(`/scan/${session_id}?returnTo=/produkt/${shoe.slug}${tokenParam}`);
        return;
      }
      // Desktop: store session in URL & open QR modal
      const next = new URLSearchParams(searchParams);
      next.set("session", session_id);
      if (client_token) next.set("t", client_token);
      setSearchParams(next, { replace: true });
    } catch (e) {
      console.error("createSession failed", e);
      setShowQrModal(false);
    } finally {
      setStarting(false);
    }
  };

  const handleSizeClick = (s: number) => {
    if (!isComplete) {
      setPendingAction({ kind: "size", size: s });
      return;
    }
    setSize(s);
  };

  const handleAddToCart = () => {
    if (!isComplete) {
      setPendingAction({ kind: "cart" });
      return;
    }
    console.log("Add to cart", { shoe: shoe?.slug, size });
  };

  const skipPending = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "size") {
      setSize(pendingAction.size);
    } else {
      console.log("Add to cart", { shoe: shoe?.slug, size });
    }
    setPendingAction(null);
  };

  const confirmStartFromDialog = async () => {
    setPendingAction(null);
    await startFitCheck();
  };

  const handleRescan = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("session");
    setSearchParams(next, { replace: true });
    startFitCheck(true);
  };

  return (
    <div
      className="min-h-screen bg-white text-neutral-900"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <KellerHeader />

      <div className="max-w-7xl mx-auto px-4 py-4">
        <nav className="flex items-center gap-2 text-xs text-neutral-500">
          <a href="#" className="hover:text-neutral-900">Home</a>
          <ChevronRight className="h-3 w-3" />
          <a href="#" className="hover:text-neutral-900">Laufschuhe</a>
          <ChevronRight className="h-3 w-3" />
          <span className="text-neutral-900">{shoe?.name ?? "…"}</span>
        </nav>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-16">
        {isError || (!isLoading && !shoe) ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold mb-2">Produkt nicht gefunden</h1>
            <p className="text-neutral-600 mb-6">
              Den Schuh „{slug}" haben wir leider nicht im Sortiment.
            </p>
            <Link
              to="/produkt/nike-vaporfly-4"
              className="inline-block px-6 py-3 rounded-full bg-neutral-900 text-white font-semibold hover:bg-neutral-800"
            >
              Zurück zum Demo-Schuh
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <div className="aspect-square rounded-xl bg-neutral-50 overflow-hidden">
                {isLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : (
                  <img src={heroImg} alt={shoe!.name} className="w-full h-full object-cover" />
                )}
              </div>
            </div>

            <div>
              {isLoading || !shoe ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 w-32 mt-6" />
                </div>
              ) : (
                <>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">
                    {shoe.brand_name}
                  </div>
                  <h1 className="text-3xl font-bold mt-1">{shoe.name}</h1>

                  {/* Above-the-fold Fitly badge */}
                  <div className="mt-3">
                    <button
                      onClick={() => (isComplete ? scrollToWidget() : startFitCheck())}
                      disabled={starting}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60"
                    >
                      <Footprints className="h-3.5 w-3.5" />
                      {isComplete ? "Passform-Check ansehen" : "Passform-Check verfügbar"}
                    </button>
                  </div>

                  <p className="text-sm text-neutral-600 mt-3">
                    {shoe.gender} · {shoe.category}
                    {shoe.subcategory ? ` · ${shoe.subcategory}` : ""}
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className="h-4 w-4"
                          fill={i <= 4 ? "#facc15" : "none"}
                          color={i <= 4 ? "#facc15" : "#d4d4d4"}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">4,6</span>
                    <span className="text-sm text-neutral-500">(142 Bewertungen)</span>
                  </div>

                  <div className="mt-6">
                    <div className="text-2xl font-bold">
                      {shoe.price_eur != null ? `${Number(shoe.price_eur).toFixed(2)} €` : "—"}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">inkl. MwSt., zzgl. Versand</div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-sm font-semibold">Größe (EU)</div>
                      {recommendedSize != null ? (
                        <div className="inline-flex items-center gap-1 text-sm text-green-700 font-medium">
                          <Check className="h-4 w-4" />
                          Fitly empfiehlt Größe {recommendedSize}
                        </div>
                      ) : (
                        <button
                          onClick={() => startFitCheck()}
                          disabled={starting}
                          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 hover:underline disabled:opacity-60"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Fitly-Größenvorschlag aktivieren
                        </button>
                      )}
                    </div>
                    {sizes.length === 0 ? (
                      <p className="text-sm text-neutral-500">Keine Größen verfügbar.</p>
                    ) : (
                      <div className="grid grid-cols-5 gap-2">
                        {sizes.map((s) => {
                          const isRecommended = recommendedSize != null && s === recommendedSize;
                          const isSelected = size === s;
                          return (
                            <div key={s} className="relative">
                              <button
                                onClick={() => handleSizeClick(s)}
                                className={`relative w-full h-11 border bg-white text-sm font-semibold transition ${
                                  isSelected
                                    ? "border-neutral-900 ring-1 ring-neutral-900"
                                    : "border-neutral-300 hover:border-[#E30613] hover:text-[#E30613]"
                                } ${isRecommended ? "ring-2 ring-green-500 border-green-500" : ""}`}
                              >
                                {s}
                              </button>
                              {isRecommended && (
                                <span className="absolute -top-2 -right-1 bg-green-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                                  Empf.
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="h-12 rounded font-semibold text-white transition"
                      style={{ backgroundColor: KELLER_RED }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#c00511")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = KELLER_RED)}
                    >
                      In den Warenkorb
                    </button>
                    <button className="h-12 rounded border border-neutral-900 font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-50">
                      <Heart className="h-4 w-4" /> Auf die Wishlist
                    </button>
                  </div>

                  <ul className="mt-6 space-y-2 text-sm">
                    {["Versandkostenfrei ab 50€", "30 Tage Rückgaberecht", "Bestpreis-Garantie"].map(
                      (b) => (
                        <li key={b} className="flex items-center gap-2 text-neutral-700">
                          <Check className="h-4 w-4 text-green-600" /> {b}
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {shoe && (
          <div className="mt-12">
            <FitlyWidget
              shoe={shoe}
              sessionId={sessionId}
              session={session}
              status={status}
              onStartCheck={startFitCheck}
              onRescan={handleRescan}
              starting={starting}
              showQrModal={showQrModal}
              onCloseQrModal={() => setShowQrModal(false)}
            />
          </div>
        )}

        {shoe && (
          <div className="mt-12">
            <Tabs defaultValue="desc">
              <TabsList className="bg-transparent border-b border-neutral-200 rounded-none w-full justify-start gap-6 h-auto p-0">
                <TabsTrigger
                  value="desc"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-base"
                >
                  Beschreibung
                </TabsTrigger>
                <TabsTrigger
                  value="tech"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-base"
                >
                  Technische Daten
                </TabsTrigger>
              </TabsList>
              <TabsContent value="desc" className="pt-6 text-neutral-700 leading-relaxed max-w-3xl">
                {shoe.brand_name} {shoe.name} — {shoe.category}
                {shoe.passform ? ` mit ${shoe.passform}-Passform.` : "."}
              </TabsContent>
              <TabsContent value="tech" className="pt-6 text-neutral-700 max-w-3xl">
                <ul className="space-y-2">
                  {shoe.weight_g && <li><strong>Gewicht:</strong> {shoe.weight_g} g</li>}
                  {shoe.heel_drop_mm != null && <li><strong>Sprengung:</strong> {shoe.heel_drop_mm} mm</li>}
                  {shoe.width_grade && <li><strong>Weite:</strong> {shoe.width_grade}</li>}
                  {shoe.toebox && <li><strong>Zehenbox:</strong> {shoe.toebox}</li>}
                  {shoe.width_mm && <li><strong>Leisten-Ballenbreite:</strong> {shoe.width_mm} mm</li>}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="bg-neutral-900 text-neutral-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-neutral-500 text-center">
          © Keller Sports GmbH
        </div>
      </footer>

      {/* Pre-action confirmation dialog */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Passt dieser Schuh wirklich zu dir?</DialogTitle>
            <DialogDescription className="pt-2">
              Fitly macht einen 60-Sekunden-Passform-Check und zeigt dir, ob die
              Leisten-Geometrie zu deiner Fuß-Anatomie passt — oder ob eine andere
              Größe / ein anderer Schuh besser wäre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
            <button
              onClick={confirmStartFromDialog}
              disabled={starting}
              className="w-full h-11 rounded-md bg-neutral-900 text-white font-semibold hover:bg-neutral-800 disabled:opacity-60"
            >
              Ja, Passform-Check starten
            </button>
            <button
              onClick={skipPending}
              className="w-full h-11 rounded-md border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
            >
              Nein, überspringen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
