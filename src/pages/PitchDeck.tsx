import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Footprints,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

const ACCENT = "#f59e0b";
const SLIDE_SECONDS = 18;

const DEMO_URL =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "https://my-shoe-fit.lovable.app");
const DEMO_PRODUCT_PATH = "/produkt/nike-vaporfly-4";

type SlideId =
  | "hero"
  | "problem"
  | "market"
  | "solution"
  | "approach"
  | "mvp"
  | "gtm"
  | "roadmap"
  | "team"
  | "pricing"
  | "ask";

const SLIDES: { id: SlideId; eyebrow: string; title: string }[] = [
  { id: "hero", eyebrow: "Fitly", title: "Pitch · 3 min" },
  { id: "problem", eyebrow: "01 — Problem", title: "Online shoe shopping is broken" },
  { id: "market", eyebrow: "02 — Why now", title: "$300M invested. Nobody solved it." },
  { id: "solution", eyebrow: "03 — Solution", title: "Scan. Match. Buy." },
  { id: "approach", eyebrow: "04 — How", title: "Measure both. Online." },
  { id: "mvp", eyebrow: "05 — Live MVP", title: "Try it now" },
  { id: "gtm", eyebrow: "06 — Go-to-market", title: "Start where fit hurts most" },
  { id: "roadmap", eyebrow: "07 — Next 10 weeks", title: "From hackathon to first pilot" },
  { id: "team", eyebrow: "08 — Team", title: "Three founders. One mission." },
  { id: "pricing", eyebrow: "09 — Revenue", title: "SaaS. Retailers pay. Consumers free." },
  { id: "ask", eyebrow: "10 — Ask", title: "Help us turn the MVP into a pilot." },
];

export default function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const slide = SLIDES[index];

  const next = useCallback(
    () => setIndex((i) => Math.min(SLIDES.length - 1, i + 1)),
    []
  );
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goto = useCallback((i: number) => setIndex(i), []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(SLIDES.length - 1);
      } else if (e.key === "p" || e.key === "P") {
        setAuto((a) => !a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Auto-advance
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => {
      if (index < SLIDES.length - 1) setIndex((i) => i + 1);
      else setAuto(false);
    }, SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [auto, index]);

  // Inter font
  useEffect(() => {
    const id = "google-fonts-inter-pitch";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0a0a] text-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Slide content */}
      <div className="absolute inset-0">
        <SlideRenderer id={slide.id} index={index} />
      </div>

      {/* Top bar — eyebrow + progress */}
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
          <Footprints className="h-4 w-4" style={{ color: ACCENT }} />
          <span className="font-semibold text-white/80">Fitly</span>
          <span className="text-white/30">·</span>
          <span>{slide.eyebrow}</span>
        </div>
        <Link
          to="/produkt/nike-vaporfly-4"
          className="hidden md:inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white"
        >
          <ExternalLink className="h-3 w-3" /> Live demo
        </Link>
      </div>

      {/* Progress bar */}
      <div className="absolute left-0 right-0 top-16 z-30 flex h-[2px] gap-1 px-8">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goto(i)}
            className="group flex-1 cursor-pointer"
            aria-label={`Slide ${i + 1}`}
          >
            <div
              className={`h-[2px] w-full transition ${
                i < index ? "bg-white/60" : i === index ? "bg-white" : "bg-white/15 group-hover:bg-white/30"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Click zones for navigation (don't intercept clicks on interactive elements) */}
      <button
        type="button"
        onClick={prev}
        className="absolute bottom-20 left-0 top-24 z-10 w-1/4 cursor-w-resize"
        aria-label="Previous slide"
      />
      <button
        type="button"
        onClick={next}
        className="absolute bottom-20 right-0 top-24 z-10 w-1/4 cursor-e-resize"
        aria-label="Next slide"
      />

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/60 transition hover:border-white/40 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={index === SLIDES.length - 1}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/60 transition hover:border-white/40 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            className="ml-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-widest text-white/60 transition hover:border-white/40 hover:text-white"
          >
            {auto ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {auto ? "Pause" : "Auto · 18s"}
          </button>
        </div>
        <div className="font-mono text-xs text-white/40">
          <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
          <span className="mx-1.5">/</span>
          <span>{String(SLIDES.length).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}

function SlideRenderer({ id, index }: { id: SlideId; index: number }) {
  return (
    <div key={index} className="absolute inset-0 animate-[fadeIn_360ms_ease-out]">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
      `}</style>
      {id === "hero" && <HeroSlide />}
      {id === "problem" && <ProblemSlide />}
      {id === "market" && <MarketSlide />}
      {id === "solution" && <SolutionSlide />}
      {id === "approach" && <ApproachSlide />}
      {id === "mvp" && <MvpSlide />}
      {id === "gtm" && <GtmSlide />}
      {id === "roadmap" && <RoadmapSlide />}
      {id === "team" && <TeamSlide />}
      {id === "pricing" && <PricingSlide />}
      {id === "ask" && <AskSlide />}
    </div>
  );
}

/* ---------- Slides ---------- */

function HeroSlide() {
  return (
    <div className="flex h-full items-center justify-center px-12">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-[#f59e0b] blur-[140px]" />
        <div className="absolute -right-20 bottom-10 h-[480px] w-[480px] rounded-full bg-[#7c3aed] opacity-40 blur-[160px]" />
      </div>
      <div className="relative max-w-5xl">
        <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/70">
          <Footprints className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Fitly · 2026
        </div>
        <h1 className="font-black tracking-tight text-white" style={{ fontSize: "clamp(56px, 8vw, 132px)", lineHeight: 0.95 }}>
          We make shoe returns
          <br />
          <span style={{ color: ACCENT, fontStyle: "italic", fontFamily: "Instrument Serif, serif", fontWeight: 400 }}>
            disappear.
          </span>
        </h1>
        <p className="mt-10 max-w-2xl text-xl leading-relaxed text-white/70">
          AI foot scanning meets real shoe interior data. The first truly accurate fit
          recommendation for e-commerce.
        </p>
      </div>
    </div>
  );
}

function ProblemSlide() {
  return (
    <SlideShell title="Online shoe shopping is broken." subtitle="The customer orders three sizes. Keeps one. Returns two.">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Stat value="30–40%" label="Return rate" desc="of shoes bought online are returned" />
        <Stat value="€10–40" label="Cost per return" desc="logistics, inspection, value loss" />
        <Stat value="#1" label="Reason" desc='"Wrong fit" tops every survey' />
      </div>
      <div className="mt-12 flex items-baseline gap-4 border-t border-white/10 pt-8">
        <div className="font-black text-white" style={{ fontSize: "clamp(40px, 5vw, 72px)", color: ACCENT }}>
          €3–4B
        </div>
        <div className="text-lg text-white/70">wasted on shoe returns in Europe every year.</div>
      </div>
    </SlideShell>
  );
}

function MarketSlide() {
  return (
    <SlideShell
      title="$300M invested. Nobody solved it."
      subtitle="To recommend the right shoe online, you need the foot, the shoe, and the channel. No one has all three."
    >
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        {/* Quadrant matrix */}
        <div className="relative aspect-square w-full max-w-[520px] border border-white/15">
          {/* Axis labels */}
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-widest text-white/40">
            Shoe interior data →
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/40">
            Online channel →
          </div>
          {/* Crosshair */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
          <div className="absolute bottom-0 left-1/2 top-0 w-px bg-white/10" />
          {/* Quadrant labels */}
          <div className="absolute left-3 top-3 text-[10px] uppercase tracking-widest text-white/40">In-store · Real data</div>
          <div className="absolute right-3 top-3 text-[10px] uppercase tracking-widest text-white/40">Online · Real data</div>
          <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-white/40">In-store · Estimates</div>
          <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-widest text-white/40">Online · Estimates</div>
          {/* Logos as dots */}
          <Dot name="SafeSize" x={20} y={22} muted />
          <Dot name="Aetrex" x={32} y={28} muted />
          <Dot name="Volumental" x={26} y={42} muted />
          <Dot name="StrutFit" x={70} y={68} muted />
          <Dot name="TrueFit" x={78} y={75} muted />
          <Dot name="Fit Analytics" x={64} y={82} muted />
          <Dot name="SAIZ" x={82} y={62} muted />
          {/* Fitly highlight */}
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: "75%", top: "22%" }}
          >
            <div className="relative">
              <div
                className="absolute inset-0 -m-4 rounded-full"
                style={{ background: ACCENT, opacity: 0.25, filter: "blur(20px)", animation: "slowPulse 2.4s ease-in-out infinite" }}
              />
              <div
                className="relative grid h-12 w-12 place-items-center rounded-full font-black text-black shadow-xl"
                style={{ background: ACCENT }}
              >
                F
              </div>
              <div className="absolute -right-2 top-14 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                Fitly · empty quadrant
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-6 text-white/80">
          <Bullet>
            <strong className="text-white">Know the shoe.</strong> Size 42 ≠ Size 42. Even within the same brand.
          </Bullet>
          <Bullet>
            <strong className="text-white">Know the foot.</strong> Length, width, arch, volume — every foot different.
          </Bullet>
          <Bullet>
            <strong className="text-white">Do it online.</strong> 100% of the problem lives where you can't try shoes on.
          </Bullet>
          <div className="mt-4 border-l-2 pl-4 text-sm text-white/60" style={{ borderColor: ACCENT }}>
            <span className="text-white/80">Killed:</span> Shoefitr → Amazon, Presize.ai → Meta, mifitto (DE) bankrupt.
            The market is validated. The solution isn't here.
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function Dot({ name, x, y, muted }: { name: string; x: number; y: number; muted?: boolean }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className={`h-2 w-2 rounded-full ${muted ? "bg-white/40" : "bg-white"}`} />
      <div className={`mt-1 whitespace-nowrap text-[10px] ${muted ? "text-white/40" : "text-white"}`}>
        {name}
      </div>
    </div>
  );
}

function SolutionSlide() {
  return (
    <SlideShell title="Scan. Match. Buy." subtitle="60 seconds, any phone camera, no app, no hardware.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Step n="1" title="Scan" desc="Phone camera + A4 paper. 60 seconds." />
        <Step n="2" title="Match" desc='"Size 43 fits your foot in this shoe."' />
        <Step n="3" title="Buy" desc="One size. No bracketing." />
        <Step n="4" title="Track" desc="Return rate before vs. after Fitly." />
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-widest text-white/50">For retailers & marketplaces</div>
          <ul className="mt-4 space-y-2.5 text-white/80">
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> Widget on PDP — no SDK, no app download</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> SaaS fee + performance fee per prevented return</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> Shopify / Shopware plug-in, 1-line install</li>
          </ul>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-widest text-white/50">For shoppers</div>
          <ul className="mt-4 space-y-2.5 text-white/80">
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> Free, forever — no paywall, no ads</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> Triggered when fit uncertainty is highest</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> See WHY it fits, not just a black-box size</li>
          </ul>
        </div>
      </div>
    </SlideShell>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="relative border border-white/10 bg-white/[0.02] p-6">
      <div className="font-mono text-xs text-white/40">{`0${n}`}</div>
      <div className="mt-3 text-3xl font-black text-white">{title}</div>
      <div className="mt-3 text-sm text-white/60">{desc}</div>
    </div>
  );
}

function ApproachSlide() {
  return (
    <SlideShell
      title="Measure both. Online."
      subtitle="Foot scanning is proven. Shoe interior data is the missing piece — and we have a method to capture it."
    >
      <div className="grid gap-8 md:grid-cols-2">
        <div className="border border-white/10 bg-white/[0.03] p-8">
          <div className="text-xs uppercase tracking-widest" style={{ color: ACCENT }}>
            Proven technology
          </div>
          <h3 className="mt-3 text-3xl font-black text-white">Foot scanning</h3>
          <p className="mt-4 text-white/70 leading-relaxed">
            StrutFit (UGG, HOKA) and Volumental (New Balance, Fleet Feet) have proven smartphone foot
            scanning works at scale. No app needed — any smartphone, 60 seconds.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-white/50">
            <Tag>StrutFit</Tag>
            <Tag>Volumental</Tag>
            <Tag>Aetrex</Tag>
          </div>
        </div>
        <div className="border-2 p-8" style={{ borderColor: ACCENT }}>
          <div className="text-xs uppercase tracking-widest" style={{ color: ACCENT }}>
            The missing piece
          </div>
          <h3 className="mt-3 text-3xl font-black text-white">Shoe interior data</h3>
          <p className="mt-4 text-white/70 leading-relaxed">
            RunRepeat already uses physical impressions to measure shoe interiors for reviews. We scale
            this into a database. No X-ray facilities like SafeSize. No patents blocking this method.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-white/50">
            <Tag highlight>Physical casting</Tag>
            <Tag>Scalable</Tag>
            <Tag>Patent-free</Tag>
          </div>
        </div>
      </div>
      <div className="mt-10 text-center text-sm text-white/50">
        Result: accurate, model-specific fit recommendations. <span className="text-white/80">Learning from every scan and every purchase.</span>
      </div>
    </SlideShell>
  );
}

function Tag({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        highlight ? "border-[#f59e0b] text-white" : "border-white/15 text-white/60"
      }`}
      style={highlight ? { background: "rgba(245, 158, 11, 0.15)" } : undefined}
    >
      {children}
    </span>
  );
}

function MvpSlide() {
  const url = `${DEMO_URL}${DEMO_PRODUCT_PATH}`;
  return (
    <SlideShell title="It runs end-to-end. Right now." subtitle="Scan. Score. 3D fit view. Alternatives. Grounded AI fit chat.">
      <div className="grid gap-10 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col justify-center gap-6 text-white/80">
          <div className="space-y-3 text-lg leading-relaxed">
            <div className="flex gap-3">
              <span className="font-mono text-sm text-white/40">01</span>
              <span><strong className="text-white">Open the retailer page</strong> — Fitly widget sits on the product detail.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-sm text-white/40">02</span>
              <span><strong className="text-white">Scan QR with your phone</strong> — 60 seconds, no app.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-sm text-white/40">03</span>
              <span><strong className="text-white">See the result on the laptop</strong> — score, heatmap, alternatives, chat.</span>
            </div>
          </div>
          <Link
            to={DEMO_PRODUCT_PATH}
            className="inline-flex w-fit items-center gap-2 rounded-full border-2 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-black"
            style={{ borderColor: ACCENT }}
          >
            Open live demo <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="font-mono text-xs text-white/40 break-all">{url}</div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={url} size={220} />
          </div>
          <div className="text-xs uppercase tracking-widest text-white/50">Scan to try</div>
        </div>
      </div>
    </SlideShell>
  );
}

function GtmSlide() {
  return (
    <SlideShell title="Start where fit hurts most." subtitle="Running shoes first. Online retailers next. Marketplaces after proof.">
      <div className="grid gap-6 md:grid-cols-3">
        <Phase
          tag="Now"
          title="Running shoes"
          rows={[
            "Wrong fit = injury — runners care",
            "Foot scanning already mainstream (gait analysis)",
            "RunRepeat shoe database to bootstrap from",
          ]}
        />
        <Phase
          tag="Next"
          title="Outdoor & lifestyle"
          rows={[
            "Expand shoe database to 1,000+ models",
            "Shopify & Shopware plugin",
            "First manufacturer data partnerships",
          ]}
          highlight
        />
        <Phase
          tag="Later"
          title="All footwear · marketplaces"
          rows={[
            "Brands provide last/CAD data directly",
            '"Your Fitly Profile" consumer app',
            "API for Zalando, About You, Amazon",
          ]}
        />
      </div>
      <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/60">
        <strong className="text-white">KPI that matters:</strong> return rate before vs. after Fitly. The only number that counts.
      </div>
    </SlideShell>
  );
}

function Phase({ tag, title, rows, highlight }: { tag: string; title: string; rows: string[]; highlight?: boolean }) {
  return (
    <div className={`border p-6 ${highlight ? "border-[#f59e0b]/60 bg-[#f59e0b]/5" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="text-xs uppercase tracking-[0.25em]" style={{ color: highlight ? ACCENT : "rgba(255,255,255,0.4)" }}>
        {tag}
      </div>
      <div className="mt-3 text-2xl font-black text-white">{title}</div>
      <ul className="mt-5 space-y-2 text-sm text-white/70">
        {rows.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="text-white/40">—</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoadmapSlide() {
  return (
    <SlideShell title="From hackathon to first paying pilot." subtitle="Two parallel tracks. One milestone. Ten weeks.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-white/10 bg-white/[0.02] p-7">
          <div className="text-xs uppercase tracking-[0.25em] text-white/50">Commercial</div>
          <h3 className="mt-2 text-2xl font-black text-white">Validate demand. Sign one pilot.</h3>
          <ul className="mt-5 space-y-3 text-white/75">
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Onboard Adidas & Zalando advisors as design partners</li>
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Book 10 discovery calls with fashion e-commerce leads</li>
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Sign 1 paid pilot within 10 weeks</li>
          </ul>
        </div>
        <div className="border border-white/10 bg-white/[0.02] p-7">
          <div className="text-xs uppercase tracking-[0.25em] text-white/50">Product</div>
          <h3 className="mt-2 text-2xl font-black text-white">Harden the prototype.</h3>
          <ul className="mt-5 space-y-3 text-white/75">
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Replace hackathon code with production backend</li>
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Ship AI size recommendation v1 with accuracy metric</li>
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Build Shopify plug-in for one-click integration</li>
            <li className="flex gap-3"><span className="font-mono text-xs text-white/40">→</span> Instrument return-rate tracking: before vs. after</li>
          </ul>
        </div>
      </div>
    </SlideShell>
  );
}

function TeamSlide() {
  return (
    <SlideShell title="Three founders. One mission." subtitle="Católica Lisbon. E-commerce, operations, AI.">
      <div className="grid gap-6 md:grid-cols-3">
        <Founder
          name="Troels Enigk"
          role="AI, Automation & Product"
          bio="Intern → COO & CFO in Insurtech. Siemens Advanta, Eraneos Strategy, Getsafe. Católica Lisbon."
          initial="T"
        />
        <Founder
          name="Johannes Stopa"
          role="E-Commerce Strategy & BD"
          bio="Founders Associate in E-Commerce. Detecon, FUNKE Media Group, Holzrichter Berlin. Católica Lisbon & WU Vienna."
          initial="J"
        />
        <Founder
          name="Simon Mackeprang"
          role="Operations & Software Dev"
          bio="Ran own e-commerce shop. KPMG, Operations Manager A352, EbelHofer Consultants. Católica Lisbon & HEC Montreal."
          initial="S"
        />
      </div>
      <div className="mt-10 flex items-center gap-3 border-t border-white/10 pt-6 text-sm">
        <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
        <span className="text-white/60">Looking for:</span>
        <span className="text-white">Technical co-founder · ML / Computer Vision expertise</span>
        <span className="text-white/30">·</span>
        <span className="text-white">Mentor from shoe / retail-tech industry</span>
      </div>
    </SlideShell>
  );
}

function Founder({ name, role, bio, initial }: { name: string; role: string; bio: string; initial: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-6">
      <div
        className="grid h-14 w-14 place-items-center rounded-full text-2xl font-black text-black"
        style={{ background: ACCENT }}
      >
        {initial}
      </div>
      <div className="mt-5 text-xl font-black text-white">{name}</div>
      <div className="mt-1 text-xs uppercase tracking-widest" style={{ color: ACCENT }}>{role}</div>
      <p className="mt-4 text-sm leading-relaxed text-white/60">{bio}</p>
    </div>
  );
}

function PricingSlide() {
  return (
    <SlideShell title="Subscription SaaS." subtitle="Marketplaces and retailers pay. Consumers use Fitly free, forever.">
      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard
          name="Starter"
          price="€499"
          unit="per month"
          features={[
            "Up to 5k SKUs",
            "Fitly widget on PDP",
            "Core size recommender",
            "Email support",
          ]}
        />
        <PlanCard
          name="Growth"
          price="€1,499"
          unit="per month"
          tag="Popular"
          highlight
          features={[
            "Up to 50k SKUs",
            "Everything in Starter",
            "Return-rate analytics",
            "A/B testing dashboard",
            "Priority support",
          ]}
        />
        <PlanCard
          name="Enterprise"
          price="Custom"
          unit="per month"
          features={[
            "Unlimited SKUs",
            "Everything in Growth",
            "SSO + custom SLAs",
            "Dedicated CSM",
            "API + data exports",
          ]}
        />
      </div>
      <div className="mt-8 border border-white/10 bg-white/[0.02] p-5 text-sm text-white/70">
        <span className="text-white/50">Plus performance fee:</span> €0.50–1.50 per prevented return.
        <span className="text-white/50"> Consumers:</span> 100% free. No ads, no paywall.
      </div>
    </SlideShell>
  );
}

function PlanCard({
  name,
  price,
  unit,
  features,
  tag,
  highlight,
}: {
  name: string;
  price: string;
  unit: string;
  features: string[];
  tag?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative border p-6 ${highlight ? "border-[#f59e0b] bg-[#f59e0b]/5" : "border-white/10 bg-white/[0.02]"}`}>
      {tag && (
        <div className="absolute -top-3 right-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black" style={{ background: ACCENT }}>
          {tag}
        </div>
      )}
      <div className="text-xs uppercase tracking-[0.25em] text-white/50">{name}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-black text-white">{price}</span>
        <span className="text-sm text-white/40">/ {unit}</span>
      </div>
      <ul className="mt-6 space-y-2.5 text-sm text-white/70">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: highlight ? ACCENT : "rgba(255,255,255,0.4)" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskSlide() {
  return (
    <div className="flex h-full items-center justify-center px-12">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b] blur-[160px]" />
      </div>
      <div className="relative max-w-4xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/70">
          The Ask
        </div>
        <h1 className="font-black tracking-tight text-white" style={{ fontSize: "clamp(48px, 7vw, 108px)", lineHeight: 1.0 }}>
          Help us turn the
          <br />
          MVP into a{" "}
          <span style={{ color: ACCENT, fontFamily: "Instrument Serif, serif", fontStyle: "italic", fontWeight: 400 }}>
            pilot.
          </span>
        </h1>
        <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-3 text-left">
          <AskCard label="Retail access" body="Intros to Zalando, About You, Keller Sports, mid-market e-comm leads." />
          <AskCard label="Shoe-data partners" body="Brand last/CAD data. Pilot retailer ready to track returns A/B." />
          <AskCard label="ML co-founder" body="Computer Vision background. Foot-scan accuracy is the next moat." />
        </div>
        <div className="mt-12 text-sm uppercase tracking-[0.25em] text-white/50">
          troels · johannes · simon
        </div>
      </div>
    </div>
  );
}

function AskCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-widest" style={{ color: ACCENT }}>
        {label}
      </div>
      <div className="mt-2 text-sm text-white/75">{body}</div>
    </div>
  );
}

/* ---------- Shared primitives ---------- */

function SlideShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-12 pb-24 pt-28 md:px-20">
      <div className="max-w-5xl">
        <h2 className="font-black tracking-tight text-white" style={{ fontSize: "clamp(36px, 4.5vw, 68px)", lineHeight: 1.05 }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 max-w-3xl text-lg text-white/60 leading-relaxed">{subtitle}</p>
        )}
      </div>
      <div className="mt-10 flex-1">{children}</div>
    </div>
  );
}

function Stat({ value, label, desc }: { value: string; label: string; desc: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-7">
      <div className="font-black tracking-tight text-white" style={{ fontSize: "clamp(48px, 5vw, 84px)", lineHeight: 1, color: ACCENT }}>
        {value}
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">{label}</div>
      <div className="mt-2 text-sm text-white/55">{desc}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-base leading-relaxed">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
      <span>{children}</span>
    </div>
  );
}
