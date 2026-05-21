import SlideLayout from '../SlideLayout';

interface Competitor {
  name: string;
  x: number;
  y: number;
  isUs?: boolean;
}

const competitors: Competitor[] = [
  { name: 'Run Repeat', x: 14, y: 82 },
  { name: 'SafeSize', x: 56, y: 68 },
  { name: 'Volumental', x: 72, y: 54 },
  { name: 'TrueFit', x: 30, y: 32 },
  { name: 'StrutFit', x: 64, y: 30 },
  { name: 'Fitly', x: 86, y: 86, isUs: true },
];

const Slide05Matrix = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center justify-center">
    <h2
      className={`text-3xl md:text-5xl font-bold mb-3 text-center transition-all duration-700 ${
        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      Competition: we own the <span className="text-primary">whole map.</span>
    </h2>
    <p
      className={`text-muted-foreground text-xs md:text-sm mb-8 text-center transition-all duration-700 delay-100 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      Competitive landscape
    </p>

    <div
      className={`relative w-full max-w-xl aspect-[4/3] transition-all duration-700 delay-200 ${
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 -rotate-90 text-[10px] md:text-xs text-muted-foreground whitespace-nowrap tracking-wide">
        Shoe Interior Data →
      </div>

      <div className="relative w-full h-full rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />

        {competitors.map((c, i) => (
          <div
            key={c.name}
            className="absolute"
            style={{
              left: `${c.x}%`,
              bottom: `${c.y}%`,
              transform: 'translate(-50%, 50%)',
              transitionDelay: `${300 + i * 80}ms`,
            }}
          >
            <div className="flex flex-col items-center">
              {c.isUs ? (
                <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse">
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-primary" />
                </div>
              ) : (
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary shadow-md" />
              )}
              <div
                className={`mt-1.5 text-[10px] md:text-xs whitespace-nowrap ${
                  c.isUs ? 'text-primary font-bold' : 'text-foreground/80'
                }`}
              >
                {c.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-center text-[10px] md:text-xs text-muted-foreground tracking-wide">
        Online Foot Scanning →
      </div>
    </div>
  </SlideLayout>
);

export default Slide05Matrix;
