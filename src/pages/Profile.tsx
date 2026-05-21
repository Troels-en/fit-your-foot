import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteLayout from "@/components/SiteLayout";
import { useFitProfile } from "@/hooks/useFitProfile";
import { clearProfile } from "@/lib/fitProfile";
import { Button } from "@/components/ui/button";
import MyShoesSection from "@/components/profile/MyShoesSection";
import ProfileIdentitySection from "@/components/profile/ProfileIdentitySection";
import ManualMeasurementsSection from "@/components/profile/ManualMeasurementsSection";

export default function Profile() {
  const navigate = useNavigate();
  const { profile, loading } = useFitProfile();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading || userId === undefined) {
    return (
      <SiteLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-muted-foreground">Lade…</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        {/* Header + Identity */}
        <header className="space-y-6">
          {userId && <ProfileIdentitySection userId={userId} email={email} />}
          <p className="text-sm text-muted-foreground">
            Deine Fußmaße und deine Schuh-Bewertungen — alles an einem Ort.
          </p>
        </header>

        {/* Fit-Profil-Maße */}
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight mb-4">Fit-Profil</h2>

          {!profile ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
              <h3 className="font-bold text-lg mb-1">Noch kein Profil</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Scanne deine Füße um ein Profil anzulegen.
              </p>
              <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/scan">Jetzt scannen</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Letztes Update: {new Date(profile.updated_at).toLocaleString()}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Fußlänge", value: `${profile.foot_length_mm} mm` },
                  { label: "Ballenbreite", value: `${profile.ball_width_mm} mm` },
                  { label: "Fersenbreite", value: `${profile.heel_width_mm} mm` },
                  { label: "Fußgewölbe", value: profile.arch_type },
                  { label: "EU-Größe", value: profile.eu_size },
                  ...(profile.preferred_drop_mm != null
                    ? [{ label: "Bevorzugte Sprengung", value: `${profile.preferred_drop_mm} mm` }]
                    : []),
                ].map((it) => (
                  <div key={it.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">{it.label}</div>
                    <div className="font-semibold text-lg tabular-nums">{it.value}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-5">
                <Button asChild variant="outline">
                  <Link to="/scan">Neu scannen</Link>
                </Button>
                <Button asChild>
                  <Link to="/shoes">Zum Katalog</Link>
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Profil und lokale Scan-Daten wirklich löschen?")) {
                      clearProfile();
                      window.location.reload();
                    }
                  }}
                >
                  Profil löschen
                </Button>
              </div>
            </>
          )}
          {/* Manuelle Brannock-Maße aus dem Schuhladen */}
          {userId && <ManualMeasurementsSection userId={userId} />}
        </section>

        {/* Meine Schuhe */}
        {userId ? (
          <MyShoesSection userId={userId} />
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Meine Schuhe</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Logge dich ein, um deine Schuhsammlung und Fit-Bewertungen zu speichern.
            </p>
            <Button onClick={() => navigate("/auth")} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Einloggen / Registrieren
            </Button>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}
