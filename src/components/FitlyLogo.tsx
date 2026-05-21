import { Footprints } from 'lucide-react';
import { Link } from 'react-router-dom';

const FitlyLogo = ({ size = 'default' }: { size?: 'default' | 'large' }) => {
  const textClass = size === 'large' ? 'text-4xl md:text-5xl' : 'text-xl';
  const iconSize = size === 'large' ? 32 : 18;

  return (
    <Link
      to="/"
      aria-label="Zurück zur Startseite"
      className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <Footprints size={iconSize} className="text-primary" />
      <span className={`${textClass} font-bold tracking-tight text-foreground`}>
        Fit<span className="text-primary">ly</span>
      </span>
    </Link>
  );
};

export default FitlyLogo;
