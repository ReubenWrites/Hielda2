-- Migration 011: Consumer client type
-- Allows invoices to be marked as consumer (individual) vs business (B2B)
-- Consumer invoices: no statutory fixed penalty, but contractual interest terms
-- are added to the invoice PDF footer

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'business';
