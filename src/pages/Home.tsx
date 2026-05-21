import { Link } from "react-router-dom";
import { ArrowRight, Footprints, Ruler, Sparkles } from "lucide-react";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <SiteLayout>
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6">
          <Sparkles className="h-3 w-3" /> Forschungs-Beta
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          Welcher Laufschuh passt <span className="text-accent">deinem</span> Fuß wirklich?
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Scan deine Füße einmal mit dem Smartphone. Wir vergleichen die Geometrie mit 51
          Laufschuhen und zeigen dir, welche zu deiner Anatomie passen — und welche nicht.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/scan">Jetzt Füße scannen <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/shoes">Schuhe ansehen</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: Footprints, title: "Scan", body: "Zwei Fotos mit DIN-A4-Blatt als Referenz. ~30 Sekunden." },
          { icon: Ruler, title: "Match", body: "Algorithmus vergleicht Ballenbreite, Fersenbreite, Sprengung, Toebox-Form." },
          { icon: Sparkles, title: "Empfehlung", body: "Pro Schuh: Score, top 3 Alternativen, ehrliche Begründung." },
        ].map((item, i) => (
          <div key={i} className="p-6 rounded-2xl border border-border bg-card">
            <item.icon className="h-6 w-6 text-accent mb-3" />
            <div className="font-semibold mb-1">{item.title}</div>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold mb-3">Warum gibt's das?</h2>
        <p className="text-muted-foreground leading-relaxed">
          Etwa 30% aller online gekauften Laufschuhe werden zurückgeschickt — oft weil die
          Passform nicht stimmt. Wir bauen einen Fit-Engine, der das ändert. Diese Site ist
          unser offenes Testlabor: jeder Scan, jedes Feedback hilft uns, den Algorithmus
          besser zu machen. Anonym, ohne Account, ohne Kommerz.
        </p>
      </section>
    </SiteLayout>
  );
}
