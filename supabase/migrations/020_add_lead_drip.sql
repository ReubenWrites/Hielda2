-- Lead drip sequence state.
--
-- calculator_leads gains engagement-tracked drip columns:
--   drip_stage      how many emails this lead has received (1 = the instant
--                   capture email). 99 = stopped (converted to a user).
--   last_email_at   when the most recent email was sent
--   last_email_id   Resend id of the most recent email (matched by the
--                   resend-webhook to record opens)
--   opened_count    how many drip emails this lead has opened
--   last_opened_at  when they last opened one
--   unsubscribed    set by /api/lead-unsubscribe; excluded from all sends
--   unsubscribe_token random token embedded in every email's unsubscribe link

ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS drip_stage integer NOT NULL DEFAULT 1;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS last_email_at timestamptz;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS last_email_id text;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS unsubscribed boolean NOT NULL DEFAULT false;
ALTER TABLE calculator_leads ADD COLUMN IF NOT EXISTS unsubscribe_token text;

-- The drip cron queries on these three columns daily.
CREATE INDEX IF NOT EXISTS idx_calculator_leads_drip
  ON calculator_leads (unsubscribed, drip_stage, last_email_at);

-- The resend-webhook looks leads up by the Resend email id.
CREATE INDEX IF NOT EXISTS idx_calculator_leads_last_email_id
  ON calculator_leads (last_email_id);
