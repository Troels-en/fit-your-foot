import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sprint 9: Manuelle Brannock-Maße direkt eintragen.
 *
 * User war im Schuhladen, hat Brannock-Device-Maße bekommen — kann sie hier
 * direkt eingeben statt zu scannen. Wir legen einen scans-Row an mit
 * status='complete', shoe_slug='manual-brannock' und allen Maßen pre-filled.
 *
 * useFitProfile picked die Row als "neuestes Profil" auf (ORDER BY
 * completed_at DESC), also wirken die Maße sofort fürs Schuh-Matching.
 */

type Props = {
  userId: string;
  onSaved?: () => void;
};

const ARCH_OPTIONS = [
  { value: "low", label: "Tief" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Hoch" },
] as const;

export default function ManualMeasurementsSection({ userId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    foot_length_mm: "",
    ball_width_mm: "",
    heel_width_mm: "",
    arch_type: "medium" as "low" | "medium" | "high",
    eu_size: "",
    source: "Brannock-Device im Schuhladen",
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lengthMm = parseInt(form.foot_length_mm, 10);
    const ballMm = parseInt(form.ball_width_mm, 10);
    const heelMm = parseInt(form.heel_width_mm, 10);
    const euSize = parseFloat(form.eu_size);

    if (
      Number.isNaN(lengthMm) ||
      lengthMm < 150 ||
      lengthMm > 350 ||
      Number.isNaN(ballMm) ||
      ballMm < 60 ||
      ballMm > 150 ||
      Number.isNaN(heelMm) ||
      heelMm < 40 ||
      heelMm > 130 ||
      Number.isNaN(euSize) ||
      euSize < 30 ||
      euSize > 50
    ) {
      toast.error("Maße sehen unrealistisch aus — bitte prüfen");
      return;
    }

    setSaving(true);
    const clientToken = crypto.randomUUID();
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    })
      .from("scans")
      .insert({
        user_id: userId,
        client_token: clientToken,
        shoe_slug: "manual-brannock",
        status: "complete",
        completed_at: new Date().toISOString(),
        foot_length_mm: lengthMm,
        foot_width_mm: ballMm, // historisch wird ball_width auch als foot_width gespeichert
        ball_width_mm: ballMm,
        heel_width_mm: heelMm,
        arch_type: form.arch_type,
        eu_size: euSize,
        confidence: "manual",
      });
    setSaving(false);
    if (error) {
      console.error("manual measurements insert failed", error);
      toast.error("Speichern fehlgeschlagen — bitte nochmal");
      return;
    }
    toast.success("Maße gespeichert");
    setOpen(false);
    if (onSaved) onSaved();
    else setTimeout(() => window.location.reload(), 500);
  };

  if (!open) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <h3 className="font-bold mb-1">Maße aus dem Schuhladen?</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Falls du Brannock-Device-Maße aus einem Fachgeschäft hast, kannst du
          sie hier eintragen statt zu scannen.
        </p>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Maße eingeben
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">Brannock-Maße eintragen</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Alle Maße in Millimetern. Bei Schuhgrößen kannst du auch
            Halbgrößen wie 42.5 eingeben.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="foot_length_mm">Fußlänge (mm)</Label>
          <Input
            id="foot_length_mm"
            type="number"
            inputMode="numeric"
            placeholder="270"
            value={form.foot_length_mm}
            onChange={(e) => update("foot_length_mm", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="eu_size">EU-Größe</Label>
          <Input
            id="eu_size"
            type="number"
            step="0.5"
            inputMode="decimal"
            placeholder="43"
            value={form.eu_size}
            onChange={(e) => update("eu_size", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="ball_width_mm">Ballenbreite (mm)</Label>
          <Input
            id="ball_width_mm"
            type="number"
            inputMode="numeric"
            placeholder="100"
            value={form.ball_width_mm}
            onChange={(e) => update("ball_width_mm", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="heel_width_mm">Fersenbreite (mm)</Label>
          <Input
            id="heel_width_mm"
            type="number"
            inputMode="numeric"
            placeholder="65"
            value={form.heel_width_mm}
            onChange={(e) => update("heel_width_mm", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label className="block mb-1.5">Fußgewölbe</Label>
        <div className="grid grid-cols-3 gap-2">
          {ARCH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("arch_type", opt.value)}
              className={`p-2 rounded-lg border-2 text-sm ${
                form.arch_type === opt.value
                  ? "border-accent bg-accent/10 font-semibold"
                  : "border-border bg-background hover:border-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="source">Quelle (optional)</Label>
        <Input
          id="source"
          type="text"
          placeholder="z.B. Bunert Essen"
          value={form.source}
          onChange={(e) => update("source", e.target.value)}
        />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Speichere…" : "Maße speichern"}
      </Button>
    </form>
  );
}
