import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type SessionInfo = { id: string; email: string | null } | null;

export default function SiteHeader() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      setSession(u ? { id: u.id, email: u.email ?? null } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      const u = s?.user;
      setSession(u ? { id: u.id, email: u.email ?? null } : null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Selber QueryKey wie ProfileIdentitySection — Avatar-Update invalidiert beide.
  const { data: profileData } = useQuery({
    queryKey: ["profile-identity", session?.id],
    queryFn: async () => {
      if (!session?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", session.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.id,
  });

  const isAuthed = session?.id !== undefined && session !== null;
  const displayName = profileData?.name?.trim() || session?.email || "";
  const avatarUrl = profileData?.avatar_url ?? null;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-8">
        <Link to="/" className="font-extrabold tracking-tight text-xl">
          Fitly
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <NavLink
            to="/shoes"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Schuhe
          </NavLink>
          <NavLink
            to="/scan"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Scan
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Über
          </NavLink>
          <NavLink
            to="/kontakt"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Kontakt
          </NavLink>
          <span className="hidden md:inline-block w-px h-4 bg-border" />
          <NavLink
            to="/pitch"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Pitch Deck
          </NavLink>
          <NavLink
            to="/produkt/nike-vaporfly-4?demo=keller"
            className={({ isActive }) =>
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }
          >
            Retailer-Demo
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isAuthed ? (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="inline-flex items-center gap-2 rounded-full bg-muted/60 hover:bg-muted px-2 py-1 transition group"
              aria-label="Zum Profil"
            >
              <span className="h-7 w-7 rounded-full bg-background border border-border overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="text-xs font-medium pr-2 max-w-[160px] truncate">
                {displayName}
              </span>
            </button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
