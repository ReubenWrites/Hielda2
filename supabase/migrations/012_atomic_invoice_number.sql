-- Migration 012: Atomic invoice number increment
-- Prevents race conditions when two invoices are created simultaneously
-- Returns the number that was reserved (before increment) so the caller can use it

CREATE OR REPLACE FUNCTION increment_invoice_number(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_num integer;
BEGIN
  UPDATE profiles
  SET next_invoice_number = COALESCE(next_invoice_number, 1) + 1
  WHERE id = p_user_id
  RETURNING next_invoice_number - 1 INTO current_num;
  RETURN current_num;
END;
$$;
