-- Sequential invoice numbering
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_invoice_number integer DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_reg_number text;

-- Partial payment support
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
