import SlideLayout from '../SlideLayout';

const phases = [
  { tag: 'NOW', title: 'Running Shoes', sub: 'Online-only retailers', emoji: '🏃', highlight: true },
  { tag: 'NEXT', title: 'Outdoor & Lifestyle', sub: 'Mid-size e-commerce', emoji: '🥾' },
  { tag: 'LATER', title: 'All Footwear', sub: 'Marketplaces & brands', emoji: '👞' },
];

const Slide08Market = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center">
    <h2 className={`text-3xl md:text-5xl font-bold mb-12 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      Where we <span className="text-primary">start.</span>
    </h2>

    <div className="w-full max-w-4xl flex items-center gap-3">
      {phases.map((p, i) => (
        <div key={i} className="flex-1 flex items-center gap-3">
          <div
            className={`flex-1 rounded-xl p-5 text-center border transition-all duration-700 ${
              p.highlight ? 'border-primary bg-primary/10' : 'border-border bg-card'
            } ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay: `${200 + i * 200}ms` }}
          >
            <div className="text-3xl mb-2">{p.emoji}</div>
            <div className={`text-[10px] tracking-widest font-bold ${p.highlight ? 'text-primary' : 'text-muted-foreground'}`}>{p.tag}</div>
            <div className="text-base font-bold mt-1">{p.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{p.sub}</div>
          </div>
          {i < phases.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>

    <p className={`mt-10 text-sm text-muted-foreground transition-all duration-700 delay-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
      Fit matters most when wrong fit means injury.
    </p>
  </SlideLayout>
);

export default Slide08Market;
