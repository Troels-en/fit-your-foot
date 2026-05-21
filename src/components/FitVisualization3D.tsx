import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import { Box3, Vector3, Shape, ExtrudeGeometry, DoubleSide, AdditiveBlending } from "three";
import { Eye, EyeOff } from "lucide-react";
import type { FootMm, RankedAlternative } from "@/lib/matchDb";
import type { ShoeRow } from "@/lib/shoeQueries";

const ROOMY_TOEBOX = new Set(["Roomy", "roomy", "Rounded", "rounded", "Square", "square"]);
const REFERENCE_EU_SIZE = 38;
const MM_PER_EU_SIZE = 6.67;

type ShoeForViz = Pick<
  ShoeRow,
  | "id"
  | "name"
  | "brand_name"
  | "inner_length_mm"
  | "width_mm"
  | "heel_width_mm"
  | "toebox"
  | "width_grade"
  | "heel_drop_mm"
>;

// ───────────── Foot model (glTF) ─────────────

function Foot({ foot, visible = true }: { foot: FootMm; visible?: boolean }) {
  const { scene } = useGLTF("/models/foot.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);

  const { scale, position, rotation } = useMemo(() => {
    // First measure raw model
    const rawBox = new Box3().setFromObject(cloned);
    const rawSize = new Vector3();
    rawBox.getSize(rawSize);

    // Heuristic rotation so foot lies flat with toes along +X
    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z);
    let rot: [number, number, number] = [0, 0, 0];
    if (rawSize.z === longest) rot = [0, Math.PI / 2, 0];
    else if (rawSize.y === longest) rot = [0, 0, -Math.PI / 2];

    // Scale so length along X (after rotation) maps to foot length, 1 unit = 100mm
    const targetLength = foot.foot_length_mm / 100;
    const s = longest > 0 ? targetLength / longest : 1;

    return { scale: s, position: [0, 0, 0] as [number, number, number], rotation: rot };
  }, [cloned, foot.foot_length_mm]);

  if (!visible) return null;

  // Wrap so we can rotate first, then re-center based on rotated bounds
  return (
    <group scale={scale}>
      <group rotation={rotation}>
        <CenteredOnFloor object={cloned} />
      </group>
    </group>
  );
}

// Helper: positions a primitive so its min-Y sits on the floor and XZ is centered
function CenteredOnFloor({ object }: { object: any }) {
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(object);
    const center = new Vector3();
    box.getCenter(center);
    return new Vector3(-center.x, -box.min.y, -center.z);
  }, [object]);
  return <primitive object={object} position={[offset.x, offset.y, offset.z]} />;
}

// ───────────── Procedural shoe ─────────────

function ProceduralShoe({ foot, shoe, visible = true }: { foot: FootMm; shoe: ShoeForViz; visible?: boolean }) {
  const footLen = foot.foot_length_mm / 100;
  const shoeLen = footLen * 1.05;
  const shoeWidth = ((shoe.width_mm ?? 96) / 100) * 1.02;
  const shoeHeel = ((shoe.heel_width_mm ?? 68) / 100) * 1.02;

  const shape = useMemo(() => {
    const s = new Shape();
    const halfLen = shoeLen / 2;
    const halfWidth = shoeWidth / 2;
    const halfHeel = shoeHeel / 2;
    s.moveTo(-halfLen, 0);
    s.bezierCurveTo(-halfLen * 1.02, halfHeel, -halfLen * 0.9, halfHeel * 1.05, -halfLen * 0.7, halfHeel * 1.1);
    s.bezierCurveTo(-halfLen * 0.3, halfWidth * 0.95, halfLen * 0.4, halfWidth, halfLen * 0.88, halfWidth * 0.7);
    s.quadraticCurveTo(halfLen * 1.02, halfWidth * 0.3, halfLen * 1.0, 0);
    s.quadraticCurveTo(halfLen * 1.02, -halfWidth * 0.3, halfLen * 0.88, -halfWidth * 0.7);
    s.bezierCurveTo(halfLen * 0.4, -halfWidth, -halfLen * 0.3, -halfWidth * 0.95, -halfLen * 0.7, -halfHeel * 1.1);
    s.bezierCurveTo(-halfLen * 0.9, -halfHeel * 1.05, -halfLen * 1.02, -halfHeel, -halfLen, 0);
    return s;
  }, [shoeLen, shoeWidth, shoeHeel]);

  const soleGeom = useMemo(() => {
    const g = new ExtrudeGeometry(shape, {
      depth: 0.25,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 4,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.05, 0);
    return g;
  }, [shape]);

  const upperShape = useMemo(() => {
    const s = shape.clone();
    const hole = new Shape();
    const halfLen = shoeLen / 2;
    const openingCX = -halfLen * 0.25;
    const openingRX = halfLen * 0.3;
    const openingRZ = shoeWidth * 0.25;
    hole.ellipse(openingCX, 0, openingRX, openingRZ, 0, Math.PI * 2, false, 0);
    s.holes.push(hole);
    return s;
  }, [shape, shoeLen, shoeWidth]);

  const upperGeom = useMemo(() => {
    const g = new ExtrudeGeometry(upperShape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.05, 0);
    return g;
  }, [upperShape]);

  // Cleanup geometries
  useEffect(() => {
    return () => {
      soleGeom.dispose();
      upperGeom.dispose();
    };
  }, [soleGeom, upperGeom]);

  if (!visible) return null;

  return (
    <group>
      <mesh geometry={soleGeom} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh geometry={upperGeom}>
        <meshPhysicalMaterial
          color="#e5e7eb"
          transparent
          opacity={0.45}
          roughness={0.4}
          metalness={0.0}
          transmission={0.3}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Keller-red side stripe accent */}
      <mesh geometry={upperGeom} scale={[1.001, 0.3, 1.001]} position={[0, 0.1, 0]}>
        <meshStandardMaterial color="#dc2626" transparent opacity={0.35} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ───────────── Heatmap ─────────────

type HeatZone = { pos: [number, number, number]; severity: number; radius: number };

function severityToColor(s: number) {
  if (s <= 0.5) {
    const t = s * 2;
    return `rgb(${Math.round(16 + t * (245 - 16))}, ${Math.round(185 + t * (158 - 185))}, ${Math.round(129 + t * (11 - 129))})`;
  } else {
    const t = (s - 0.5) * 2;
    return `rgb(${Math.round(245 + t * (239 - 245))}, ${Math.round(158 + t * (68 - 158))}, ${Math.round(11 + t * (68 - 11))})`;
  }
}

function HeatBlob({ zone }: { zone: HeatZone }) {
  const color = severityToColor(zone.severity);
  return (
    <mesh position={zone.pos} renderOrder={998}>
      <sphereGeometry args={[zone.radius, 24, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function computeHeatZones(foot: FootMm, shoe: ShoeForViz): HeatZone[] {
  const lenUnits = foot.foot_length_mm / 100;
  const ballWidthUnits = foot.ball_width_mm / 200;
  const heelWidthUnits = foot.heel_width_mm / 200;

  const shoeWidth = shoe.width_mm ?? 96;
  const shoeHeel = shoe.heel_width_mm ?? 68;
  const ballDelta = foot.ball_width_mm - shoeWidth;
  const heelDelta = foot.heel_width_mm - shoeHeel;
  const roomy = ROOMY_TOEBOX.has(shoe.toebox ?? "");

  const ballSev = Math.max(0, Math.min(1, ballDelta / 10));
  const heelSev = Math.max(0, Math.min(1, heelDelta / 10));
  const toeSev = !roomy && foot.ball_width_mm >= 99 ? 0.7 : 0.1;

  const footTopY = 0.34;

  return [
    { pos: [lenUnits * 0.25, footTopY, ballWidthUnits * 0.75], severity: ballSev, radius: 0.2 },
    { pos: [lenUnits * 0.25, footTopY, -ballWidthUnits * 0.75], severity: ballSev, radius: 0.2 },
    { pos: [-lenUnits * 0.4, footTopY - 0.04, heelWidthUnits * 0.85], severity: heelSev, radius: 0.15 },
    { pos: [-lenUnits * 0.4, footTopY - 0.04, -heelWidthUnits * 0.85], severity: heelSev, radius: 0.15 },
    { pos: [lenUnits * 0.5, footTopY - 0.02, -ballWidthUnits * 0.25], severity: toeSev, radius: 0.15 },
    { pos: [0, footTopY - 0.03, 0], severity: 0.15, radius: 0.21 },
    { pos: [-lenUnits * 0.1, footTopY - 0.03, ballWidthUnits * 0.45], severity: 0.1, radius: 0.17 },
    { pos: [-lenUnits * 0.1, footTopY - 0.03, -ballWidthUnits * 0.45], severity: 0.1, radius: 0.17 },
  ];
}

// ───────────── Scene ─────────────

function Scene({ foot, shoe, showShoe }: { foot: FootMm; shoe: ShoeForViz; showShoe: boolean }) {
  const zones = useMemo(() => computeHeatZones(foot, shoe), [foot, shoe]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 4]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#bcd4ff" />

      <Foot foot={foot} visible />
      {showShoe && <ProceduralShoe foot={foot} shoe={shoe} visible />}
      {zones.map((z, i) => (
        <HeatBlob key={i} zone={z} />
      ))}

      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={6} blur={2.5} far={2} />
      <Environment preset="studio" />
      <OrbitControls enablePan={false} minDistance={2} maxDistance={10} />
    </>
  );
}

// ───────────── Measurements panel ─────────────

function widthGradeFromBall(ball: number): string {
  if (ball >= 102) return "Wide";
  if (ball >= 98) return "Regular";
  return "Narrow";
}

// Beide derivations verwenden DB-Sprache (englisch) als kanonische Werte für
// die ordinal-match-tabellen. Display-mapping in DE_LABELS für die UI.
function toeboxNeedFromBall(ball: number): "Narrow" | "Medium" | "Roomy" {
  if (ball >= 100) return "Roomy";
  if (ball >= 96) return "Medium";
  return "Narrow";
}

const TOEBOX_ORD: Record<string, number> = {
  Narrow: 0,
  narrow: 0,
  Schmal: 0,
  Medium: 1,
  medium: 1,
  Normal: 1,
  Regular: 1,
  Roomy: 2,
  roomy: 2,
  Breit: 2,
  Geräumig: 2,
  Wide: 2,
};

const WIDTH_GRADE_ORD: Record<string, number> = {
  Narrow: 0,
  narrow: 0,
  Schmal: 0,
  Regular: 1,
  regular: 1,
  Medium: 1,
  medium: 1,
  Normal: 1,
  Wide: 2,
  wide: 2,
  Breit: 2,
  "Extra-Wide": 3,
  "extra-wide": 3,
  "Sehr breit": 3,
};

// DB-Werte → user-facing deutsche Labels (für die Tabelle)
const DE_LABELS: Record<string, string> = {
  Narrow: "Schmal",
  Medium: "Normal",
  Regular: "Normal",
  Roomy: "Breit",
  Wide: "Breit",
  "Extra-Wide": "Sehr breit",
};
const toDe = (v: string | null | undefined): string =>
  v == null ? "—" : DE_LABELS[v] ?? v;

type QualMatch = "good" | "ok" | "bad" | null;

function ordinalMatch(footVal: string, shoeVal: string, ord: Record<string, number>): QualMatch {
  const f = ord[footVal];
  const s = ord[shoeVal];
  if (f == null || s == null) return null;
  const gap = Math.abs(f - s);
  if (gap === 0) return "good";
  if (gap === 1) return "ok";
  return "bad";
}

function MatchPill({ match }: { match: QualMatch }) {
  if (match == null) return <span className="text-neutral-400">—</span>;
  const map = {
    good: { label: "✓", cls: "text-emerald-600" },
    ok: { label: "≈", cls: "text-amber-600" },
    bad: { label: "✗", cls: "text-red-600" },
  } as const;
  const { label, cls } = map[match];
  return <span className={`${cls} font-semibold`}>{label}</span>;
}

function DeltaCell({ foot, shoe }: { foot: number | null; shoe: number | null }) {
  if (foot == null || shoe == null) return <span className="text-neutral-400">—</span>;
  const d = Math.round(foot - shoe);
  if (d === 0) return <span className="text-emerald-600 font-semibold">0mm</span>;
  const sign = d > 0 ? "+" : "";
  const abs = Math.abs(d);
  // 3-tier color: green ≤ 2mm (great), yellow 3-5mm (ok), red > 5mm (poor).
  // Sign of d still drives nuance: positive = foot bigger than shoe (squeezes),
  // negative = shoe bigger (loose) — both shown but small loose deltas are
  // visually less alarming so we treat them slightly more generously.
  let cls: string;
  if (abs <= 2) cls = "text-emerald-600 font-semibold";
  else if (abs <= 5) cls = "text-amber-600 font-semibold";
  else cls = "text-red-600 font-semibold";
  return <span className={cls}>{`${sign}${d}mm`}</span>;
}

function MeasurementsPanel({ foot, shoe }: { foot: FootMm; shoe: ShoeForViz }) {
  const scaledShoeLength =
    shoe.inner_length_mm == null
      ? null
      : shoe.inner_length_mm + (foot.eu_size - REFERENCE_EU_SIZE) * MM_PER_EU_SIZE;

  const footToeboxNeed = toeboxNeedFromBall(foot.ball_width_mm);
  const footWidthGrade = widthGradeFromBall(foot.ball_width_mm);

  type Row = {
    label: string;
    foot: string;
    shoe: string;
    // Numerisch (mm) → Δ-Spalte; qualitativ → Match-Pill
    footNum?: number | null;
    shoeNum?: number | null;
    qualMatch?: QualMatch;
  };

  const rows: Row[] = [
    {
      label: "Länge",
      foot: `${Math.round(foot.foot_length_mm)} mm`,
      shoe: scaledShoeLength == null ? "—" : `${Math.round(scaledShoeLength)} mm`,
      footNum: foot.foot_length_mm,
      shoeNum: scaledShoeLength,
    },
    {
      label: "Ballenbreite",
      foot: `${Math.round(foot.ball_width_mm)} mm`,
      shoe: shoe.width_mm ? `${shoe.width_mm} mm` : "—",
      footNum: foot.ball_width_mm,
      shoeNum: shoe.width_mm,
    },
    {
      label: "Fersenbreite",
      foot: `${Math.round(foot.heel_width_mm)} mm`,
      shoe: shoe.heel_width_mm ? `${shoe.heel_width_mm} mm` : "—",
      footNum: foot.heel_width_mm,
      shoeNum: shoe.heel_width_mm,
    },
    {
      label: "Sprengung",
      foot: foot.preferred_drop_mm != null ? `${foot.preferred_drop_mm} mm` : "—",
      shoe: shoe.heel_drop_mm != null ? `${shoe.heel_drop_mm} mm` : "—",
      footNum: foot.preferred_drop_mm ?? null,
      shoeNum: shoe.heel_drop_mm ?? null,
    },
    {
      label: "Toebox-Form",
      foot: footToeboxNeed,
      shoe: shoe.toebox ?? "—",
      qualMatch: shoe.toebox ? ordinalMatch(footToeboxNeed, shoe.toebox, TOEBOX_ORD) : null,
    },
    {
      label: "Weite-Klasse",
      foot: footWidthGrade,
      shoe: shoe.width_grade ?? "—",
      qualMatch: shoe.width_grade ? ordinalMatch(footWidthGrade, shoe.width_grade, WIDTH_GRADE_ORD) : null,
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] gap-x-2 text-[10px] uppercase tracking-wider text-neutral-500 px-2 pb-1.5 border-b border-neutral-200">
        <div>Parameter</div>
        <div className="text-right">Dein Fuß</div>
        <div className="text-right">Schuh</div>
        <div className="text-right">Pass</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] gap-x-2 text-xs px-2 py-1.5 ${
            i % 2 === 1 ? "bg-neutral-50" : ""
          }`}
        >
          <div className="text-neutral-700">{r.label}</div>
          <div className="text-right text-neutral-900 font-medium">{r.foot}</div>
          <div className="text-right text-neutral-900 font-medium">{r.shoe}</div>
          <div className="text-right tabular-nums text-[11px] font-semibold">
            {r.qualMatch !== undefined ? (
              <MatchPill match={r.qualMatch} />
            ) : (
              <DeltaCell foot={r.footNum ?? null} shoe={r.shoeNum ?? null} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function displayShoeName(shoe: ShoeForViz) {
  const brand = shoe.brand_name?.trim();
  const name = shoe.name.trim();
  return brand && name.toLowerCase().startsWith(brand.toLowerCase())
    ? name.slice(brand.length).trim()
    : name;
}

// ───────────── Main component ─────────────

export default function FitVisualization3D({
  foot,
  shoe,
  alternatives = [],
  activeShoeId: controlledActiveId,
  onActiveShoeChange,
}: {
  foot: FootMm;
  shoe: ShoeRow;
  alternatives?: RankedAlternative[];
  activeShoeId?: string;
  onActiveShoeChange?: (id: string) => void;
}) {
  const [internalActiveId, setInternalActiveId] = useState<string>(shoe.id);
  const activeShoeId = controlledActiveId ?? internalActiveId;
  const [showShoe, setShowShoe] = useState(true);

  const setActive = (id: string) => {
    if (onActiveShoeChange) onActiveShoeChange(id);
    else setInternalActiveId(id);
  };

  const activeShoe: ShoeForViz =
    alternatives.find((a) => a.shoe.id === activeShoeId)?.shoe ?? shoe;

  return (
    <div className="relative w-full bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="grid md:grid-cols-5 gap-0">
        {/* Canvas */}
        <div className="md:col-span-3 relative">
          {/* Legend */}
          <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1.5 text-[10px] space-y-1 border border-neutral-200">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-2 rounded-sm"
                style={{
                  background: "linear-gradient(to right, #10b981, #f59e0b, #ef4444)",
                }}
              />
              Passform-Heatmap
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f3c29f]" /> Dein Fuß
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-700" /> Schuh
            </div>
          </div>

          <div className="h-[300px] w-full">
            <Canvas
              shadows
              gl={{ alpha: true, antialias: true }}
              camera={{ position: [3, 2, 4], fov: 35 }}
            >
              <Suspense
                fallback={
                  <mesh>
                    <boxGeometry args={[0.001, 0.001, 0.001]} />
                    <meshBasicMaterial transparent opacity={0} />
                  </mesh>
                }
              >
                <Scene foot={foot} shoe={activeShoe} showShoe={showShoe} />
              </Suspense>
            </Canvas>
          </div>

          {/* Toggle shoe layer */}
          <button
            onClick={() => setShowShoe((v) => !v)}
            className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-sm hover:bg-white text-xs font-medium px-3 py-2 rounded-full border border-neutral-200 shadow-sm inline-flex items-center gap-1.5"
          >
            {showShoe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showShoe ? "Schuh ausblenden" : "Schuh einblenden"}
          </button>
        </div>

        {/* Measurements */}
        <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-neutral-200 py-2">
          <MeasurementsPanel foot={foot} shoe={activeShoe} />
        </div>
      </div>

      {/* Alternatives toggle */}
      {alternatives.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-neutral-100">
          <button
            onClick={() => setActive(shoe.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              activeShoeId === shoe.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500"
            }`}
          >
            Aktueller Schuh
          </button>
          {alternatives.map(({ shoe: alt }) => (
            <button
              key={alt.id}
              onClick={() => setActive(alt.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                activeShoeId === alt.id
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500"
              }`}
            >
              {alt.brand_name} {displayShoeName(alt)}
            </button>
          ))}
        </div>
      )}

      <p className="px-3 pb-1 pt-1 text-[10px] text-neutral-400 text-center">
        {showShoe
          ? "Heatmap zeigt Passform-Qualität: grün = passt, gelb = grenzwertig, rot = drückt."
          : "Dein Fuß mit Heatmap. Klicke „Schuh einblenden\" um den Laufschuh zu sehen."}
      </p>
      <p className="px-3 pb-2 text-[9px] text-neutral-400 text-center">
        3D-Modell: „Human Foot Base Mesh" von ferrumiron6, CC-BY 4.0.
      </p>
    </div>
  );
}

useGLTF.preload("/models/foot.glb");
