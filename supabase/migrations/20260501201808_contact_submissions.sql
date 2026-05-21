-- Audit-Log + Rate-Limit-Quelle für die send-contact Edge Function.
-- Kein Lese- oder Schreibzugriff für anon/authenticated; nur die Function
-- (mit service-role Key) füllt und liest die Tabelle.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  ip inet,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_ip_created_at_idx
  on public.contact_submissions (ip, created_at desc);

alter table public.contact_submissions enable row level security;

-- Keine Policies → kein Zugriff via anon/authenticated. Nur service-role
-- (das die Edge Function nutzt) bypassed RLS und kann Insert/Select.
