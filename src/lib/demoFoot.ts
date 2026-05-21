// Demo foot measurements used for pitch presentations.
// Tuned so the narrative is "well-fitting shoes are equal-or-slightly-wider":
//  - narrow race shoes (Vaporfly 94mm) → 6mm narrower than foot → squeezes
//  - regular trainers (Brooks 99mm) → 1mm narrower → ok but tight
//  - wide trainers (NB 990v6, HOKA Bondi ~100-101mm) → equal/slightly wider → great
// preferred_drop_mm is 8mm so shoes with very different drops (Bondi 4mm,
// Cloudsurfer 5mm, NB 8mm) score visibly differently in the alternatives.

export const DEMO_FOOT_MM = {
  foot_length_mm: 276,
  foot_width_mm: 100,
  ball_width_mm: 100,
  heel_width_mm: 76,
  foot_toebox_height_mm: 32,
  preferred_drop_mm: 8,
  arch_type: "medium" as const,
  eu_size: 44,
};
