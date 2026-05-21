import { useState, type ChangeEvent } from "react";
import { Loader2, Upload, Sparkles, Footprints, Check } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PRESET_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Mango",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Pepper",
  "https://api.dicebear.com/9.x/bottts/svg?seed=Sneaker",
  "https://api.dicebear.com/9.x/pixel-art/svg?seed=Runner",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Stride",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Pace",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=Trail",
  "https://api.dicebear.com/9.x/micah/svg?seed=Marathon",
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentAvatar: string | null;
  onChange: (newUrl: string) => Promise<void> | void;
};

export default function AvatarPicker({ open, onOpenChange, userId, currentAvatar, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: shoes = [] } = useQuery({
    queryKey: ["my-shoes-for-avatar", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_shoes")
        .select("id, brand_name, model_name, shoe_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: shoeImages = [] } = useQuery({
    queryKey: ["shoe-image-options", shoes.map((s) => s.shoe_id ?? `${s.brand_name}-${s.model_name}`).join("|")],
    queryFn: async () => {
      const linkedIds = shoes.map((s) => s.shoe_id).filter((id): id is string => !!id);
      if (linkedIds.length === 0) {
        // Fallback: zeig populäre Schuhe aus dem Katalog
        const { data, error } = await supabase
          .from("shoes")
          .select("id, name, brand_name, image_url")
          .order("sort_order", { ascending: true })
          .limit(8);
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("shoes")
        .select("id, name, brand_name, image_url")
        .in("id", linkedIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  async function pickUrl(url: string) {
    if (saving) return;
    // Nur http(s) URLs durchlassen — kein javascript:/data:/file: Schema.
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Ungültige Bild-URL.");
      return;
    }
    setSaving(true);
    try {
      await onChange(url);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(`Konnte Avatar nicht setzen: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    // Whitelist concrete image MIMEs — file.type kommt vom Browser (Extension-Hint)
    // und ist spoofbar; das hier reduziert zumindest die offensichtlichen Fälle.
    const ALLOWED_MIMES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    if (!ALLOWED_MIMES.has(file.type)) {
      toast.error("Nur JPG / PNG / WebP / GIF / AVIF erlaubt.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Bild zu groß (max 5 MB).");
      return;
    }

    setUploading(true);
    try {
      // Extension aus MIME-Type ableiten (nicht aus filename — verhindert
      // path-traversal und exotische Endungen).
      const extByMime: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/avif": "avif",
      };
      const ext = extByMime[file.type] ?? "img";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await pickUrl(pub.publicUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  const renderTile = (url: string, alt: string, key: string, label?: string) => {
    const isSelected = currentAvatar === url;
    return (
      <button
        key={key}
        type="button"
        onClick={() => pickUrl(url)}
        disabled={saving}
        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition ${
          isSelected ? "border-accent" : "border-transparent hover:border-border"
        } bg-muted/30`}
      >
        <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
        {label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] font-medium px-2 py-1 truncate text-left">
            {label}
          </div>
        )}
        {isSelected && (
          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Profilbild</DialogTitle>
          <DialogDescription>
            Wähl ein Bild — entweder einen Schuh, ein Preset oder lade dein eigenes hoch.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="presets">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="presets" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Presets
            </TabsTrigger>
            <TabsTrigger value="shoe" className="gap-1.5">
              <Footprints className="h-3.5 w-3.5" /> Schuh
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AVATARS.map((url, i) => renderTile(url, `Preset ${i + 1}`, url))}
            </div>
          </TabsContent>

          <TabsContent value="shoe" className="mt-4">
            {shoeImages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Keine Schuhe verfügbar.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {shoeImages
                  .filter((s) => !!s.image_url)
                  .map((s) =>
                    renderTile(
                      s.image_url as string,
                      `${s.brand_name} ${s.name}`,
                      s.id,
                      `${s.brand_name} ${s.name}`
                    )
                  )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Eigenes Bild hochladen — max 5 MB, JPG/PNG/WebP.
              </p>
              <Button asChild disabled={uploading || saving}>
                <label className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Lade hoch…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Datei wählen
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading || saving}
                  />
                </label>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
