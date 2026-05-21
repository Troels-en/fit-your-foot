import { FormEvent, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ShoeFormValue = {
  brand_name: string;
  model_name: string;
  size_eu: string;
  notes: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ShoeFormValue>;
  title: string;
  submitLabel: string;
  onSubmit: (value: ShoeFormValue) => Promise<void> | void;
};

const empty: ShoeFormValue = { brand_name: "", model_name: "", size_eu: "", notes: "" };

export default function ShoeFormDialog({ open, onOpenChange, initial, title, submitLabel, onSubmit }: Props) {
  const [value, setValue] = useState<ShoeFormValue>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue({ ...empty, ...initial });
    }
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.model_name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Erfasse deinen Schuh — du kannst Bewertungen jederzeit nachtragen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand">Marke</Label>
            <Input
              id="brand"
              value={value.brand_name}
              onChange={(e) => setValue((v) => ({ ...v, brand_name: e.target.value }))}
              placeholder="z.B. Nike"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Modell *</Label>
            <Input
              id="model"
              required
              value={value.model_name}
              onChange={(e) => setValue((v) => ({ ...v, model_name: e.target.value }))}
              placeholder="z.B. Pegasus 41"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="size">EU-Größe</Label>
            <Input
              id="size"
              type="number"
              step="0.5"
              min="20"
              max="55"
              value={value.size_eu}
              onChange={(e) => setValue((v) => ({ ...v, size_eu: e.target.value }))}
              placeholder="42.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notiz (optional)</Label>
            <Textarea
              id="notes"
              value={value.notes}
              onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))}
              placeholder="z.B. Trainings­schuh, gekauft 2024"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || !value.model_name.trim()}>
              {saving ? "Speichern…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
