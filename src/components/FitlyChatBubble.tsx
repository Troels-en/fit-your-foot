import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "fitly-chat-history";
const MAX_HISTORY = 30;

const INITIAL: ChatMessage = {
  role: "assistant",
  content: "Hi, ich bin Fitly. Frag mich alles rund um Passform, Schuhe und unseren Katalog.",
};

function shouldHide(pathname: string) {
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/produkt/")) return true;
  if (pathname.startsWith("/scan/")) return true;
  if (pathname === "/pitch") return true;
  return false;
}

export default function FitlyChatBubble() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [INITIAL];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [INITIAL];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(-MAX_HISTORY);
    } catch {
      /* ignore */
    }
    return [INITIAL];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  if (shouldHide(pathname)) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const history = next.filter((m) => m !== INITIAL).slice(-20);
      const { data, error } = await supabase.functions.invoke("fit-coach", {
        body: { intent: "chat", messages: history },
      });
      const reply = typeof data?.reply === "string" ? data.reply : "";
      if (error || !reply) {
        toast.error("Chat gerade nicht erreichbar.");
      } else {
        setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setMessages([INITIAL]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat mit Fitly öffnen"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:scale-105 transition flex items-center justify-center"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Frag Fitly
            </SheetTitle>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-3 py-2 text-sm animate-pulse">…</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t p-4 space-y-2">
            <form onSubmit={send} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder="Frag etwas…"
                autoFocus
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Verlauf löschen
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
