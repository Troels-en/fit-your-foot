
-- 1. Add provenance + reference columns to shoes
ALTER TABLE public.shoes
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'runrepeat',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS geometry_confidence text DEFAULT 'spec' CHECK (geometry_confidence IN ('measured','estimated','spec')),
  ADD COLUMN IF NOT EXISTS brand_url text;

-- Backfill data_source for existing rows
UPDATE public.shoes SET data_source = 'runrepeat' WHERE data_source IS NULL;

-- 2. Feedback table for algorithm validation
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  shoe_id uuid REFERENCES public.shoes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid,
  client_token uuid,
  predicted_score integer CHECK (predicted_score BETWEEN 0 AND 100),
  user_rating smallint NOT NULL CHECK (user_rating BETWEEN 1 AND 5),
  owns_shoe boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_shoe_idx ON public.feedback(shoe_id);
CREATE INDEX IF NOT EXISTS feedback_scan_idx ON public.feedback(scan_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated may insert feedback as long as they prove ownership of the scan
-- via client_token (anon) or user_id (auth). Validation done in an RPC below.
CREATE POLICY "feedback_no_direct_insert"
  ON public.feedback FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- Authenticated users can read their own feedback. Admins can read all.
CREATE POLICY "feedback_select_own"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. RPC to submit feedback safely (validates scan ownership)
CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_scan_id uuid,
  p_client_token uuid,
  p_shoe_id uuid,
  p_predicted_score integer,
  p_user_rating smallint,
  p_owns_shoe boolean,
  p_notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_token uuid;
  v_id uuid;
BEGIN
  IF p_scan_id IS NOT NULL THEN
    SELECT user_id, client_token INTO v_owner, v_token
    FROM public.scans WHERE id = p_scan_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Scan not found';
    END IF;
    -- Either owner uid matches, or anon caller knows the client_token
    IF NOT (
      (v_owner IS NOT NULL AND v_owner = auth.uid())
      OR (p_client_token IS NOT NULL AND p_client_token = v_token)
    ) THEN
      RAISE EXCEPTION 'Not authorized for this scan';
    END IF;
  END IF;

  INSERT INTO public.feedback(scan_id, shoe_id, user_id, client_token, predicted_score, user_rating, owns_shoe, notes)
  VALUES (p_scan_id, p_shoe_id, auth.uid(), p_client_token, p_predicted_score, p_user_rating, p_owns_shoe, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid, uuid, uuid, integer, smallint, boolean, text) TO anon, authenticated;

-- 4. Harden scans INSERT policy to reduce orphaned rows from bots.
-- Demo flow needs anon inserts (visitors are not logged in), so we keep an
-- anon policy but require that user_id IS NULL for anon (cannot impersonate)
-- and auth.uid() = user_id for authenticated callers.
DROP POLICY IF EXISTS "scans_insert_own" ON public.scans;

CREATE POLICY "scans_insert_authenticated"
  ON public.scans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scans_insert_anon_demo"
  ON public.scans FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
