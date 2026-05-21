import { useState, type FormEvent } from "react";
import { Loader2, Mail, Send, Sparkles } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "sending" | "sent";

export default function Kontakt() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — Bots füllen es, Menschen sehen es nicht
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;

    if (website.trim().length > 0) {
      // Bot erkannt — wir tun so als hätten wir gesendet, ohne tatsächlich was zu schicken
      setStatus("sent");
      return;
    }

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Bitte alle Felder ausfüllen.");
      return;
    }

    setStatus("sending");
    const { error } = await supabase.functions.invoke("send-contact", {
      body: { name: name.trim(), email: email.trim(), message: message.trim() },
    });

    if (error) {
      console.error("send-contact failed", error);
      toast.error("Senden fehlgeschlagen. Bitte später nochmal versuchen.");
      setStatus("idle");
      return;
    }

    toast.success("Nachricht gesendet — wir melden uns bald.");
    setStatus("sent");
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <SiteLayout>
      <section className="max-w-2xl mx-auto px-4 pt-16 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6">
          <Mail className="h-3 w-3" /> Kontakt
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Schreib uns
        </h1>
        <p className="text-lg text-muted-foreground">
          Frage zum Scan, zum Matching-Algorithmus oder zur Forschung? Wir antworten
          meistens innerhalb von 24 Stunden.
        </p>
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-20">
        <Card className="p-6 sm:p-8 rounded-2xl">
          {status === "sent" ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Nachricht gesendet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Danke! Wir melden uns bei dir per E-Mail.
              </p>
              <Button variant="outline" onClick={() => setStatus("idle")}>
                Weitere Nachricht schreiben
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  maxLength={200}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "sending"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "sending"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Nachricht</Label>
                <Textarea
                  id="message"
                  required
                  maxLength={5000}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={status === "sending"}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length} / 5000
                </p>
              </div>

              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              >
                <label htmlFor="website">Website (bitte leer lassen)</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={status === "sending"}
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gesendet…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Nachricht senden
                  </>
                )}
              </Button>
            </form>
          )}
        </Card>
      </section>
    </SiteLayout>
  );
}
