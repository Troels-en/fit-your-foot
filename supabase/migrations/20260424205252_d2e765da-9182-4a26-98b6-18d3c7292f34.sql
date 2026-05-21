drop policy if exists "scans_anon_select" on public.scans;
drop policy if exists "scans_anon_insert" on public.scans;
drop policy if exists "scans_anon_update" on public.scans;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scans'
  ) then
    alter publication supabase_realtime drop table public.scans;
  end if;
end $$;