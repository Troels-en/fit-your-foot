import { useState } from "react";
import { Plus, Footprints } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MyShoeCard from "./MyShoeCard";
import ShoeFormDialog, { type ShoeFormValue } from "./ShoeFormDialog";
import type { Database } from "@/integrations/supabase/types";

type UserShoe = Database["public"]["Tables"]["user_shoes"]["Row"];

type Props = { userId: string };

export default function MyShoesSection({ userId }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: shoes = [], isLoading } = useQuery({
    queryKey: ["user_shoes", userId],
    queryFn: async (): Promise<UserShoe[]> => {
      const { data, error } = await supabase
        .from("user_shoes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async (v: ShoeFormValue) => {
      const { error } = await supabase.from("user_shoes").insert({
        user_id: userId,
        brand_name: v.brand_name.trim() || null,
        model_name: v.model_name.trim(),
        size_eu: v.size_eu ? Number(v.size_eu) : null,
        notes: v.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_shoes", userId] });
      toast.success("Schuh hinzugefügt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-extrabold tracking-tight">Meine Schuhe</h2>
        <Button onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Schuh hinzufügen
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : shoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Footprints className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-bold text-lg mb-1">Noch keine Schuhe</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Trag deine Schuhe ein und bewerte sie pro Dimension. Der Fit-Coach hilft dir dabei,
            die Bewertungen aus natürlicher Sprache zu extrahieren.
          </p>
          <Button onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Ersten Schuh hinzufügen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {shoes.map((s) => (
            <MyShoeCard key={s.id} shoe={s} />
          ))}
        </div>
      )}

      <ShoeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Schuh hinzufügen"
        submitLabel="Hinzufügen"
        onSubmit={(v) => addMut.mutateAsync(v)}
      />
    </section>
  );
}
