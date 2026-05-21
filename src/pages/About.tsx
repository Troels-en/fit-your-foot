import SiteLayout from "@/components/SiteLayout";
import { Link } from "react-router-dom";
import troels from "@/assets/team-troels.jpg";
import johannes from "@/assets/team-johannes.jpg";
import simon from "@/assets/team-simon.jpg";
import { Linkedin } from "lucide-react";

const founders = [
  {
    photo: troels,
    name: "Troels Enigk",
    role: "AI, Automation & Product",
    linkedin: "https://www.linkedin.com/in/troels-enigk/",
  },
  {
    photo: johannes,
    name: "Johannes Stopa",
    role: "E-Commerce Strategy & BD",
    linkedin: "https://www.linkedin.com/in/johannes-stopa/?locale=en",
  },
  {
    photo: simon,
    name: "Simon Mackeprang",
    role: "Operations & Software Dev",
    linkedin: "https://www.linkedin.com/in/simon-mackeprang/",
  },
];

export default function About() {
  return (
    <SiteLayout>
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-neutral">
        <h1 className="text-4xl font-extrabold tracking-tight">Über Fitly</h1>
        <p className="text-lg text-muted-foreground">
          Fitly ist eine Forschungs-Plattform, die Laufschuh-Passform berechenbar machen will —
          basierend auf echten Fuß-Maßen statt auf Bauchgefühl im Laden.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Wie es funktioniert</h2>
        <p className="text-muted-foreground leading-relaxed">
          Mit zwei Fotos und einem DIN-A4-Blatt als Größenreferenz vermisst unsere
          Photogrammetrie-Pipeline Länge, Ballenbreite, Fersenbreite und Fußgewölbe. Diese
          Werte werden mit der Leisten-Geometrie von 51 aktuellen Laufschuhen verglichen —
          jeder Schuh bekommt einen individuellen Score und drei Begründungen.
        </p>

        <h2 id="accuracy" className="text-2xl font-bold mt-10 mb-3">Mess-Genauigkeit</h2>
        <p className="text-muted-foreground leading-relaxed">
          Wir validieren die Photogrammetrie laufend gegen Caliper-Messungen. Aktuelle
          Toleranzen: Länge ±2 mm, Ballen-/Fersenbreite ±2 mm, Fußgewölbe-Klassifikation
          ≥90% korrekt. Sobald wir genug Vergleichsdaten haben, veröffentlichen wir die
          vollständigen Ergebnisse hier.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Daten-Quellen</h2>
        <p className="text-muted-foreground leading-relaxed">
          Schuh-Geometrie (Innenmaße, Sprengung, Toebox-Form) basiert auf den öffentlichen
          Messungen von <a href="https://runrepeat.com" target="_blank" rel="noopener noreferrer">RunRepeat</a>.
          Wir nutzen diese Daten ausschließlich nicht-kommerziell zur Algorithmus-Validierung.
          Mittelfristig arbeiten wir an direkten Daten-Partnerschaften mit Marken.
        </p>

        <h2 id="privacy" className="text-2xl font-bold mt-10 mb-3">Datenschutz</h2>
        <p className="text-muted-foreground leading-relaxed">
          Scans sind standardmäßig anonym (kein Account nötig) und werden nur lokal in deinem
          Browser gespeichert. Optional kannst du dich einloggen, dann werden die Maße in
          unserer Datenbank gespeichert um sie geräteübergreifend nutzen zu können. Du kannst
          dein Profil jederzeit unter <em>Profil → Profil löschen</em> löschen.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Das Team</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Fitly wird von drei Gründern aus Lissabon gebaut — mit Hintergrund in E-Commerce,
          Operations und Produkt.
        </p>
        <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {founders.map((f) => (
            <div
              key={f.name}
              className="rounded-xl border border-border bg-card p-5 text-center"
            >
              <img
                src={f.photo}
                alt={f.name}
                className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-2 border-primary/30"
              />
              <h3 className="font-semibold text-base text-foreground">{f.name}</h3>
              <div className="text-xs text-primary font-medium italic">{f.role}</div>
              <a
                href={f.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${f.name} on LinkedIn`}
                className="inline-block mt-3"
              >
                <Linkedin
                  size={16}
                  className="text-muted-foreground hover:text-primary mx-auto"
                />
              </a>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-10 mb-3">Für Marken & Retailer</h2>
        <p className="text-muted-foreground leading-relaxed">
          Wir suchen Pilot-Partner für Daten-Austausch und Widget-Integration.{" "}
          <Link to="/kontakt">Schreib uns übers Kontaktformular</Link>.
        </p>
      </article>
    </SiteLayout>
  );
}
