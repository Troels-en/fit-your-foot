import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, RefreshCw } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AuthEmailBestaetigen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== "SIGNED_IN" || !session) return;
        // Consent aus localStorage einmalig nachreichen.
        // Erst removeItem, DANN invoke — sonst würden Folge-SIGNED_IN-Events
        // (z.B. Token-Refresh in nem anderen Tab) den Call wiederholen.
        let consent: unknown = null;
        try {
          const raw = localStorage.getItem("fitly.pending-signup-consent");
          if (raw) {
            consent = JSON.parse(raw);
            localStorage.removeItem("fitly.pending-signup-consent");
          }
        } catch {
          /* ignore parse */
        }
        if (consent) {
          try {
            await supabase.functions.invoke("signup-notify", { body: consent });
          } catch (err) {
            console.error("signup-notify after confirm failed", err);
          }
        }
        // AuthGate routet je nach approval_status korrekt nach /profile oder /warteliste.
        navigate("/profile", { replace: true });
      }
    );
    return () => subscription.subscription.unsubscribe();
  }, [navigate]);

  async function resend() {
    if (!email || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/profile` },
    });
    setResending(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mail erneut gesendet", description: `Schau in deinen Posteingang — ${email}.` });
    }
  }

  return (
    <SiteLayout>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-accent" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">
          Bestätige deine E-Mail
        </h1>
        <p className="text-muted-foreground mb-8">
          {email ? (
            <>
              Wir haben dir einen Bestätigungs-Link an <strong>{email}</strong> geschickt.
              Klick den Link in der Mail — dann landest du automatisch in deinem Profil.
            </>
          ) : (
            <>Wir haben dir einen Bestätigungs-Link geschickt. Klick ihn in der Mail um den Login abzuschließen.</>
          )}
        </p>

        <Card className="p-6 rounded-2xl text-left text-sm space-y-4">
          <div>
            <div className="font-semibold mb-1">Keine Mail bekommen?</div>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Schau im Spam-Ordner.</li>
              <li>Warte ein paar Minuten — Mails brauchen manchmal länger.</li>
              <li>Stell sicher dass du die richtige Adresse angegeben hast.</li>
            </ul>
          </div>

          {email && (
            <Button onClick={resend} disabled={resending} variant="outline" className="w-full">
              {resending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Wird gesendet…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Mail erneut senden</>
              )}
            </Button>
          )}
        </Card>

        <div className="mt-6 text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground underline">
            Zurück zum Login
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
