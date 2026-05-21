import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const credentialsSchema = z.object({
  email: z.string().trim().email("Bitte eine gültige E-Mail eingeben.").max(255),
  password: z.string().min(8, "Mindestens 8 Zeichen.").max(128),
});

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  // Open-Redirect-Schutz: nur Pfade akzeptieren, nicht protocol-relative URLs
  const rawRedirect = params.get("redirect") ?? "/profile";
  const redirectTarget =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/profile";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agbsAccepted, setAgbsAccepted] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(redirectTarget, { replace: true });
    });
  }, [navigate, redirectTarget]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast({
        title: "Ungültige Eingabe",
        description: parsed.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && !agbsAccepted) {
      toast({
        title: "AGBs erforderlich",
        description: "Bitte stimme den AGBs zu, um einen Account zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signupData, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/profile` },
        });
        if (error) throw error;

        // Notify admin (or set waitlist) via Edge Function. Use the user's
        // session token if signUp returned one (autoConfirm), otherwise the
        // Function will reject — that's OK because Supabase confirmation flow
        // will deliver the user later, and we can call signup-notify on first
        // login. Simpler: try once here, fall back silently.
        const sessionToken = signupData.session?.access_token;
        if (sessionToken) {
          await supabase.functions.invoke("signup-notify", {
            body: {
              agbs_accepted: true,
              newsletter_consent: newsletterConsent,
              waitlist,
            },
          });
        } else {
          // Save consent locally so we can call signup-notify after email-confirm
          try {
            localStorage.setItem(
              "fitly.pending-signup-consent",
              JSON.stringify({
                agbs_accepted: true,
                newsletter_consent: newsletterConsent,
                waitlist,
              })
            );
          } catch {
            /* ignore quota */
          }
        }

        navigate(
          `/auth/email-bestaetigen?email=${encodeURIComponent(parsed.data.email)}`,
          { replace: true }
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate(redirectTarget, { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Fehler",
        description: err?.message ?? "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          {mode === "signin" ? "Login" : "Account anlegen"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {mode === "signin"
            ? "Login speichert dein Profil geräteübergreifend."
            : "Wir sind aktuell in der geschlossenen Beta. Du bekommst Zugang sobald wir dich freischalten — oder wähle die Warteliste."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={agbsAccepted}
                  onCheckedChange={(c) => setAgbsAccepted(c === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Ich akzeptiere die{" "}
                  <a href="/agb" target="_blank" rel="noopener" className="underline hover:text-foreground">
                    AGBs
                  </a>{" "}
                  und die{" "}
                  <a href="/datenschutz" target="_blank" rel="noopener" className="underline hover:text-foreground">
                    Datenschutzerklärung
                  </a>
                  . <span className="text-destructive">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={newsletterConsent}
                  onCheckedChange={(c) => setNewsletterConsent(c === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Newsletter abonnieren — neue Schuhe, Match-Algorithmus-Updates, kein Spam.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={waitlist}
                  onCheckedChange={(c) => setWaitlist(c === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Lieber direkt auf die Warteliste — ich will Bescheid bekommen, wenn ihr public live geht.
                </span>
              </label>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy
              ? "Bitte warten…"
              : mode === "signin"
                ? "Einloggen"
                : waitlist
                  ? "Auf Warteliste setzen"
                  : "Account erstellen"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground underline"
        >
          {mode === "signin" ? "Noch kein Account? Registrieren" : "Schon registriert? Einloggen"}
        </button>
      </div>
    </SiteLayout>
  );
}
