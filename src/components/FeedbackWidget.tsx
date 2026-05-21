import { useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function FeedbackWidget({
  shoeId,
  predictedScore,
  scanId,
  clientToken,
}: {
  shoeId: string;
  predictedScore: number | null;
  scanId?: string;
  clientToken?: string;
}) {
  const [rating, setRating] = useState<number>(0);
  const [ownsShoe, setOwnsShoe] = useState<boolean>(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("submit_feedback", {
        p_scan_id: scanId ?? null,
        p_client_token: clientToken ?? null,
        p_shoe_id: shoeId,
        p_predicted_score: predictedScore,
        p_user_rating: rating,
        p_owns_shoe: ownsShoe,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Danke!", description: "Dein Feedback hilft uns den Algorithmus zu verbessern." });
    } catch (e) {
      console.error("submit_feedback failed", e);
      toast({ title: "Fehler", description: "Feedback konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="font-semibold">Danke für dein Feedback! 🙏</p>
        <p className="text-sm text-muted-foreground mt-1">Es fließt direkt in die Algorithmus-Tuning ein.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-bold mb-1">Hilf uns besser werden</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Wir haben {predictedScore != null ? <strong>{predictedScore}%</strong> : "einen Score"} vorhergesagt.
        Wie würdest du die Passform wirklich einschätzen?
      </p>

      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
            <Star className={`h-7 w-7 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 mb-3 text-sm">
        <input type="checkbox" checked={ownsShoe} onChange={(e) => setOwnsShoe(e.target.checked)} />
        Ich besitze diesen Schuh und bin ihn gelaufen
      </label>

      <Textarea
        placeholder="Notizen (optional) — z.B. 'eng am kleinen Zeh', 'Ferse perfekt'"
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
        className="mb-3"
        rows={3}
      />

      <Button onClick={submit} disabled={rating === 0 || submitting}
        className="bg-accent text-accent-foreground hover:bg-accent/90">
        {submitting ? "Sende…" : "Feedback senden"}
      </Button>
    </div>
  );
}
