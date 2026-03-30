-- Add CC and BCC email columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cc_emails text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bcc_emails text;
