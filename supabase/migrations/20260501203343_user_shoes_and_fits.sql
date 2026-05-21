-- User-eigene Schuhsammlung + Fit-Bewertungen je Dimension.
-- Eingehängt am Auth-User; RLS sorgt dafür, dass jeder nur eigene Daten sieht/ändert.

-- ---------- Enum: 7 Fit-Dimensionen ----------
do $$ begin
  create type public.fit_dimension as enum (
    'length',         -- Länge / Zehraum (vorne)
    'toebox_width',   -- Breite an den Zehen
    'forefoot_width', -- Vorfuß / Ballenbreite
    'midfoot',        -- Mittelfuß / Spann (Schnürung)
    'heel',           -- Ferse (Halt)
    'drop',           -- Sprengung (Heel-Drop-Empfinden)
    'cushion'         -- Dämpfung / Stack
  );
exception when duplicate_object then null; end $$;

-- ---------- Enum: 5-Punkt-Skala ----------
do $$ begin
  create type public.fit_rating as enum (
    'much_too_tight',   -- viel zu eng
    'slightly_tight',   -- etwas zu eng
    'perfect',          -- perfekt
    'slightly_loose',   -- etwas zu weit
    'much_too_loose'    -- viel zu weit
  );
exception when duplicate_object then null; end $$;

-- ---------- user_shoes ----------
create table if not exists public.user_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Optional: Verknüpfung zu Katalog-Schuh
  shoe_id uuid references public.shoes(id) on delete set null,
  -- Free-form Felder, falls Schuh nicht im Katalog
  brand_name text,
  model_name text,
  size_eu numeric(4,1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_shoes_min_identification check (
    shoe_id is not null or model_name is not null
  )
);

create index if not exists user_shoes_user_id_idx
  on public.user_shoes (user_id, created_at desc);

create index if not exists user_shoes_shoe_id_idx
  on public.user_shoes (shoe_id);

alter table public.user_shoes enable row level security;

drop policy if exists user_shoes_select_own on public.user_shoes;
create policy user_shoes_select_own
  on public.user_shoes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_shoes_insert_own on public.user_shoes;
create policy user_shoes_insert_own
  on public.user_shoes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_shoes_update_own on public.user_shoes;
create policy user_shoes_update_own
  on public.user_shoes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_shoes_delete_own on public.user_shoes;
create policy user_shoes_delete_own
  on public.user_shoes for delete
  to authenticated
  using (auth.uid() = user_id);

-- updated_at Trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_shoes_set_updated_at on public.user_shoes;
create trigger user_shoes_set_updated_at
  before update on public.user_shoes
  for each row execute function public.set_updated_at();

-- ---------- user_shoe_fits ----------
create table if not exists public.user_shoe_fits (
  id uuid primary key default gen_random_uuid(),
  user_shoe_id uuid not null references public.user_shoes(id) on delete cascade,
  dimension public.fit_dimension not null,
  rating public.fit_rating not null,
  -- optionale Free-form Notiz pro Dimension (z.B. "rutscht ab km 10")
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_shoe_id, dimension)
);

create index if not exists user_shoe_fits_user_shoe_id_idx
  on public.user_shoe_fits (user_shoe_id);

alter table public.user_shoe_fits enable row level security;

-- RLS via JOIN über user_shoes: Zugriff nur, wenn der dahinterliegende Schuh dem User gehört
drop policy if exists user_shoe_fits_select_own on public.user_shoe_fits;
create policy user_shoe_fits_select_own
  on public.user_shoe_fits for select
  to authenticated
  using (
    exists (
      select 1 from public.user_shoes us
      where us.id = user_shoe_fits.user_shoe_id
        and us.user_id = auth.uid()
    )
  );

drop policy if exists user_shoe_fits_insert_own on public.user_shoe_fits;
create policy user_shoe_fits_insert_own
  on public.user_shoe_fits for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_shoes us
      where us.id = user_shoe_fits.user_shoe_id
        and us.user_id = auth.uid()
    )
  );

drop policy if exists user_shoe_fits_update_own on public.user_shoe_fits;
create policy user_shoe_fits_update_own
  on public.user_shoe_fits for update
  to authenticated
  using (
    exists (
      select 1 from public.user_shoes us
      where us.id = user_shoe_fits.user_shoe_id
        and us.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_shoes us
      where us.id = user_shoe_fits.user_shoe_id
        and us.user_id = auth.uid()
    )
  );

drop policy if exists user_shoe_fits_delete_own on public.user_shoe_fits;
create policy user_shoe_fits_delete_own
  on public.user_shoe_fits for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_shoes us
      where us.id = user_shoe_fits.user_shoe_id
        and us.user_id = auth.uid()
    )
  );

drop trigger if exists user_shoe_fits_set_updated_at on public.user_shoe_fits;
create trigger user_shoe_fits_set_updated_at
  before update on public.user_shoe_fits
  for each row execute function public.set_updated_at();
