import { FormEvent, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FitDimension, FitRating } from "./fitConstants";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ProposedRating = { dimension: FitDimension; rating: FitRating };

type Props = {
  shoeContext: { brand?: string | null; model?: string | null; size_eu?: number | null };
  existingRatings: { dimension: FitDimension; rating: FitRating }[];
  onProposedRatings: (ratings: ProposedRating[]) => Promise<void> | void;
};

const INITIAL =
  'Hi! Ich helfe dir, den Schuh dimensionsweise zu bewerten. Erzähl mir z.B.: "Vorne quetscht\'s an den Zehen, sonst alles top." — ich übersetze das in deine Fit-Bewertungen.';

export default function CoachChat({ shoeContext, existingRatings, onProposedRatings }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: INITIAL }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const history = next.filter((_, i) => i > 0); // strip initial assistant prompt
      const { data, error } = await supabase.functions.invoke("fit-coach", {
        body: {
          intent: "extract",
          messages: history,
          shoe_context: {
            brand: shoeContext.brand ?? undefined,
            model: shoeContext.model ?? undefined,
            size_eu: shoeContext.size_eu ?? undefined,
          },
          existing_ratings: existingRatings,
        },
      });

      const reply = typeof data?.reply === "string" ? data.reply : "";
      if (error || !reply) {
        toast.error("Coach gerade nicht erreichbar.");
      } else {
        setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
        const proposed = Array.isArray(data?.proposed_ratings) ? (data.proposed_ratings as ProposedRating[]) : [];
        if (proposed.length > 0) {
          await onProposedRatings(proposed);
          toast.success(`${proposed.length} Bewertung${proposed.length === 1 ? "" : "en"} vom Coach übernommen.`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="inline-flex items-center gap-2 text-sm font-semibold mb-2">
        <Sparkles className="h-4 w-4 text-accent" /> Fit-Coach
      </div>
      <ScrollArea className="max-h-72 pr-2">
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-background border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-background border border-border rounded-2xl px-3 py-2 text-sm animate-pulse">…</div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Wie sitzt der Schuh?"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
