UPDATE public.profiles
SET approval_status = 'approved',
    approval_decided_at = COALESCE(approval_decided_at, now())
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('johannes.stopa@gmail.com'));