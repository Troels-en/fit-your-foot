import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SiteLayout from "@/components/SiteLayout";
import { fetchAllShoes, type ShoeRow } from "@/lib/shoeQueries";
import { useFitProfile } from "@/hooks/useFitProfile";
import { scoreShoe } from "@/lib/matching";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PLACEHOLDER = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400";

export default function Catalog() {
  const { data: shoes, isLoading } = useQuery({ queryKey: ["shoes"], queryFn: fetchAllShoes });
  const { profile } = useFitProfile();
  const [brand, setBrand] = useState<string>("all");

  const brands = useMemo(() => {
    const set = new Set<string>();
    shoes?.forEach((s) => s.brand_name && set.add(s.brand_name));
    return ["all", ...Array.from(set).sort()];
  }, [shoes]);

  const enriched = useMemo(() => {
    if (!shoes) return [];
    const rows = shoes
      .filter((s) => brand === "all" || s.brand_name === brand)
      .map((shoe) => ({
        shoe,
        match: profile ? scoreShoe(profile, shoe) : null,
      }));
    if (profile) rows.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
    return rows;
  }, [shoes, brand, profile]);

  return (
    <SiteLayout>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Laufschuh-Katalog</h1>
            <p className="text-muted-foreground mt-1">
              {profile
                ? "Sortiert nach Passform für dein Profil."
                : "Scanne deine Füße um persönliche Passform-Scores zu sehen."}
            </p>
          </div>
          {!profile && (
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/scan">Füße scannen</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                brand === b
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:border-foreground"
              }`}
            >
              {b === "all" ? "Alle Marken" : b}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enriched.map(({ shoe, match }) => (
              <ShoeCard key={shoe.id} shoe={shoe} score={match?.score ?? null} band={match?.band ?? null} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function ShoeCard({
  shoe,
  score,
  band,
}: {
  shoe: ShoeRow;
  score: number | null;
  band: "great" | "ok" | "poor" | null;
}) {
  const bandColor =
    band === "great" ? "bg-[hsl(var(--fit-great))]" :
    band === "ok" ? "bg-[hsl(var(--fit-decent))]" :
    band === "poor" ? "bg-[hsl(var(--fit-poor))]" : "";
  return (
    <Link
      to={`/shoes/${shoe.slug}`}
      className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-elevated)] transition"
    >
      <div className="aspect-square bg-muted overflow-hidden">
        <img
          src={shoe.image_url ?? PLACEHOLDER}
          alt={shoe.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{shoe.brand_name}</div>
            <div className="font-semibold truncate">{shoe.name}</div>
          </div>
          {score != null && (
            <div className={`shrink-0 px-2 py-1 rounded-full text-xs font-bold text-white ${bandColor}`}>
              {score}%
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{shoe.category ?? "Running"}</span>
          {shoe.heel_drop_mm != null && <span>{shoe.heel_drop_mm}mm Drop</span>}
        </div>
      </div>
    </Link>
  );
}
