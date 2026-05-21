-- Approval-Gate für die ganze Site bis wir wirklich live sind.
-- Jeder Signup → Mail an Admin → Approve/Reject. Reject = Warteliste.
-- User kann selbst Warteliste wählen beim Signup.
--
-- Sicherheits-Design (post adversarial review):
-- 1. approval_token lebt in einer SEPARATEN Tabelle (profile_approvals),
--    die für authenticated/anon NICHT lesbar ist. Sonst könnten User
--    den Token aus dem eigenen profile-Row lesen und sich selbst approven.
-- 2. signup-decide ist server-side (POST) — GET zeigt nur die Confirm-Page
--    ohne Side-Effects (sonst würden Email-Link-Scanner auto-approve).
-- 3. Trigger nutzt current_setting('role') statt JWT-Claims-Parsing.

-- ---------- Approval-Status Enum ----------
do $$ begin
  create type public.approval_status as enum (
    'pending',     -- frisch registriert, wartet auf Admin
    'approved',    -- voller Access
    'rejected',    -- Admin hat abgelehnt → Warteliste
    'waitlist'     -- User hat selbst Warteliste gewählt
  );
exception when duplicate_object then null; end $$;

-- ---------- profiles: nur sichtbare Approval-Felder ----------
alter table public.profiles add column if not exists approval_status public.approval_status not null default 'pending';
alter table public.profiles add column if not exists approval_decided_at timestamptz;
alter table public.profiles add column if not exists agbs_accepted_at timestamptz;
alter table public.profiles add column if not exists newsletter_consent boolean not null default false;
alter table public.profiles add column if not exists requested_at timestamptz not null default now();

-- ---------- profile_approvals: Token-Tabelle, NICHT für User lesbar ----------
create table if not exists public.profile_approvals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approval_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (approval_token)
);

create index if not exists profile_approvals_token_idx
  on public.profile_approvals (approval_token);

alter table public.profile_approvals enable row level security;

-- KEINE Policies → kein anon/authenticated Zugriff. Nur service_role
-- (das die Edge Functions nutzen) bypassed RLS.

-- ---------- profiles RLS ----------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- INSERT-Policy bewusst NICHT mehr drauf. Trigger handle_new_user
-- legt die Row mit SECURITY DEFINER an. Wenn ein User sich self-INSERT
-- versucht, fail-en wir (Unique-Constraint auf id PK).

drop policy if exists profiles_insert_own on public.profiles;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Block UPDATE auf sensible Spalten für non-service-role.
-- current_setting('role') ist die Postgres-Rolle (von PostgREST gesetzt):
-- 'service_role' für Edge Functions mit Service-Key, 'authenticated' für User-JWTs.
create or replace function public.profiles_block_sensitive_update()
returns trigger language plpgsql
set search_path = public
as $$
declare
  current_role_name text;
begin
  current_role_name := current_setting('role', true);
  -- Nur authenticated (User via PostgREST) wird blockiert.
  -- service_role, postgres (SQL Editor), supabase_admin etc. dürfen alles.
  if current_role_name <> 'authenticated' then
    return new;
  end if;
  if new.approval_status is distinct from old.approval_status then
    raise exception 'approval_status read-only für User';
  end if;
  if new.approval_decided_at is distinct from old.approval_decided_at then
    raise exception 'approval_decided_at read-only';
  end if;
  if new.requested_at is distinct from old.requested_at then
    raise exception 'requested_at read-only';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_sensitive_update on public.profiles;
create trigger profiles_block_sensitive_update
  before update on public.profiles
  for each row execute function public.profiles_block_sensitive_update();

-- ---------- Auto-create profile + approval token on auth signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, name)
    values (new.id, new.raw_user_meta_data->>'name')
    on conflict (id) do nothing;

    insert into public.profile_approvals (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    -- Nicht den auth.users-Insert killen wenn das hier failt.
    -- Edge Function kann später nachholen / Admin sieht im Dashboard.
    raise warning 'handle_new_user failed for %: % / %', new.id, sqlstate, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
