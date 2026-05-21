import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, ListChecks, Mail } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Status = "pending" | "waitlist" | "rejected" | "approved" | "loading";

const COPY: Record<Exclude<Status, "approved" | "loading">, { title: string; lead: string; sub: string; icon: typeof Clock }> = {
  pending: {
    title: "Wir prüfen deinen Account",
    lead: "Du hast dich erfolgreich registriert. Wir schauen uns deine Anmeldung kurz an und schalten dich frei, sobald es passt.",
    sub: "Sobald freigeschaltet, schicken wir dir keine separate Mail — beim nächsten Login landest du direkt im Profil.",
    icon: Clock,
  },
  waitlist: {
    title: "Du bist auf der Warteliste",
    lead: "Wir schicken dir eine Mail sobald wir public live gehen. Versprochen, keine Spam.",
    sub: "Während der Wartezeit kannst du deinen Login behalten — sobald wir dich freischalten, ist alles direkt da.",
    icon: ListChecks,
  },
  rejected: {
    title: "Du bist auf der Warteliste",
    lead: "Aktuell läuft die geschlossene Beta — wir schicken dir eine Mail, sobald wir public live gehen.",
    sub: "Falls du Fragen hast, schreib uns gern eine Nachricht.",
    icon: ListChecks,
  },
};

export default function Warteliste() {
  const [params] = useSearchParams();
  const rawParam = params.get("status");
  const validStatuses: Status[] = ["pending", "waitlist", "rejected", "approved"];
  const initialStatus =
    rawParam && (validStatuses as string[]).includes(rawParam)
      ? (rawParam as Status)
      : null;
  const [status, setStatus] = useState<Status>(initialStatus ?? "loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;
      setEmail(session.user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setStatus((profile?.approval_status as Status | undefined) ?? "pending");
    }
    refresh();
  }, []);

  if (status === "loading") {
    return (
      <SiteLayout>
        <div className="max-w-md mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Lade…
        </div>
      </SiteLayout>
    );
  }

  if (status === "approved") {
    return (
      <SiteLayout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-extrabold mb-3">Du bist freigeschaltet</h1>
          <p className="text-muted-foreground mb-6">
            Hi {email}! Du hast jetzt vollen Zugriff.
          </p>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/profile">Zum Profil</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const copy = COPY[status];
  const Icon = copy.icon;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <SiteLayout>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-accent" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">{copy.title}</h1>
        <p className="text-muted-foreground mb-8">{copy.lead}</p>

        <Card className="p-6 rounded-2xl text-left text-sm space-y-3 mb-6">
          {email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Dein Account: <strong className="text-foreground">{email}</strong></span>
            </div>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">{copy.sub}</p>
        </Card>

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link to="/kontakt">Kontakt aufnehmen</Link>
          </Button>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground underline mt-2"
          >
            Ausloggen
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}
