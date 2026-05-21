import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  variant?: "default" | "light";
}

export function Logo({ className = "", variant = "default" }: LogoProps) {
  const color = variant === "light" ? "text-white" : "text-foreground";
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${color} ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M4 14h6M14 4v20M18 8l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-bold text-lg tracking-tight">fitly</span>
    </Link>
  );
}
