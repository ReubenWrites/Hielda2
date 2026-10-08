-- 029: Close the Supabase security-linter warnings on SECURITY DEFINER
-- functions (2026-10-08).
--
-- * increment_invoice_number(p_user_id) could be called by any signed-in
--   user (and by anon) with someone else's id, bumping their counter. It
--   now refuses any id other than the caller's, and anon can't run it.
-- * handle_new_user() and rls_auto_enable() are trigger functions; nothing
--   should call them through the REST RPC surface at all.
-- * All three plus update_updated_at() get a fixed search_path.

CREATE OR REPLACE FUNCTION public.increment_invoice_number(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_num integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'increment_invoice_number: not your profile';
  END IF;
  UPDATE profiles
  SET next_invoice_number = COALESCE(next_invoice_number, 1) + 1
  WHERE id = p_user_id
  RETURNING next_invoice_number - 1 INTO current_num;
  RETURN current_num;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_invoice_number(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_invoice_number(uuid) TO authenticated, service_role;

ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

ALTER FUNCTION public.update_updated_at() SET search_path = public;
