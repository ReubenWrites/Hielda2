-- 017: Add free-form notes field to invoices
-- User-facing additional info per invoice. Rendered on the PDF (after line
-- items, before totals) and in the intro/invoice email so the client sees
-- it too. Nullable — invoices created before this migration are unaffected.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
