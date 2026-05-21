import { useEffect, useState } from "react";
import { Pencil, User, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AvatarPicker from "./AvatarPicker";

type Props = {
  userId: string;
  email: string | null;
};

export default function ProfileIdentitySection({ userId, email }: Props) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile-identity", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) setNameDraft(profile.name ?? "");
  }, [profile?.name]);

  const saveNameMut = useMutation({
    mutationFn: async (newName: string) => {
      const trimmed = newName.trim().slice(0, 80);
      const { error } = await supabase
        .from("profiles")
        .update({ name: trimmed || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-identity", userId] });
      toast.success("Name aktualisiert");
      setEditingName(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAvatar = async (url: string) => {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["profile-identity", userId] });
    toast.success("Profilbild aktualisiert");
  };

  const displayName = profile?.name?.trim() || email || "—";

  return (
    <section>
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group relative h-20 w-20 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0"
          aria-label="Profilbild ändern"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Pencil className="h-5 w-5 text-white" />
          </div>
        </button>

        {/* Name + Email */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveNameMut.mutate(nameDraft);
              }}
              className="flex items-center gap-2 flex-wrap"
            >
              <div className="flex-1 min-w-[160px]">
                <Label htmlFor="name-input" className="sr-only">
                  Dein Name
                </Label>
                <Input
                  id="name-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Dein Name"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <Button type="submit" size="sm" disabled={saveNameMut.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Speichern
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingName(false);
                  setNameDraft(profile?.name ?? "");
                }}
              >
                Abbrechen
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xl truncate">{displayName}</div>
                {profile?.name?.trim() && email && (
                  <div className="text-xs text-muted-foreground truncate">{email}</div>
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditingName(true)}
                aria-label="Name bearbeiten"
                className="shrink-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AvatarPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        userId={userId}
        currentAvatar={profile?.avatar_url ?? null}
        onChange={setAvatar}
      />
    </section>
  );
}
