-- ---------- shoes: öffentlich lesbar ----------
alter table public.shoes enable row level security;
drop policy if exists "shoes_public_read" on public.shoes;
create policy "shoes_public_read"
  on public.shoes for select
  to anon, authenticated
  using (true);

-- ---------- brands: öffentlich lesbar ----------
alter table public.brands enable row level security;
drop policy if exists "brands_public_read" on public.brands;
create policy "brands_public_read"
  on public.brands for select
  to anon, authenticated
  using (true);

-- ---------- scans: anon darf pending anlegen, lesen, updaten ----------
alter table public.scans enable row level security;

drop policy if exists "scans_anon_insert" on public.scans;
create policy "scans_anon_insert"
  on public.scans for insert
  to anon, authenticated
  with check (true);

drop policy if exists "scans_anon_select" on public.scans;
create policy "scans_anon_select"
  on public.scans for select
  to anon, authenticated
  using (true);

drop policy if exists "scans_anon_update" on public.scans;
create policy "scans_anon_update"
  on public.scans for update
  to anon, authenticated
  using (true)
  with check (true);

-- Realtime: scans in supabase_realtime publication aufnehmen
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scans'
  ) then
    execute 'alter publication supabase_realtime add table public.scans';
  end if;
end$$;

alter table public.scans replica identity full;