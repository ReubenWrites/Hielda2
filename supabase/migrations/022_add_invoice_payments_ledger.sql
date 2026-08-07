-- Payments ledger: each part-payment is recorded with the date it was
-- actually made (user-entered, backdatable — people don't log payments
-- the day they land). Timing matters legally: the fixed recovery fee
-- tiers on the debt as it stood when the invoice went overdue, so
-- payments made before the due date reduce the tier.
-- (Applied to production via MCP.)

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments (invoice_id, paid_on);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON invoice_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments"
  ON invoice_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments"
  ON invoice_payments FOR DELETE USING (auth.uid() = user_id);

-- Denormalised: sum of payments dated on/before the due date. The fixed
-- recovery fee tier is based on (amount - paid_before_due) — the debt
-- that actually went overdue.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_before_due numeric NOT NULL DEFAULT 0;

-- Backfill the one existing part-paid invoice: its owner confirmed the
-- payment was made before the due date.
INSERT INTO invoice_payments (invoice_id, user_id, amount, paid_on)
SELECT id, user_id, amount_paid, (due_date::date - 1)
FROM invoices
WHERE amount_paid IS NOT NULL AND amount_paid > 0 AND status <> 'paid';

UPDATE invoices
SET paid_before_due = amount_paid
WHERE amount_paid IS NOT NULL AND amount_paid > 0 AND status <> 'paid';
