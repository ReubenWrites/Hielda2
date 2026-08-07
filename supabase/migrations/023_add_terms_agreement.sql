-- Requested vs agreed payment terms. (Applied to production via MCP.)
--
-- Statutory interest only runs from the end of an AGREED credit period;
-- without agreement the Act's default is 30 days. Users often set short
-- terms because they'd like faster payment — not because the client
-- agreed. Charging from an unagreed short deadline over-claims.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_agreed boolean NOT NULL DEFAULT true;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS requested_term_days integer;
