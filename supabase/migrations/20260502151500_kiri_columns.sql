-- KIRI Engine API Integration: erweitere scans-Table um Photogrammetry-Felder
-- + Rate-Limit-Table für anonyme kiri-submit-Calls.
--
-- Idempotent: alle ALTERs / CREATEs verwenden IF NOT EXISTS bzw. duplicate-guards.

alter table public.scans
  add column if not exists kiri_serialize text,
  add column if not exists kiri_status smallint,
  add column if not exists kiri_model_url text,
  add column if not exists kiri_model_url_fetched_at timestamptz,
  add column if not exists kiri_error text,
  add column if not exists kiri_frame_count integer,
  add column if not exists kiri_submitted_at timestamptz,
  add column if not exists kiri_completed_at timestamptz;

comment on column public.scans.kiri_serialize is 'KIRI Engine Job-ID. NULL = nie an KIRI submittiert (alter 2-Foto-Flow).';
comment on column public.scans.kiri_status is 'KIRI numeric status: -1=Uploading, 0=Processing, 1=Failed, 2=Successful, 3=Queuing, 4=Expired.';
comment on column public.scans.kiri_model_url is 'Mesh-ZIP-Download-URL. TTL 60min ab fetched_at — nach Ablauf re-fetcht kiri-status.';
comment on column public.scans.kiri_model_url_fetched_at is 'Timestamp wann modelUrl von KIRI gefetcht wurde. Wenn >55min alt, gilt URL als stale.';
comment on column public.scans.kiri_error is 'Klartext-Fehler bei kiri_status IN (1,4) oder Edge-Function-Failure.';

-- Rate-Limit-Table für kiri-submit. Pattern wie contact_submissions, aber
-- niedrigerer Cap weil jede Submission KIRI-Credits verbrennt.
create table if not exists public.kiri_submissions (
  id uuid primary key default gen_random_uuid(),
  ip inet,
  scan_id uuid references public.scans(id) on delete set null,
  frame_count integer,
  created_at timestamptz not null default now()
);

create index if not exists kiri_submissions_ip_created_idx
  on public.kiri_submissions (ip, created_at desc);

-- RLS: nur Service-Role schreibt/liest. Public hat keinen Zugang.
alter table public.kiri_submissions enable row level security;

drop policy if exists kiri_submissions_no_select on public.kiri_submissions;
create policy kiri_submissions_no_select
  on public.kiri_submissions
  for select
  to anon, authenticated
  using (false);

drop policy if exists kiri_submissions_no_insert on public.kiri_submissions;
create policy kiri_submissions_no_insert
  on public.kiri_submissions
  for insert
  to anon, authenticated
  with check (false);

comment on table public.kiri_submissions is 'Audit + IP-Rate-Limit für kiri-submit Edge-Function. Nur Service-Role.';
