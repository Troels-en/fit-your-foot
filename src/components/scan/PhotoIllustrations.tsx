/**
 * Visuelle Erklärungen für jede Capture-Phase. Klare SVG, eindeutig
 * labeled — User soll auf einen Blick verstehen was wo hinkommt.
 *
 * Self-Scan-Ergonomik (Research-Driven):
 *  - Industry-Konsens 2024-25: Stehend + vertikales Side-Foto allein UNMÖGLICH.
 *    Nike Fit / Aetrex / FeetMeter machen 1-Foto-only stehend.
 *    FitMyFoot / Xesto / Snapfeet / Avatar-Feet → Seated für Non-Top-Shots.
 *  - Fitly-Quick-Scan: stand-for-top, SIT-for-side. ArUco-Blatt bleibt unter
 *    Fuß, Skala-Kalibrierung geht durch beide Fotos.
 *  - Illustrationen zeigen REALE Self-Scan-Pose: User in Vorbeugung beim
 *    Top-Foto (NICHT helfender Stick-Figure daneben), sitzend beim Side-Foto.
 */

const STROKE = "currentColor";

export type SelectedFoot = "left" | "right";

type FootProps = {
  /**
   * Welcher Fuß wird gescannt. "right" rendert original SVG-Layout. "left"
   * spiegelt via `transform="scale(-1, 1) translate(-W, 0)"` auf dem inneren
   * <g>-Element. Default "right" für Backwards-Compat.
   */
  selectedFoot?: SelectedFoot;
};

/**
 * Top-Down-View: gedrucktes Blatt liegt mit kurzer Kante an der Wand,
 * Fuß steht ON dem Blatt mit der Ferse zur Wand. Foot-neutral (kein Mirror) —
 * SetupIllustration zeigt symmetrische Top-Down-Anordnung; Pfeile/Labels
 * sind nicht foot-spezifisch.
 */
export function SetupIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="w-full max-w-[280px] h-auto" aria-hidden>
      {/* "Von oben" Indikator oben-links — kleiner Camera-Icon mit Pfeil-nach-unten */}
      <g transform="translate(8, 10)" className="text-muted-foreground">
        <rect x="0" y="0" width="14" height="10" rx="2" fill="none" stroke={STROKE} strokeWidth="1.2" />
        <circle cx="7" cy="5" r="2.5" fill="none" stroke={STROKE} strokeWidth="1" />
        <text x="20" y="9" fontSize="9" fill={STROKE} fontFamily="sans-serif">
          Ansicht von oben
        </text>
      </g>

      {/* Wand — dicke horizontale Linie mit Hatching-Andeutung am oberen Rand */}
      <g transform="translate(0, 35)" className="text-foreground">
        <line x1="60" y1="0" x2="220" y2="0" stroke={STROKE} strokeWidth="3" />
        {/* Hatch-Striche oberhalb der Wand-Linie */}
        {[68, 80, 92, 104, 116, 128, 140, 152, 164, 176, 188, 200, 212].map((x) => (
          <line key={x} x1={x} y1="-6" x2={x - 4} y2="0" stroke={STROKE} strokeWidth="1" />
        ))}
        <text x="140" y="-12" fontSize="10" fill={STROKE} fontFamily="sans-serif" fontWeight="600" textAnchor="middle">
          Wand
        </text>
      </g>

      {/* Gedrucktes Blatt — großes Rechteck zentral, Top-Edge berührt Wand.
          Theme-tokens statt hardcoded weiß/schwarz: in echt ist Papier weiß +
          Marker schwarz, aber Dark-Mode würde mit white-fill als bright disc
          aufleuchten. fill-card + fill-foreground rendert in beiden Modes als
          abstraktes Diagramm (Tradeoff: opfert print-realism für Lesbarkeit). */}
      <g className="text-foreground">
        <rect x="60" y="35" width="160" height="130" className="fill-card" stroke={STROKE} strokeWidth="2" />
        {/* Marker-Andeutung: 4×4 Grid (vereinfacht — echte Mat hat 4×6) */}
        <g className="fill-foreground">
          {[
            [70, 45], [110, 45], [150, 45], [190, 45],
            [70, 75], [110, 75], [150, 75], [190, 75],
            [70, 105], [110, 105], [150, 105], [190, 105],
            [70, 135], [110, 135], [150, 135], [190, 135],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="20" height="20" />
          ))}
        </g>
      </g>

      {/* Fuß-Outline — sitzt OBEN auf dem Blatt, Ferse berührt Wand */}
      <g>
        <path
          d="M 130 38 Q 116 38 114 60 Q 113 90 117 120 Q 120 145 130 152 Q 145 158 152 152 Q 158 145 158 120 Q 158 95 156 70 Q 154 50 145 40 Q 138 36 130 38 Z"
          className="fill-accent"
          opacity="0.85"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      </g>

      {/* Ferse-Touch-Point — kleines grünes Kreuzchen genau wo Fuß die Wand berührt */}
      <g transform="translate(135, 38)">
        <circle cx="0" cy="0" r="4" className="fill-emerald-500" />
        <circle cx="0" cy="0" r="6" fill="none" className="stroke-emerald-500" strokeWidth="1" />
      </g>

      {/* "WAND-SEITE"-Label direkt unterhalb der Wand-Linie auf dem Blatt damit
          eindeutig welche Kante an die Wand kommt. fontSize=9 statt 7 für
          Lesbarkeit auf kleinen Screens (Gemini-Review-Finding). */}
      <g className="text-emerald-700 dark:text-emerald-400">
        <text
          x="140"
          y="50"
          fontSize="9"
          fill="currentColor"
          fontFamily="sans-serif"
          fontWeight="700"
          textAnchor="middle"
          letterSpacing="0.3"
        >
          ↑ WAND-SEITE
        </text>
      </g>

      {/* Annotations mit Pfeilen */}
      {/* "Blatt" — Pfeil von rechts auf einen Marker */}
      <g className="text-foreground">
        <line x1="245" y1="60" x2="222" y2="60" stroke={STROKE} strokeWidth="1" markerEnd="url(#arrowhead)" />
        <text x="248" y="55" fontSize="10" fill={STROKE} fontFamily="sans-serif" fontWeight="600">
          gedrucktes
        </text>
        <text x="248" y="66" fontSize="10" fill={STROKE} fontFamily="sans-serif" fontWeight="600">
          Blatt
        </text>
      </g>

      {/* "Fuß" — Pfeil von links zur Mitte des Fußes */}
      <g className="text-foreground">
        <line x1="30" y1="100" x2="112" y2="100" stroke={STROKE} strokeWidth="1" markerEnd="url(#arrowhead)" />
        <text x="6" y="96" fontSize="10" fill={STROKE} fontFamily="sans-serif" fontWeight="600">
          dein Fuß
        </text>
        <text x="6" y="108" fontSize="9" className="fill-muted-foreground" fontFamily="sans-serif">
          steht auf
        </text>
        <text x="6" y="118" fontSize="9" className="fill-muted-foreground" fontFamily="sans-serif">
          dem Blatt
        </text>
      </g>

      {/* "Ferse berührt Wand" — Pfeil zum grünen Touch-Punkt */}
      <g className="text-emerald-700 dark:text-emerald-400">
        <line x1="200" y1="22" x2="142" y2="36" stroke="currentColor" strokeWidth="1" markerEnd="url(#arrowhead-green)" />
        <text x="195" y="18" fontSize="10" fill="currentColor" fontFamily="sans-serif" fontWeight="600">
          Ferse
        </text>
        <text x="195" y="29" fontSize="10" fill="currentColor" fontFamily="sans-serif" fontWeight="600">
          berührt Wand
        </text>
      </g>

      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
        <marker id="arrowhead-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}

/**
 * Top-Foto-Illustration (Self-Scan-Realität): User STEHT, beugt sich nach vorne,
 * hält Phone mit beiden Händen WAAGERECHT über eigenem Fuß. Camera schaut
 * nach unten. Bewusst gezeigt: gebeugte Wirbelsäule + kurze Arme.
 *
 * Theme-static: alle Farben explizit dark-on-light, weil Wrapper ist
 * bg-white/95 (Camera-Overlay + Seated-Prompt) — Theme-Tokens würden in
 * Dark-Mode flippen und Strokes auf dem weißen BG unsichtbar machen.
 */
const TOP_DARK = "#1f2937";
const TOP_GRAY = "#6b7280";
export function TopPhotoIllustration({ selectedFoot = "right" }: FootProps = {}) {
  // Mirror-Strategy: outer <svg> + Header-Label bleiben unverändert (Text-
  // Spiegelung wäre unleserlich). Innerer <g> mit szenischen Elementen wird
  // gespiegelt um die viewBox-Mittellinie x=140. Annotation rechts oben mit
  // Phone-Hint bleibt rechts (text-anchor=end), aber Pfeil-Endpunkt wird
  // mitgespiegelt — bleibt aber sinnvoll weil scene gemirrored ist.
  const mirrorXform = selectedFoot === "left" ? "scale(-1 1) translate(-280 0)" : undefined;
  return (
    <svg viewBox="0 0 280 200" className="w-full max-w-[260px] h-auto" aria-hidden>
      {/* Header-Label — kein Mirror (Text bleibt lesbar) */}
      <text x="6" y="14" fontSize="9" fill={TOP_GRAY} fontFamily="sans-serif">
        Du stehst, beugst dich nach vorne, Phone in beiden Händen
      </text>
      <g transform={mirrorXform}>

      {/* Boden-Linie + Wand (links) */}
      <line x1="0" y1="180" x2="280" y2="180" stroke={TOP_DARK} strokeWidth="2" />
      <line x1="40" y1="180" x2="40" y2="60" stroke={TOP_DARK} strokeWidth="2" />
      <text x="38" y="55" fontSize="8" textAnchor="end" fill={TOP_GRAY} fontFamily="sans-serif">
        Wand
      </text>

      {/* Blatt auf Boden (Linie). */}
      <rect x="40" y="176" width="120" height="4" fill={TOP_DARK} />

      {/* Fuß-Profil auf Blatt, Ferse links (gegen Wand) */}
      <path
        d="M 50 176 Q 50 162 64 162 L 130 162 Q 152 162 156 173 Q 160 178 130 178 L 50 178 Z"
        className="fill-accent"
      />
      <text x="100" y="190" fontSize="8" textAnchor="middle" fill={TOP_GRAY} fontFamily="sans-serif">
        Fuß auf Blatt · Ferse an Wand
      </text>

      {/* Person — STEHEND, GEBEUGT NACH VORNE. Beide Beine enden AUF dem
          scanned-Foot (y=162) statt daneben (y=178) — vorher landeten Figur-
          Füße bei x=78,98 zwischen dem scanned-Foot bei x=50-160 →
          Verwirrung welcher Fuß gemessen wird (Gemini-Iter3). Jetzt: Beine
          gehen ins Foot-Profil rein, eindeutig „dein Fuß auf dem Blatt". */}
      <g stroke={TOP_DARK} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Kopf */}
        <circle cx="105" cy="48" r="11" fill="white" />
        {/* Wirbelsäule — gebogen nach vorne (Spine Flexion ~50°) */}
        <path d="M 105 59 Q 102 80 95 100 Q 92 115 95 130" />
        {/* Beine — Hüfte (95,130) → enden im scanned-Foot bei y=162. */}
        <line x1="95" y1="130" x2="82" y2="148" />
        <line x1="82" y1="148" x2="72" y2="162" />
        <line x1="95" y1="130" x2="105" y2="148" />
        <line x1="105" y1="148" x2="115" y2="162" />
        {/* Schulter → Arme (nach unten/vorne, halten Phone) */}
        <line x1="98" y1="80" x2="95" y2="115" />
        <line x1="95" y1="115" x2="85" y2="135" />
        <line x1="112" y1="80" x2="118" y2="115" />
        <line x1="118" y1="115" x2="128" y2="135" />
      </g>

      {/* Phone — WAAGERECHT zwischen den Händen, ÜBER dem Fuß auf dem Boden. */}
      <g>
        <rect
          x="68"
          y="138"
          width="78"
          height="9"
          rx="2"
          fill="#f3f4f6"
          stroke={TOP_DARK}
          strokeWidth="2"
        />
        {/* Camera-Linse Unterseite */}
        <circle cx="107" cy="147" r="2" fill={TOP_DARK} />
      </g>

      {/* Sicht-Kegel von Phone-Camera nach unten zum Fuß */}
      <g>
        <line x1="68" y1="147" x2="50" y2="176" stroke={TOP_GRAY} strokeWidth="1" strokeDasharray="3 3" />
        <line x1="146" y1="147" x2="160" y2="176" stroke={TOP_GRAY} strokeWidth="1" strokeDasharray="3 3" />
      </g>

      {/* Annotation: "Phone wie ein Tablett" — rechts oben */}
      <g>
        <text x="270" y="50" fontSize="11" fill={TOP_DARK} fontFamily="sans-serif" fontWeight="700" textAnchor="end">
          Phone flach halten
        </text>
        <text x="270" y="64" fontSize="9" fill={TOP_GRAY} fontFamily="sans-serif" textAnchor="end">
          wie ein Tablett —
        </text>
        <text x="270" y="76" fontSize="9" fill={TOP_GRAY} fontFamily="sans-serif" textAnchor="end">
          Camera zeigt nach unten
        </text>
        <line x1="180" y1="60" x2="148" y2="142" stroke={TOP_DARK} strokeWidth="0.8" markerEnd="url(#arrowhead-top)" />
      </g>

      {/* Hinweis unten: Vorbeugen ist normal */}
      <g>
        <text x="200" y="120" fontSize="8" fill={TOP_GRAY} fontFamily="sans-serif" textAnchor="start">
          Vorbeugen ist normal —
        </text>
        <text x="200" y="131" fontSize="8" fill={TOP_GRAY} fontFamily="sans-serif" textAnchor="start">
          Phone direkt über deinem Fuß
        </text>
      </g>

      </g>
      <defs>
        <marker id="arrowhead-top" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={TOP_DARK} />
        </marker>
      </defs>
    </svg>
  );
}

/**
 * Side-Foto-Illustration (Self-Scan-realistisch): User SITZT auf einem Stuhl,
 * Fuß BLEIBT auf dem Blatt am Boden (Ferse an Wand). Phone in einer Hand auf
 * Knie-Höhe, schräg-nach-unten gerichtet zum Fuß. Diese Pose ist ergonomisch
 * machbar (Research: FitMyFoot/Xesto/Avatar-Feet machen das so).
 *
 * Theme-static: explizite Farben, weil Wrapper bg-white/95 (Camera-Overlay +
 * Seated-Prompt) — Theme-Tokens würden in Dark-Mode flippen und Strokes auf
 * dem weißen BG unsichtbar machen.
 */
const SIDE_DARK = "#1f2937";
const SIDE_GRAY = "#6b7280";
export function SidePhotoIllustration({ selectedFoot = "right" }: FootProps = {}) {
  // Mirror um viewBox-Mittellinie x=150. Default-Layout zeigt rechten Fuß
  // (Sitz rechts, Camera von links auf Fuß bei x≈80). Für "left" → Sitz
  // links, Camera von rechts. Header-Text bleibt unverändert.
  const mirrorXform = selectedFoot === "left" ? "scale(-1 1) translate(-300 0)" : undefined;
  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-[280px] h-auto" aria-hidden>
      {/* Header-Label */}
      <text x="6" y="14" fontSize="9" fill={SIDE_GRAY} fontFamily="sans-serif">
        Setz dich hin · Fuß bleibt auf dem Blatt · Phone schräg von der Seite
      </text>
      <g transform={mirrorXform}>

      {/* Boden + Wand (links) */}
      <line x1="0" y1="180" x2="300" y2="180" stroke={SIDE_DARK} strokeWidth="2" />
      <line x1="30" y1="180" x2="30" y2="50" stroke={SIDE_DARK} strokeWidth="2" />
      <text x="28" y="44" fontSize="8" textAnchor="end" fill={SIDE_GRAY} fontFamily="sans-serif">
        Wand
      </text>

      {/* Blatt auf Boden (Linie). */}
      <rect x="30" y="176" width="100" height="4" fill={SIDE_DARK} />

      {/* Fuß-Profil — bleibt auf Blatt, Ferse an Wand */}
      <path
        d="M 38 176 Q 38 162 50 162 L 100 162 Q 122 162 126 173 Q 130 178 100 178 L 38 178 Z"
        className="fill-accent"
      />
      <text x="80" y="192" fontSize="8" textAnchor="middle" fill={SIDE_GRAY} fontFamily="sans-serif">
        Fuß bleibt auf Blatt
      </text>

      {/* Stuhl — Sitzfläche bei y=125, Lehne rechts. */}
      <g stroke={SIDE_DARK} strokeWidth="2" fill="none">
        {/* Sitzfläche */}
        <line x1="175" y1="125" x2="245" y2="125" />
        {/* Vordere Stuhl-Beine */}
        <line x1="180" y1="125" x2="180" y2="180" />
        <line x1="240" y1="125" x2="240" y2="180" />
        {/* Lehne */}
        <line x1="245" y1="125" x2="245" y2="78" />
      </g>

      {/* Person — sitzend, Hüfte (210,125) AUF Sitzfläche. Geometrie:
            Schulter (203, 88) — Oberkörper leicht vorgebeugt
            Kopf (197, 65)
            Knie (165, 140) — 15px tiefer als Hüfte → ~18° Schenkel abwärts
            Fuß-am-Boden (160, 178) — Shin fast senkrecht
            Zweites Bein startet AT Hüfte (211,127) statt detached (218,128)
            (Gemini-Iter3: vorher schwebte Bein 8px rechts vom Hip).
            Arm Schulter (203, 88) → Ellbogen (180, 108) → Hand am Phone */}
      <g stroke={SIDE_DARK} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Kopf */}
        <circle cx="197" cy="65" r="11" fill="white" />
        {/* Oberkörper */}
        <path d="M 210 125 Q 207 105 203 88 Q 201 80 199 75" />
        {/* Oberschenkel — Hüfte → Knie, abwärts. */}
        <line x1="210" y1="125" x2="165" y2="140" />
        {/* Unterschenkel — Knie → Fuß-am-Boden. */}
        <line x1="165" y1="140" x2="160" y2="178" />
        {/* Anderes Bein dahinter — startet am Hüfte (211,127), dünnerer Stroke. */}
        <line x1="211" y1="127" x2="180" y2="146" strokeWidth="1.5" />
        <line x1="180" y1="146" x2="178" y2="178" strokeWidth="1.5" />
        {/* Arm — Schulter → Ellbogen → Hand am Phone-Center (165,135) */}
        <line x1="203" y1="88" x2="180" y2="108" />
        <line x1="180" y1="108" x2="165" y2="135" />
      </g>

      {/* Phone — am Knie, gekippt um -25° um Phone-CENTER (rect x/y negativ
          damit (0,0) bei rotate() Mittelpunkt ist). */}
      <g transform="translate(165, 135) rotate(-25)">
        <rect
          x="-7"
          y="-20"
          width="14"
          height="40"
          rx="2"
          fill="#f3f4f6"
          stroke={SIDE_DARK}
          strokeWidth="2"
        />
        {/* Camera-Linse */}
        <circle cx="-5" cy="-14" r="2" fill={SIDE_DARK} />
      </g>

      {/* Sichtkegel — beide Linien vom Camera-Lens-Welt-Punkt (155,124) zu
          Heel/Toe-Enden (38,178)/(130,178). Lens-Position berechnet aus
          translate(165,135) rotate(-25) mit local (-5,-14): x≈154.55,
          y≈124.42. */}
      <g>
        <line x1="155" y1="124" x2="38" y2="178" stroke={SIDE_GRAY} strokeWidth="1" strokeDasharray="3 3" />
        <line x1="155" y1="124" x2="130" y2="178" stroke={SIDE_GRAY} strokeWidth="1" strokeDasharray="3 3" />
      </g>

      {/* Annotation: Phone-Pose */}
      <g>
        <text x="290" y="40" fontSize="11" fill={SIDE_DARK} fontFamily="sans-serif" fontWeight="700" textAnchor="end">
          Phone auf Knie-Höhe
        </text>
        <text x="290" y="54" fontSize="9" fill={SIDE_GRAY} fontFamily="sans-serif" textAnchor="end">
          schräg-nach-unten —
        </text>
        <text x="290" y="66" fontSize="9" fill={SIDE_GRAY} fontFamily="sans-serif" textAnchor="end">
          Camera zielt auf Fuß
        </text>
        <line x1="225" y1="48" x2="170" y2="125" stroke={SIDE_DARK} strokeWidth="0.8" markerEnd="url(#arrowhead-side)" />
      </g>

      </g>
      <defs>
        <marker id="arrowhead-side" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={SIDE_DARK} />
        </marker>
      </defs>
    </svg>
  );
}
