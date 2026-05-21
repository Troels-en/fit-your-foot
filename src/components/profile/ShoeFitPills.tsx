import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FIT_DIMENSIONS,
  FIT_RATINGS,
  RATING_TONE,
  ratingLabel,
  ratingDescription,
  type FitDimension,
  type FitRating,
} from "./fitConstants";

type Props = {
  ratings: Partial<Record<FitDimension, FitRating>>;
  onChange: (dimension: FitDimension, rating: FitRating) => void;
};

export default function ShoeFitPills({ ratings, onChange }: Props) {
  const [open, setOpen] = useState<FitDimension | null>(null);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-2">
        {FIT_DIMENSIONS.map((dim) => {
          const current = ratings[dim.key];
          const tone = current ? RATING_TONE[current] : "bg-muted text-muted-foreground border-border";
          const currentShort = current ? FIT_RATINGS.find((r) => r.key === current)?.short : "—";
          return (
            <Popover
              key={dim.key}
              open={open === dim.key}
              onOpenChange={(o) => setOpen(o ? dim.key : null)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-xs font-medium transition hover:scale-[1.02]",
                        tone
                      )}
                    >
                      {dim.short}
                      <span className="ml-1.5 opacity-70">{currentShort}</span>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="font-semibold mb-1">{dim.label}</div>
                  <div className="text-xs text-muted-foreground">{dim.description}</div>
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-72 p-3" align="start">
                <div className="text-xs font-semibold text-muted-foreground mb-1">{dim.label}</div>
                <div className="text-[11px] text-muted-foreground mb-3 leading-snug">
                  {dim.description}
                </div>
                <div className="flex flex-col gap-1">
                  {FIT_RATINGS.map((r) => {
                    const isActive = current === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          onChange(dim.key, r.key);
                          setOpen(null);
                        }}
                        title={ratingDescription(dim.key, r.key)}
                        className={cn(
                          "text-left text-sm px-3 py-2 rounded-md border transition",
                          isActive ? r.tone : "border-transparent hover:bg-muted"
                        )}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="inline-block w-6 font-bold">{r.short}</span>
                          <span className="font-medium">{ratingLabel(dim.key, r.key)}</span>
                        </div>
                        <div
                          className={cn(
                            "text-[11px] mt-0.5 ml-8 leading-snug",
                            isActive ? "opacity-90" : "text-muted-foreground"
                          )}
                        >
                          {ratingDescription(dim.key, r.key)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
