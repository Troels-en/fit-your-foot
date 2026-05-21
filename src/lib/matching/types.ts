export type ArchType = "low" | "medium" | "high";

export type RunnerType = "casual" | "racing" | "daily" | "long" | "trail";

export type FitPreference = "snug" | "regular" | "roomy";

export type FootProfile = {
  foot_length_mm: number;
  ball_width_mm: number;
  heel_width_mm?: number | null;
  foot_width_mm?: number | null;
  arch_type?: ArchType | null;
  eu_size?: number | null;
  runner_type?: RunnerType;
  fit_preference?: FitPreference;
};

export type ShoeDims = {
  id?: string;
  inner_length_mm?: number | null;
  outer_length_mm?: number | null;
  width_mm?: number | null;
  forefoot_width_mm?: number | null;
  heel_width_mm?: number | null;
  toebox_width_mm?: number | null;
  toebox_height_mm?: number | null;
  toebox?: string | null;
  width_grade?: string | null;
  arch_support?: string | null;
  heel_drop_mm?: number | null;
  heel_stack_mm?: number | null;
  forefoot_stack_mm?: number | null;
  retour_rate_pct?: number | null;
  available_sizes?: number[] | null;
  gender?: string | null;
  category?: string | null;
};

export type SubScoreKey =
  | "length"
  | "ballWidth"
  | "heelFit"
  | "toebox"
  | "widthGrade"
  | "archSupport"
  | "dropStack"
  | "returnSig";

export type SubScore = {
  key: SubScoreKey;
  score: number; // 0..100
  reason?: string;
};

export type FitFlags = {
  needsBigger: boolean;
  needsSmaller: boolean;
  needsWider: boolean;
  needsNarrower: boolean;
  needsRoomierToebox: boolean;
  needsMoreArchSupport: boolean;
};

export type FitBand = "great" | "ok" | "poor";

export type FitResult = {
  score: number; // 0..100
  band: FitBand;
  label: string; // German user-facing label
  reasons: string[]; // Top 3 actionable reasons
  flags: FitFlags;
  subScores: SubScore[]; // for diagnostics / UI bar charts
};

export type RankedShoe<S extends ShoeDims> = {
  shoe: S;
  fit: FitResult;
};
