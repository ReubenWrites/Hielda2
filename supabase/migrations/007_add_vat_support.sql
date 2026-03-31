-- VAT support: add VAT fields to profiles and invoices
-- Note: invoices.amount remains the NET figure — UK Late Payment Act penalties apply to net, not gross

-- Profiles: VAT registration status and default rate
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vat_registered boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_vat_rate text DEFAULT '20';

-- Invoices: VAT breakdown columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_with_vat numeric;

-- Backfill existing invoices: set subtotal and total_with_vat to amount (no VAT)
UPDATE invoices SET subtotal = amount, total_with_vat = amount WHERE subtotal IS NULL;
