alter table public.scans
  add column if not exists foot_toebox_height_mm numeric,
  add column if not exists preferred_drop_mm numeric;