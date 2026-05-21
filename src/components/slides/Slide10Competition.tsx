import SlideLayout from '../SlideLayout';

const milestones = [
  { when: 'Now', title: 'Finish prototype', sub: 'Sign 1st pilot LOI' },
  { when: '3 mo', title: 'Production backend', sub: 'Shopify plug-in · 1 paid pilot live' },
  { when: '6 mo', title: '2 retailer pilots', sub: 'Convert pilots into paying customers' },
  { when: '12 mo', title: 'Expand database', sub: 'More shoes, more use cases' },
];

const Slide10Competition = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center">
    <h2 className={`text-3xl md:text-5xl font-bold mb-3 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      Next <span className="text-primary">steps.</span>
    </h2>
    <p className={`text-muted-foreground text-sm mb-12 text-center transition-all duration-700 delay-100 ${active ? 'opacity-100' : 'opacity-0'}`}>
      From hackathon prototype to scaled platform
    </p>

    <div className="relative w-full max-w-5xl px-4">
      <div
        className={`absolute left-0 right-0 top-5 h-0.5 bg-border transition-all duration-1000 delay-200 ${
          active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
        }`}
        style={{ transformOrigin: 'left' }}
      />

      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6">
        {milestones.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col items-center text-center transition-all duration-700 ${
              active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
            style={{ transitionDelay: `${300 + i * 150}ms` }}
          >
            <div
              className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                i === 0
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40'
                  : 'bg-card border-2 border-primary/40 text-primary'
              }`}
            >
              {i + 1}
            </div>
            <div className="mt-3 text-[10px] tracking-widest uppercase text-primary font-semibold">{m.when}</div>
            <div className="mt-1 font-bold text-sm md:text-base">{m.title}</div>
            <div className="mt-1 text-xs text-muted-foreground leading-snug max-w-[180px]">{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  </SlideLayout>
);

export default Slide10Competition;
