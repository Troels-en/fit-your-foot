import SlideLayout from '../SlideLayout';
import { Footprints, Box, Globe } from 'lucide-react';

const pillars = [
  { icon: Footprints, label: 'Know the foot', sub: 'Length, width, arch, volume' },
  { icon: Box, label: 'Know the shoe', sub: 'How it\'s shaped inside' },
  { icon: Globe, label: 'Do it online', sub: 'Where the problem lives' },
];

const Slide04Insight = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center text-center">
    <h2 className={`text-3xl md:text-5xl font-bold mb-4 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      Everyone solves a piece. <span className="text-primary">We connect them all.</span>
    </h2>
    <p className={`text-muted-foreground text-sm md:text-base mb-12 transition-all duration-700 delay-100 ${active ? 'opacity-100' : 'opacity-0'}`}>
      The right fit online needs three things together:
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mb-10">
      {pillars.map((p, i) => (
        <div
          key={i}
          className={`rounded-xl border border-border bg-card p-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          style={{ transitionDelay: `${200 + i * 150}ms` }}
        >
          <p.icon size={28} className="text-primary mx-auto mb-3" />
          <div className="font-bold text-base">{p.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{p.sub}</div>
        </div>
      ))}
    </div>
    <p className={`text-lg md:text-xl font-bold text-primary transition-all duration-700 delay-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
      Competitors solve one. We deliver the full picture.
    </p>
  </SlideLayout>
);

export default Slide04Insight;
