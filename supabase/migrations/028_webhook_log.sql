-- 028: Record every call the Resend webhook receives.
--
-- Resend disabled the endpoint for "repeatedly failing" and neither side
-- keeps logs we can read (Resend's attempt history is a paid feature,
-- Vercel Hobby retains nothing). This table is the audit trail: one row
-- per call with what arrived and how the handler answered, so the next
-- failure is diagnosable from the SQL editor.

CREATE TABLE IF NOT EXISTS webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'resend',
  event_type text,            -- e.g. email.delivered; null when the body could not be read
  email_id text,              -- Resend email id the event refers to
  outcome text NOT NULL,      -- ok | ignored | bad_signature | not_configured | error
  detail text,                -- what was matched / updated, or the error message
  status int NOT NULL         -- HTTP status we returned
);

ALTER TABLE webhook_log ENABLE ROW LEVEL SECURITY;
-- Service role only; no user-facing policy.

CREATE INDEX IF NOT EXISTS idx_webhook_log_received ON webhook_log(received_at DESC);
