import SlideLayout from '../SlideLayout';
import FitlyLogo from '../FitlyLogo';

const Slide01Title = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center text-center">
    <div className={`transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <FitlyLogo size="large" />
    </div>
    <h1 className={`text-4xl md:text-6xl lg:text-7xl font-bold mt-8 max-w-4xl leading-tight transition-all duration-700 delay-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      We make shoe returns <span className="text-gradient">disappear.</span>
    </h1>
    <p className={`text-sm text-muted-foreground mt-12 tracking-widest uppercase transition-all duration-700 delay-500 ${active ? 'opacity-100' : 'opacity-0'}`}>
      Pre-Seed · 2026
    </p>
  </SlideLayout>
);

export default Slide01Title;
