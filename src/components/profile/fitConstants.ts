import type { Database } from "@/integrations/supabase/types";

export type FitDimension = Database["public"]["Enums"]["fit_dimension"];
export type FitRating = Database["public"]["Enums"]["fit_rating"];

export const FIT_DIMENSIONS: { key: FitDimension; label: string; short: string; description: string }[] = [
  {
    key: "length",
    label: "Länge / Zehraum",
    short: "Länge",
    description: "Abstand zwischen längster Zehe und Schuhspitze. Faustregel: ~1 cm Platz vorne, damit die Zehen beim Abrollen nicht anstoßen.",
  },
  {
    key: "toebox_width",
    label: "Toebox-Breite (Zehen)",
    short: "Toebox",
    description: "Breite im vordersten Bereich, wo die Zehen liegen. Zehen sollten flach nebeneinander Platz haben, ohne gequetscht zu werden.",
  },
  {
    key: "forefoot_width",
    label: "Vorfuß / Ballen",
    short: "Vorfuß",
    description: "Breite an der breitesten Stelle des Fußes (Ballen / 1. & 5. Mittelfußköpfchen). Hier entscheidet sich, ob der Schuh drückt.",
  },
  {
    key: "midfoot",
    label: "Mittelfuß / Spann",
    short: "Mittelfuß",
    description: "Umfang über dem Spann, dort wo die Schnürung sitzt. Sollte den Fuß umschließen ohne abzuschnüren oder zu schlackern.",
  },
  {
    key: "heel",
    label: "Ferse (Halt)",
    short: "Ferse",
    description: "Wie fest die Ferse im Schuh sitzt. Bei jedem Schritt sollte die Ferse nicht rausrutschen, aber auch keine Blasen scheuern.",
  },
  {
    key: "drop",
    label: "Sprengung (Drop)",
    short: "Drop",
    description: "Höhenunterschied zwischen Ferse und Vorfuß (in mm). Niedriger Drop = natürlicher Lauf, hoher Drop = entlastet Wade & Achilles.",
  },
  {
    key: "cushion",
    label: "Dämpfung / Stack",
    short: "Dämpfung",
    description: "Wie weich oder fest sich die Sohle anfühlt. Mehr Dämpfung = bequemer auf langen Strecken, weniger = direkteres Bodengefühl.",
  },
];

const TONE_RED = "bg-destructive/20 text-destructive border-destructive/30";
const TONE_ORANGE = "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-300";
const TONE_GREEN = "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";

export const FIT_RATINGS: { key: FitRating; short: string; tone: string }[] = [
  { key: "much_too_tight", short: "−−", tone: TONE_RED },
  { key: "slightly_tight", short: "−", tone: TONE_ORANGE },
  { key: "perfect", short: "✓", tone: TONE_GREEN },
  { key: "slightly_loose", short: "+", tone: TONE_ORANGE },
  { key: "much_too_loose", short: "++", tone: TONE_RED },
];

export const RATING_TONE: Record<FitRating, string> = Object.fromEntries(
  FIT_RATINGS.map((r) => [r.key, r.tone])
) as Record<FitRating, string>;

// Per-dimension labels + explanations for each of the 5 rating buckets.
// Order is fixed: much_too_tight, slightly_tight, perfect, slightly_loose, much_too_loose
type RatingDescriptor = { label: string; description: string };

export const RATING_BY_DIMENSION: Record<FitDimension, Record<FitRating, RatingDescriptor>> = {
  length: {
    much_too_tight: { label: "viel zu kurz", description: "Zehen stoßen vorne hart an, drücken sich krumm." },
    slightly_tight: { label: "etwas zu kurz", description: "Längste Zehe berührt schon die Spitze beim Abrollen." },
    perfect: { label: "perfekt", description: "Etwa eine Daumenbreite Platz vor der längsten Zehe." },
    slightly_loose: { label: "etwas zu lang", description: "Spürbar Luft vorne, Fuß rutscht beim Bergablaufen leicht nach vorn." },
    much_too_loose: { label: "viel zu lang", description: "Schuh schlackert deutlich, Fuß schwimmt im Schuh." },
  },
  toebox_width: {
    much_too_tight: { label: "viel zu eng", description: "Zehen werden zusammengepresst, schmerzt schon im Stand." },
    slightly_tight: { label: "etwas zu eng", description: "Zehen liegen aneinander, kein Spiel zur Seite." },
    perfect: { label: "perfekt", description: "Zehen können sich frei spreizen, ohne anzustoßen." },
    slightly_loose: { label: "etwas zu weit", description: "Zehen haben viel Spiel, leichtes Rutschen nach vorn." },
    much_too_loose: { label: "viel zu weit", description: "Vorderfuß rutscht spürbar im Schuh herum." },
  },
  forefoot_width: {
    much_too_tight: { label: "viel zu eng", description: "Schmerzhafter Druck auf Ballen, Taubheitsgefühle möglich." },
    slightly_tight: { label: "etwas zu eng", description: "Ballenpartie drückt leicht, vor allem nach längerer Belastung." },
    perfect: { label: "perfekt", description: "Vorfuß sitzt satt, ohne zu drücken." },
    slightly_loose: { label: "etwas zu weit", description: "Fuß hat seitlich etwas Spiel, leichte Instabilität bei Kurven." },
    much_too_loose: { label: "viel zu weit", description: "Vorfuß rutscht hin und her, kein Halt beim Abdruck." },
  },
  midfoot: {
    much_too_tight: { label: "viel zu eng", description: "Spann wird auch ohne festes Schnüren stark eingeengt." },
    slightly_tight: { label: "etwas zu eng", description: "Schnürung lässt sich nur knapp schließen, leichter Druck auf dem Spann." },
    perfect: { label: "perfekt", description: "Schnürung schließt mittig, Fuß wird sanft umschlossen." },
    slightly_loose: { label: "etwas zu weit", description: "Muss kräftig nachschnüren, Schnürbänder liegen eng zusammen." },
    much_too_loose: { label: "viel zu weit", description: "Selbst maximal geschnürt bleibt der Mittelfuß lose." },
  },
  heel: {
    much_too_tight: { label: "viel zu eng", description: "Ferse drückt hart, Druckstellen oder Reizung der Achillessehne." },
    slightly_tight: { label: "etwas zu eng", description: "Spürbarer Druck auf Achilles oder seitlich an der Ferse." },
    perfect: { label: "perfekt", description: "Ferse sitzt fest, kein Rutschen, kein Druck." },
    slightly_loose: { label: "etwas zu weit", description: "Ferse hebt sich beim Gehen leicht, Reibung möglich." },
    much_too_loose: { label: "viel zu weit", description: "Ferse rutscht deutlich raus, hohes Blasenrisiko." },
  },
  drop: {
    much_too_tight: { label: "viel zu flach", description: "Wade und Achilles sind stark gefordert, fühlt sich barfuß-artig an." },
    slightly_tight: { label: "etwas zu flach", description: "Spürst mehr Belastung in Wade/Achilles als gewohnt." },
    perfect: { label: "perfekt", description: "Drop passt zu deinem Laufstil, kein einseitiger Stress." },
    slightly_loose: { label: "etwas zu steil", description: "Fuß kippt leicht nach vorn, Belastung wandert zum Vorfuß." },
    much_too_loose: { label: "viel zu steil", description: "Hohe Ferse fühlt sich instabil an, Knie- oder Vorfußbeschwerden." },
  },
  cushion: {
    much_too_tight: { label: "viel zu hart", description: "Sohle fühlt sich bretthart an, jeder Untergrund kommt durch." },
    slightly_tight: { label: "etwas zu hart", description: "Auf längeren Strecken fehlt Komfort, Füße ermüden schnell." },
    perfect: { label: "perfekt", description: "Gute Balance aus Bodengefühl und Dämpfung für deinen Einsatz." },
    slightly_loose: { label: "etwas zu weich", description: "Fühlt sich schwammig an, weniger Stabilität bei schnellem Tempo." },
    much_too_loose: { label: "viel zu weich", description: "Versinkst in der Sohle, kein klarer Abdruck möglich." },
  },
};

export function ratingLabel(dim: FitDimension, rating: FitRating): string {
  return RATING_BY_DIMENSION[dim][rating].label;
}

export function ratingDescription(dim: FitDimension, rating: FitRating): string {
  return RATING_BY_DIMENSION[dim][rating].description;
}
