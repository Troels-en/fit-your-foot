-- 1. Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'brand', 'consumer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Migrate existing roles from profiles to user_roles (best-effort)
INSERT INTO public.user_roles (user_id, role)
SELECT id,
       CASE role
         WHEN 'admin' THEN 'admin'::public.app_role
         WHEN 'brand' THEN 'brand'::public.app_role
         ELSE 'consumer'::public.app_role
       END
FROM public.profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. RLS for user_roles: users can read their own roles; only admins can manage
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Update brands RLS to use has_role
DROP POLICY IF EXISTS brands_manage_own ON public.brands;
CREATE POLICY brands_manage_own
ON public.brands
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'brand')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.brand_id = brands.id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'brand')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.brand_id = brands.id)
);

-- 7. Update qr_codes RLS to use has_role
DROP POLICY IF EXISTS qrcodes_manage_brand ON public.qr_codes;
CREATE POLICY qrcodes_manage_brand
ON public.qr_codes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'brand')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.brand_id = qr_codes.brand_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'brand')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.brand_id = qr_codes.brand_id)
);

-- 8. Update shoes admin INSERT policy to use has_role
DROP POLICY IF EXISTS "Only admins can insert shoes" ON public.shoes;
CREATE POLICY "Only admins can insert shoes"
ON public.shoes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. Drop role and email columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 10. Add UPDATE/DELETE policies for scans and brand-read access
DROP POLICY IF EXISTS scans_update_own ON public.scans;
CREATE POLICY scans_update_own
ON public.scans
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS scans_delete_own ON public.scans;
CREATE POLICY scans_delete_own
ON public.scans
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scans_select_brand ON public.scans;
CREATE POLICY scans_select_brand
ON public.scans
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'brand')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.brand_id = scans.brand_id)
);
