import SlideLayout from '../SlideLayout';
import { useCountUp } from '../../hooks/useCountUp';

const Slide02Problem = ({ active }: { active: boolean }) => {
  const billions = useCountUp(4, 1500, active);

  return (
    <SlideLayout className="items-center text-center">
      <h2 className={`text-3xl md:text-5xl font-bold mb-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Online shoe shopping is <span className="text-primary">broken.</span>
      </h2>
      <p className={`text-muted-foreground mb-12 transition-all duration-700 delay-100 ${active ? 'opacity-100' : 'opacity-0'}`}>
        40% return rate · €20 per return · #1 reason: wrong fit
      </p>
      <div className={`transition-all duration-700 delay-300 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        <div className="text-7xl md:text-9xl font-bold text-primary leading-none">€{billions}B</div>
        <div className="text-sm md:text-base text-muted-foreground mt-4 max-w-md mx-auto">
          wasted on shoe returns in Europe, every year
        </div>
      </div>
    </SlideLayout>
  );
};

export default Slide02Problem;
