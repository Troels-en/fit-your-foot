import { FormEvent, useState } from "react";
import { ChevronDown, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FootMm } from "@/lib/matchDb";
import type { ShoeRow } from "@/lib/shoeQueries";

type ChatMessage = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGE =
  "Hey! Ich kenne deinen Fuß und alle 51 Schuhe in unserem Katalog. Frag mich z.B.: „Welche Schuhe haben eine breitere Leisten als dieser?\" oder „Was sind die Vorteile der New Balance 990v6 für meinen Fuß?\"";

export default function FitChat({
  foot,
  currentShoe,
}: {
  foot: FootMm | null;
  currentShoe: ShoeRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || !foot || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const history = nextMessages.filter((message) => message !== nextMessages[0]);
    const { data, error } = await supabase.functions.invoke("fit-chat", {
      body: { messages: history, foot, currentShoe },
    });

    const reply = typeof data?.reply === "string" ? data.reply : "";
    if (error || !reply) {
      toast.error("Chat nicht verfügbar. Bitte prüfe ob GROQ_API_KEY gesetzt ist.");
    } else {
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition"
      >
        <span className="inline-flex items-center gap-2 font-bold text-neutral-900">
          <Sparkles className="h-4 w-4" /> Frag Fitly
        </span>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 p-4">
          <ScrollArea className="max-h-80 pr-3">
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl p-3 text-sm leading-relaxed mb-2 ${
                      message.role === "user"
                        ? "bg-neutral-900 text-white"
                        : "bg-white border border-neutral-200 text-neutral-800"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-neutral-200 text-neutral-800 rounded-2xl p-3 text-sm mb-2 animate-pulse">
                    …
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {!foot && (
            <p className="mt-3 text-sm text-neutral-500">
              Mach erst den Passform-Check damit ich deine Daten nutzen kann.
            </p>
          )}

          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={!foot || loading}
              placeholder={foot ? "Frag etwas zu deiner Passform…" : "Passform-Check erforderlich"}
            />
            <Button type="submit" disabled={!foot || loading || !input.trim()}>
              <Send className="h-4 w-4" /> Senden
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
