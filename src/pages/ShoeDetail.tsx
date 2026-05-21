import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { fetchShoeBySlug, fetchAllShoes } from "@/lib/shoeQueries";
import { useFitProfile } from "@/hooks/useFitProfile";
import { scoreShoe, rankShoes } from "@/lib/matching";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FeedbackWidget from "@/components/FeedbackWidget";

const PLACEHOLDER = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900";

export default function ShoeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useFitProfile();

  const { data: shoe, isLoading } = useQuery({
    queryKey: ["shoe", slug],
    queryFn: () => fetchShoeBySlug(slug!),
    enabled: !!slug,
  });

  const { data: allShoes } = useQuery({ queryKey: ["shoes"], queryFn: fetchAllShoes });

  const match = profile && shoe ? scoreShoe(profile, shoe) : null;
  const alternatives = profile && shoe && allShoes
    ? rankShoes(profile, allShoes, { excludeId: shoe.id, limit: 3 })
    : [];

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!shoe) {
    return (
      <SiteLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Schuh nicht gefunden</h1>
          <Button asChild className="mt-6"><Link to="/shoes">Zurück zum Katalog</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  const bandColor =
    match?.band === "great" ? "hsl(var(--fit-great))" :
    match?.band === "ok" ? "hsl(var(--fit-decent))" :
    match?.band === "poor" ? "hsl(var(--fit-poor))" : "hsl(var(--muted-foreground))";

  return (
    <SiteLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link to="/shoes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Katalog
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 pb-12">
        <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
          <img src={shoe.image_url ?? PLACEHOLDER} alt={shoe.name} referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
            className="w-full h-full object-cover" />
        </div>

        <div>
          <div className="text-sm text-muted-foreground uppercase tracking-wide">{shoe.brand_name}</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">{shoe.name}</h1>
          <div className="text-sm text-muted-foreground mb-6">
            {shoe.category}{shoe.subcategory ? ` · ${shoe.subcategory}` : ""}
            {shoe.weight_g ? ` · ${shoe.weight_g}g` : ""}
          </div>

          {match ? (
            <div className="rounded-2xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center gap-4 mb-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: bandColor }}
                >
                  {match.score}%
                </div>
                <div>
                  <div className="font-semibold">{match.label}</div>
                  <div className="text-xs text-muted-foreground">Basierend auf deinem letzten Scan</div>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {match.reasons.map((r, i) => <li key={i}>· {r}</li>)}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-5 mb-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Scanne deine Füße um zu sehen, ob dieser Schuh zu deiner Anatomie passt.
              </p>
              <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/scan">Jetzt scannen</Link>
              </Button>
            </div>
          )}

          <GeometryGrid shoe={shoe} />

          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {shoe.brand_url && (
              <a href={shoe.brand_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-foreground">
                Marken-Seite <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {shoe.source_url && (
              <a href={shoe.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-foreground">
                Quelle: RunRepeat <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Geometrie-Daten: {shoe.data_source ?? "runrepeat"} · Konfidenz: {shoe.geometry_confidence ?? "spec"}
          </p>
        </div>
      </div>

      {alternatives.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-bold mb-4">Besser passende Alternativen</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {alternatives.map(({ shoe: alt, fit: m }) => (
              <Link key={alt.id} to={`/shoes/${alt.slug}`}
                className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-elevated)] transition">
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={alt.image_url ?? PLACEHOLDER} alt={alt.name} loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
                    className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="text-xs text-muted-foreground">{alt.brand_name}</div>
                  <div className="font-semibold text-sm truncate">{alt.name}</div>
                  <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor:
                      m.band === "great" ? "hsl(var(--fit-great))" :
                      m.band === "ok" ? "hsl(var(--fit-decent))" : "hsl(var(--fit-poor))"
                    }}>
                    {m.score}%
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <FeedbackWidget shoeId={shoe.id} predictedScore={match?.score ?? null} scanId={profile.scan_id} clientToken={profile.client_token} />
        </div>
      )}
    </SiteLayout>
  );
}

function GeometryGrid({ shoe }: { shoe: { width_mm: number | null; heel_width_mm: number | null; heel_drop_mm: number | null; toebox: string | null; width_grade: string | null } }) {
  const items = [
    { label: "Ballenbreite", value: shoe.width_mm ? `${shoe.width_mm} mm` : "—" },
    { label: "Fersenbreite", value: shoe.heel_width_mm ? `${shoe.heel_width_mm} mm` : "—" },
    { label: "Sprengung", value: shoe.heel_drop_mm != null ? `${shoe.heel_drop_mm} mm` : "—" },
    { label: "Toebox", value: shoe.toebox ?? "—" },
    { label: "Weite", value: shoe.width_grade ?? "—" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="font-semibold tabular-nums">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
