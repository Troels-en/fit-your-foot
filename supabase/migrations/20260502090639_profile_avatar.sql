-- Avatar-Support für profiles. Drei Quellen:
--   1. avatar_url zeigt auf einen Schuh aus public.shoes (Lieblings-Schuh)
--   2. avatar_url zeigt auf eines der hosted Preset-PNGs (im public/avatars/ ordner)
--   3. avatar_url zeigt auf storage.objects in bucket=avatars (User-Upload)
--
-- Frontend speichert einfach die URL. RLS auf storage regelt wer was uploaden darf.

-- ---------- profiles.avatar_url ----------
alter table public.profiles add column if not exists avatar_url text;

-- ---------- Storage Bucket "avatars" ----------
-- Public read (damit das Bild via <img src=...> funktioniert ohne Auth-Header).
-- Bucket-level MIME + size limits — gegen Direct-API-Bypass des Frontends.
-- KEIN image/svg+xml (würde stored XSS auf einem public bucket erlauben).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,                                                  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Storage RLS ----------
-- Read: alle dürfen lesen (public bucket).
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Insert: nur authenticated, nur in eigenen User-Folder.
-- Pfad-Pattern: '<user-uuid>/...' — explizites LIKE statt foldername(),
-- weil foldername() bei crafted Pfaden wie '<uid>/../victim/...' tricksbar ist.
-- Plus: Verbot von '/..' anywhere (path-traversal).
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '/%')
    and position('/..' in name) = 0
  );

-- Update: zusätzlich owner-Check (nur eigene Objects).
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '/%')
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '/%')
    and position('/..' in name) = 0
    and owner = auth.uid()
  );

-- Delete: ditto, owner-Check.
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '/%')
    and owner = auth.uid()
  );
