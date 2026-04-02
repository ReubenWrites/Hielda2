-- 016: Add chase email tone preference to profiles
-- Options: 'friendly', 'firm' (default), 'legal'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chase_tone text DEFAULT 'firm';
