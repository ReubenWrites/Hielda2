-- Migration 010: Calculator lead capture
-- Stores emails from calculator users who request a summary email
-- Useful for remarketing and manual follow-up

CREATE TABLE IF NOT EXISTS calculator_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invoice_amount numeric,
  days_overdue integer,
  total_claimable numeric,
  created_at timestamptz DEFAULT now()
);

-- Only admins can read leads (via service role key)
ALTER TABLE calculator_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous insert (public calculator, no login required)
CREATE POLICY "Anyone can submit a calculator lead"
  ON calculator_leads FOR INSERT
  WITH CHECK (true);
