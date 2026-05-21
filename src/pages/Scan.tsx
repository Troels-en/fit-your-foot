import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2 } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { createSession } from "@/lib/api";
import { buildScanUrl } from "@/lib/scanRedirectUrls";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";

export default function Scan() {
  const navigate = useNavigate();
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirected, setRedirected] = useState(false);

  // Realtime: hör auf den Scan-Status. Wenn das Mobile fertig ist, navigieren
  // wir den Desktop direkt nach /profile (Polling-Fallback ist im Hook drin).
  const { status } = useSessionRealtime(sessionId, clientToken);

  // StrictMode-Guard: useEffect feuert in dev 2×. Ohne diesen Ref würden
  // pro Mount 2 scans-Rows in der DB landen.
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    let cancelled = false;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    (async () => {
      try {
        const { session_id, client_token } = await createSession({ shoe_slug: "fitly-profile" });
        if (cancelled) return;
        setSessionId(session_id);
        setClientToken(client_token ?? null);
        if (isMobile) {
          navigate(`/scan/${session_id}?returnTo=/profile${client_token ? `&t=${client_token}` : ""}`);
        } else {
          setScanUrl(buildScanUrl({ sessionId: session_id, productPath: "/profile", clientToken: client_token }));
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError("Session konnte nicht gestartet werden.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (status === "complete" && !redirected) {
      setRedirected(true);
      navigate("/profile", { replace: true });
    }
  }, [status, redirected, navigate]);

  return (
    <SiteLayout>
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold mb-3">Füße scannen</h1>
        <p className="text-muted-foreground mb-10">
          Scan den QR-Code mit deinem Smartphone. Du brauchst nur ein DIN-A4-Blatt als Größenreferenz.
        </p>

        {error ? (
          <p className="text-destructive">{error}</p>
        ) : status === "complete" ? (
          <div className="inline-flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
            <p className="font-semibold">Scan erfolgreich — leite zum Profil weiter…</p>
          </div>
        ) : status === "scanning" ? (
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Scan läuft auf deinem Handy…
          </div>
        ) : scanUrl ? (
          <div className="inline-block p-6 rounded-2xl border border-border bg-card">
            <QRCodeSVG value={scanUrl} size={240} />
            <p className="mt-4 text-xs text-muted-foreground break-all">{scanUrl}</p>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Session wird vorbereitet…
          </div>
        )}

        <ol className="mt-12 text-left max-w-md mx-auto space-y-3 text-sm">
          <li><strong>1.</strong> Lege ein leeres DIN-A4-Blatt auf den Boden.</li>
          <li><strong>2.</strong> Stelle einen Fuß mittig auf das Blatt.</li>
          <li><strong>3.</strong> Mach ein Foto von oben und eins von der Seite — die App leitet dich an.</li>
          <li><strong>4.</strong> Wiederhole für den anderen Fuß. Fertig.</li>
        </ol>
      </div>
    </SiteLayout>
  );
}
