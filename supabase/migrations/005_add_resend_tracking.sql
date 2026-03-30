ALTER TABLE chase_log ADD COLUMN IF NOT EXISTS resend_id text;
ALTER TABLE chase_log ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';
