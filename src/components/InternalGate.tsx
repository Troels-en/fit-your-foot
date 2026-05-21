import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { isGateUnlocked, unlockGate } from "@/lib/internalGate";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InternalGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isGateUnlocked());
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  return (
    <SiteLayout>
      <div className="max-w-sm mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-full bg-muted items-center justify-center mb-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Geschützter Bereich</h1>
          <p className="text-sm text-muted-foreground mt-1">Bitte Passwort eingeben.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (unlockGate(pw)) {
              setUnlocked(true);
            } else {
              setError(true);
            }
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            placeholder="Passwort"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">Falsches Passwort.</p>}
          <Button type="submit" className="w-full">Entsperren</Button>
        </form>
      </div>
    </SiteLayout>
  );
}
