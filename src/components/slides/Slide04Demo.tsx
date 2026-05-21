import { useState, useEffect } from 'react';
import { Smartphone, Camera, Sparkles, ArrowRight, QrCode, RotateCcw } from 'lucide-react';
import SlideLayout from '../SlideLayout';
import nikeVaporfly from '@/assets/nike-vaporfly-4.png';

type Step = 'pdp' | 'qr' | 'scan' | 'result';

const Slide04Demo = ({ active }: { active: boolean }) => {
  const [step, setStep] = useState<Step>('pdp');
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep('pdp');
      setScanProgress(0);
    }
  }, [active]);

  useEffect(() => {
    if (step !== 'scan') return;
    setScanProgress(0);
    const id = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) { clearInterval(id); setTimeout(() => setStep('result'), 400); return 100; }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(id);
  }, [step]);

  const sizes = [
    { eu: 40, match: 42 },
    { eu: 41, match: 71 },
    { eu: 42, match: 96 },
    { eu: 43, match: 84 },
    { eu: 44, match: 51 },
  ];

  return (
    <SlideLayout>
      <div className="relative w-full mb-4">
        <div className="text-center">
          <h2 className={`text-3xl md:text-5xl font-bold mb-2 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            See it in action
          </h2>
          <p className={`text-muted-foreground text-sm transition-all duration-700 delay-100 ${active ? 'opacity-100' : 'opacity-0'}`}>
            Two photos. One perfect fit.
          </p>
        </div>
        <button
          onClick={() => { setStep('pdp'); setScanProgress(0); }}
          className="absolute top-1/2 -translate-y-1/2 right-0 hidden md:flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center transition-all duration-700 delay-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-background/50 border-b border-border">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="text-[10px] text-muted-foreground ml-2 truncate">kellersports.com / nike-vaporfly-4</span>
          </div>
          <div className="p-4">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                <img src={nikeVaporfly} alt="Nike Vaporfly 4" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground">NIKE</div>
                <div className="text-sm font-bold truncate">Nike Vaporfly 4</div>
                <div className="text-sm font-semibold mt-0.5">€259.00</div>
                <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium">
                  <Sparkles size={8} /> Fit Check
                </div>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-muted-foreground mb-1.5">Size (EU)</div>
            <div className="grid grid-cols-5 gap-1.5">
              {sizes.map(s => {
                const worst = step === 'result' && s.match === 96;
                return (
                  <div
                    key={s.eu}
                    className={`relative h-9 rounded border text-xs font-medium flex items-center justify-center transition-all ${
                      worst
                        ? 'border-red-500/60 bg-red-500/10 text-red-500'
                        : step === 'result'
                          ? 'border-border bg-background text-muted-foreground'
                          : 'border-border bg-background'
                    }`}
                  >
                    {s.eu}
                    {worst && (
                      <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1 rounded-full bg-red-500 text-white">
                        22%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[9px] tracking-widest uppercase text-muted-foreground">Powered by Fitly</div>
              <div className="text-sm font-semibold mt-0.5">Does this shoe fit your foot?</div>
              {step === 'pdp' && (
                <button
                  onClick={() => setStep('qr')}
                  className="mt-3 w-full py-2 rounded-md bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Start fit check
                </button>
              )}
              {step === 'qr' && (
                <div className="mt-2 text-[10px] text-primary flex items-center gap-1">
                  <QrCode size={10} /> Scan with phone → ready
                </div>
              )}
              {(step === 'scan' || step === 'result') && (
                <div className="mt-2 text-[10px] text-primary flex items-center gap-1">
                  <Smartphone size={10} /> Connected to mobile
                </div>
              )}
              {step === 'result' && (
                <div className="mt-3 rounded-md bg-red-500/10 border border-red-500/30 p-2">
                  <div className="text-[10px] text-red-500 font-bold">POOR FIT · 22%</div>
                  <div className="text-[10px] text-foreground/80 mt-0.5">Toe box too narrow · would likely return. See better matches on your phone →</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <ArrowRight className="hidden md:block text-primary mx-auto animate-pulse" size={28} />

        <div className="mx-auto w-[220px] h-[440px] rounded-[36px] border-[6px] border-foreground/80 bg-background overflow-hidden relative shadow-2xl">
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-foreground/80 z-10" />
          <div className="h-full w-full p-3 pt-7 flex flex-col">
            {step === 'pdp' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <Smartphone size={36} className="mb-3 opacity-40" />
                <div className="text-xs">Waiting for fit check to start in shop…</div>
              </div>
            )}
            {step === 'qr' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="text-xs text-muted-foreground mb-3">Scan link opened</div>
                <div className="text-sm font-bold mb-1">Hi! 👋</div>
                <div className="text-xs text-muted-foreground mb-5">We'll take 2 photos of your foot. Have an A4 sheet ready.</div>
                <button
                  onClick={() => setStep('scan')}
                  className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                >
                  Let's go
                </button>
                <button
                  onClick={() => setStep('scan')}
                  className="mt-2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Use demo data
                </button>
              </div>
            )}
            {step === 'scan' && (
              <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                <div className="relative w-32 h-32 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/40 flex items-center justify-center overflow-hidden">
                  <span className="text-5xl">🦶</span>
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
                    style={{ top: `${scanProgress}%` }}
                  />
                  <div className="absolute inset-2 border border-primary/40 rounded" />
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-primary">
                  <Camera size={10} /> Photo 1: top · Photo 2: side
                </div>
                <div className="mt-3 w-full bg-card rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${scanProgress}%` }} />
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">Computing 3D profile… {scanProgress}%</div>
              </div>
            )}
            {step === 'result' && (
              <div className="flex-1 flex flex-col p-2 overflow-hidden">
                <div className="text-center mb-1.5">
                  <div className="text-[8px] tracking-widest uppercase text-muted-foreground">Powered by Fitly</div>
                  <div className="text-[11px] font-bold mt-0.5">Fit Check</div>
                </div>

                <div className="flex items-center justify-center mb-1">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="rgb(239 68 68)" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray="22 100"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-sm font-bold leading-none">22%</div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[9px] font-bold text-red-500 uppercase tracking-wider mb-1.5">
                  Poor fit
                </div>

                <div className="rounded-md border border-border bg-card overflow-hidden text-[7px]">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 py-0.5 border-b border-border text-muted-foreground tracking-wider uppercase">
                    <span>Param</span><span>Foot</span><span>Shoe</span><span>Δ</span>
                  </div>
                  {[
                    { p: 'Length', a: '276', b: '285', d: '−9', ok: true },
                    { p: 'Ball', a: '105', b: '94', d: '+11', ok: false },
                    { p: 'Heel', a: '78', b: '67', d: '+11', ok: false },
                    { p: 'Toe box', a: '—', b: 'Narrow', d: '—', ok: false },
                  ].map(r => (
                    <div key={r.p} className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-1.5 py-0.5 items-center">
                      <span className="text-foreground/80">{r.p}</span>
                      <span className="font-medium tabular-nums">{r.a}</span>
                      <span className="font-medium tabular-nums">{r.b}</span>
                      <span className={`tabular-nums font-semibold ${r.ok ? 'text-primary' : 'text-red-500'}`}>{r.d}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2">
                  <div className="text-[7px] tracking-widest uppercase text-muted-foreground mb-1">Better matches</div>
                  <div className="space-y-1">
                    {[
                      { name: 'HOKA Bondi 8', match: 94 },
                      { name: 'NB 990v6', match: 89 },
                      { name: 'On Cloudsurfer', match: 86 },
                    ].map(s => (
                      <div key={s.name} className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-border bg-background">
                        <span className="text-xs">👟</span>
                        <span className="flex-1 text-[8px] font-semibold truncate">{s.name}</span>
                        <span className="text-[8px] font-bold text-primary">{s.match}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-6 flex items-center justify-center gap-2 text-[11px] transition-all duration-700 delay-400 ${active ? 'opacity-100' : 'opacity-0'}`}>
        {(['pdp', 'qr', 'scan', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s)}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                step === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {i + 1}. {s === 'pdp' ? 'Shop' : s === 'qr' ? 'QR' : s === 'scan' ? 'Scan' : 'Match'}
            </button>
            {i < 3 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>
    </SlideLayout>
  );
};

export default Slide04Demo;
