import { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ShoeFitPills from "./ShoeFitPills";
import CoachChat from "./CoachChat";
import ShoeFormDialog, { type ShoeFormValue } from "./ShoeFormDialog";
import type { FitDimension, FitRating } from "./fitConstants";
import type { Database } from "@/integrations/supabase/types";

type UserShoe = Database["public"]["Tables"]["user_shoes"]["Row"];
type UserShoeFit = Database["public"]["Tables"]["user_shoe_fits"]["Row"];

type Props = {
  shoe: UserShoe;
};

export default function MyShoeCard({ shoe }: Props) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const { data: fits = [] } = useQuery({
    queryKey: ["user_shoe_fits", shoe.id],
    queryFn: async (): Promise<UserShoeFit[]> => {
      const { data, error } = await supabase
        .from("user_shoe_fits")
        .select("*")
        .eq("user_shoe_id", shoe.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ratingsMap: Partial<Record<FitDimension, FitRating>> = Object.fromEntries(
    fits.map((f) => [f.dimension, f.rating])
  );

  const upsertRating = useMutation({
    mutationFn: async (input: { dimension: FitDimension; rating: FitRating }) => {
      const { error } = await supabase
        .from("user_shoe_fits")
        .upsert(
          { user_shoe_id: shoe.id, dimension: input.dimension, rating: input.rating },
          { onConflict: "user_shoe_id,dimension" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_shoe_fits", shoe.id] }),
    onError: (e: Error) => toast.error(e.message ?? "Konnte nicht speichern"),
  });

  const upsertMany = async (proposed: { dimension: FitDimension; rating: FitRating }[]) => {
    const rows = proposed.map((p) => ({ user_shoe_id: shoe.id, dimension: p.dimension, rating: p.rating }));
    const { error } = await supabase.from("user_shoe_fits").upsert(rows, { onConflict: "user_shoe_id,dimension" });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["user_shoe_fits", shoe.id] });
  };

  const editMut = useMutation({
    mutationFn: async (v: ShoeFormValue) => {
      const { error } = await supabase
        .from("user_shoes")
        .update({
          brand_name: v.brand_name.trim() || null,
          model_name: v.model_name.trim(),
          size_eu: v.size_eu ? Number(v.size_eu) : null,
          notes: v.notes.trim() || null,
        })
        .eq("id", shoe.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_shoes"] });
      toast.success("Schuh aktualisiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_shoes").delete().eq("id", shoe.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_shoes"] });
      toast.success("Schuh gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{shoe.brand_name ?? "—"}</div>
          <div className="font-bold text-lg truncate">{shoe.model_name ?? "Schuh"}</div>
          <div className="text-sm text-muted-foreground">
            {shoe.size_eu != null ? `EU ${shoe.size_eu}` : "Größe nicht gesetzt"}
            {shoe.notes ? ` · ${shoe.notes}` : ""}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label="Bearbeiten">
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Löschen" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schuh löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  „{shoe.model_name}" und alle Bewertungen werden entfernt. Das kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMut.mutate()}>Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <ShoeFitPills
        ratings={ratingsMap}
        onChange={(dimension, rating) => upsertRating.mutate({ dimension, rating })}
      />

      <button
        type="button"
        onClick={() => setCoachOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition pt-1"
      >
        <span>Fit-Coach Chat</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${coachOpen ? "rotate-180" : ""}`} />
      </button>

      {coachOpen && (
        <CoachChat
          shoeContext={{ brand: shoe.brand_name, model: shoe.model_name, size_eu: shoe.size_eu }}
          existingRatings={fits.map((f) => ({ dimension: f.dimension, rating: f.rating }))}
          onProposedRatings={upsertMany}
        />
      )}

      <ShoeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Schuh bearbeiten"
        submitLabel="Speichern"
        initial={{
          brand_name: shoe.brand_name ?? "",
          model_name: shoe.model_name ?? "",
          size_eu: shoe.size_eu != null ? String(shoe.size_eu) : "",
          notes: shoe.notes ?? "",
        }}
        onSubmit={(v) => editMut.mutateAsync(v)}
      />
    </div>
  );
}
