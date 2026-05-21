drop policy if exists "scans_select_own" on public.scans;
create policy "scans_select_own"
  on public.scans for select
  to authenticated
  using (auth.uid() = user_id);