-- Migration 009: Add branding and international banking fields to profiles
-- Allows users to add SWIFT/BIC, IBAN, company logo, custom invoice signoff, and website URL

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS swift_bic text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS invoice_signoff text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- Add payment_terms_note for the lightweight "terms on invoice" feature
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_terms_note text;
