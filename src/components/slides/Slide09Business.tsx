import { Smile, Store } from 'lucide-react';
import SlideLayout from '../SlideLayout';

const benefits = {
  user: {
    icon: Smile,
    label: 'For end users',
    sub: 'Free, fast, confident',
    items: [
      'Find the perfect size in 60 seconds',
      'No more painful guesswork',
      'Discover shoes that actually fit',
    ],
  },
  retailer: {
    icon: Store,
    label: 'For retailers',
    sub: 'Fewer returns, higher conversion',
    items: [
      'Up to 50% fewer size-related returns',
      'Higher checkout conversion',
      'First-party fit data on every customer',
    ],
  },
};

const Slide09Business = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center">
    <h2 className={`text-3xl md:text-5xl font-bold mb-3 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      Wins on <span className="text-primary">both sides.</span>
    </h2>
    <p className={`text-muted-foreground text-sm mb-10 text-center transition-all duration-700 delay-100 ${active ? 'opacity-100' : 'opacity-0'}`}>
      Free for shoppers. Retailers pay.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
      {(['user', 'retailer'] as const).map((key, i) => {
        const b = benefits[key];
        return (
          <div
            key={key}
            className={`rounded-xl border border-border bg-card p-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${200 + i * 200}ms` }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <b.icon size={20} className="text-primary" />
              </div>
              <div>
                <div className="font-bold text-base">{b.label}</div>
                <div className="text-[11px] text-muted-foreground italic">{b.sub}</div>
              </div>
            </div>
            <ul className="space-y-2">
              {b.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-primary mt-0.5">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  </SlideLayout>
);

export default Slide09Business;
