import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <div className="font-extrabold text-base mb-2">Fitly</div>
          <p className="text-muted-foreground leading-relaxed">
            Forschungs-Plattform für Laufschuh-Passform. Wir validieren unseren Matching-Algorithmus
            und unsere Photogrammetrie an echten Daten.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">Daten-Quellen</div>
          <p className="text-muted-foreground leading-relaxed">
            Schuh-Geometrie (Leisten-Maße, Sprengung, Toebox) basiert auf öffentlich verfügbaren
            Messungen von{" "}
            <a href="https://runrepeat.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              RunRepeat
            </a>
            . Verwendung ausschließlich nicht-kommerziell für Forschung und Algorithmus-Validierung.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">Mehr</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">Über Fitly</Link></li>
            <li><Link to="/kontakt" className="hover:text-foreground">Kontakt</Link></li>
            <li><Link to="/about#privacy" className="hover:text-foreground">Datenschutz</Link></li>
            <li><Link to="/about#accuracy" className="hover:text-foreground">Mess-Genauigkeit</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fitly · Nicht-kommerzielle Forschungsumgebung
      </div>
    </footer>
  );
}
