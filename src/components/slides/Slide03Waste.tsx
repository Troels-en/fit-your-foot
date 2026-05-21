import SlideLayout from '../SlideLayout';
import shoesLandfill from '@/assets/shoes-landfill.jpg';
import { useCountUp } from '@/hooks/useCountUp';

const Slide03Waste = ({ active }: { active: boolean }) => {
  const millions = useCountUp(300, 2000, active);

  return (
    <SlideLayout className="items-center justify-center text-center">
      <div
        className={`relative w-full max-w-4xl rounded-2xl overflow-hidden border border-border transition-all duration-700 ${
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <img
          src={shoesLandfill}
          alt="Mountain of discarded shoes in a landfill"
          width={1920}
          height={1080}
          loading="lazy"
          className="w-full h-[55vh] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div
        className={`mt-8 transition-all duration-700 delay-300 ${
          active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="text-5xl md:text-7xl font-bold text-primary leading-none">
          {millions}M+
        </div>
        <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-md mx-auto">
          shoes thrown away every year. Most of them never even worn.
        </p>
      </div>
    </SlideLayout>
  );
};

export default Slide03Waste;
