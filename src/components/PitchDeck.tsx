import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FitlyLogo from './FitlyLogo';
import Slide01Title from './slides/Slide01Title';
import Slide02Problem from './slides/Slide02Problem';
import Slide04Insight from './slides/Slide04Insight';
import Slide03Waste from './slides/Slide03Waste';
import Slide04Demo from './slides/Slide04Demo';
import Slide05Matrix from './slides/Slide05Matrix';
import Slide08Market from './slides/Slide08Market';
import Slide09Business from './slides/Slide09Business';
import Slide10Competition from './slides/Slide10Competition';
import Slide13Ask from './slides/Slide13Ask';

const TOTAL_SLIDES = 10;

const PitchDeck = () => {
  const [current, setCurrent] = useState(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#slide-(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= TOTAL_SLIDES) return n - 1;
    }
    return 0;
  });

  const [, setDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    window.location.hash = `slide-${current + 1}`;
  }, [current]);

  const go = useCallback((dir: 'left' | 'right') => {
    setDirection(dir);
    setCurrent(prev => {
      if (dir === 'right') return Math.min(prev + 1, TOTAL_SLIDES - 1);
      return Math.max(prev - 1, 0);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go('right'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go('left'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) go(diff > 0 ? 'right' : 'left');
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [go]);

  const slides = [
    Slide01Title, Slide02Problem, Slide03Waste, Slide04Insight,
    Slide05Matrix, Slide09Business, Slide04Demo, Slide08Market,
    Slide10Competition, Slide13Ask,
  ];

  return (
    <div className="pitch-scope relative w-screen h-screen overflow-hidden bg-background">
      <div className="absolute top-5 left-6 z-20">
        <FitlyLogo />
      </div>

      <div className="relative w-full h-full">
        {slides.map((SlideComponent, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-all duration-500 ease-out ${
              i === current
                ? 'opacity-100 translate-x-0 pointer-events-auto'
                : i < current
                ? 'opacity-0 -translate-x-full pointer-events-none'
                : 'opacity-0 translate-x-full pointer-events-none'
            }`}
          >
            <SlideComponent active={i === current} />
          </div>
        ))}
      </div>

      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-between px-6 z-20">
        <button
          onClick={() => go('left')}
          disabled={current === 0}
          className="p-2 rounded-full bg-card/80 border border-border text-foreground disabled:opacity-20 hover:bg-card transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium tabular-nums">
            {current + 1} / {TOTAL_SLIDES}
          </span>
          <button
            onClick={() => go('right')}
            disabled={current === TOTAL_SLIDES - 1}
            className="p-2 rounded-full bg-card/80 border border-border text-foreground disabled:opacity-20 hover:bg-card transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border z-20">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default PitchDeck;
