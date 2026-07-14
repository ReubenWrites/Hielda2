-- Server-backed invoice drafts: follow the user across devices and are
-- visible on the dashboard (localStorage drafts were a single invisible
-- slot per device). The whole form state lives in a jsonb payload so the
-- drafts table never fights the invoices table's constraints.
-- (Applied to production 2026-06-19 via MCP.)

CREATE TABLE IF NOT EXISTS invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_name text,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_drafts_user ON invoice_drafts (user_id, updated_at DESC);

ALTER TABLE invoice_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON invoice_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON invoice_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON invoice_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON invoice_drafts FOR DELETE
  USING (auth.uid() = user_id);
