-- 015: Add dispute tracking fields to invoices
-- Captures reason, notes, and resolution for disputed invoices

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dispute_notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dispute_date timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS resolution_outcome text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS resolution_notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS resolution_date timestamptz;
