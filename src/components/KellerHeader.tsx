import { Heart, Search, ShoppingBag, User } from "lucide-react";

const KELLER_RED = "#E30613";

const navItems = [
  { label: "Running", href: "#" },
  { label: "Outdoor", href: "#" },
  { label: "Training", href: "#" },
  { label: "Lifestyle", href: "#" },
  { label: "Sale", href: "#", red: true },
  { label: "Kontakt", href: "/kontakt" },
];

export default function KellerHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-6 h-16">
          <a href="/" className="shrink-0">
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: KELLER_RED }}
            >
              KELLER SPORTS
            </span>
          </a>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Suche nach Marke, Produkt, Kategorie"
                className="w-full h-10 pl-10 pr-4 rounded-md border border-neutral-300 bg-neutral-50 text-sm focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>
          <div className="flex items-center gap-5 text-neutral-800">
            <button aria-label="Konto" className="hover:text-neutral-900">
              <User className="h-5 w-5" />
            </button>
            <button aria-label="Wishlist" className="hover:text-neutral-900">
              <Heart className="h-5 w-5" />
            </button>
            <button aria-label="Warenkorb" className="relative hover:text-neutral-900">
              <ShoppingBag className="h-5 w-5" />
              <span
                className="absolute -top-2 -right-2 text-[10px] text-white rounded-full h-4 w-4 flex items-center justify-center"
                style={{ backgroundColor: KELLER_RED }}
              >
                0
              </span>
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-6 h-11 text-sm font-semibold uppercase tracking-wide">
          {navItems.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="hover:opacity-70"
              style={n.red ? { color: KELLER_RED } : undefined}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
