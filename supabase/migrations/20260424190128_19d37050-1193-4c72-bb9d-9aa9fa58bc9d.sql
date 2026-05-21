-- Fix shoes insert policy: require admin role
DROP POLICY IF EXISTS "Only admins can insert shoes" ON public.shoes;

CREATE POLICY "Only admins can insert shoes"
ON public.shoes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- Fix scans insert policy: require authenticated ownership
DROP POLICY IF EXISTS scans_insert_own ON public.scans;

CREATE POLICY scans_insert_own
ON public.scans
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
