-- 017: Webhook event log for idempotency and audit trail
-- Prevents duplicate processing of Stripe/Resend webhook events

CREATE TABLE IF NOT EXISTS webhook_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE webhook_event_log ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies needed — only service role accesses this table
