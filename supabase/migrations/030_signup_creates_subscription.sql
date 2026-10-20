-- 030: Start the trial at sign-up, not at the end of onboarding.
--
-- New users now land in the dashboard straight after creating an account
-- and finish setup from a banner, so the subscriptions row that onboarding
-- used to create must exist from the moment the auth user does. The
-- new-user trigger creates it alongside the profile. Users who signed up
-- but never finished onboarding get a row backfilled from their sign-up
-- date (which for all of them is already expired - correct).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, status, plan, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', 'pro', now(), now() + interval '42 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.subscriptions (user_id, status, plan, trial_start, trial_end)
SELECT u.id, 'trialing', 'pro', u.created_at, u.created_at + interval '42 days'
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL;
