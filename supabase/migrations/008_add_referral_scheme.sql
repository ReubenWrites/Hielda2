-- Referral scheme: tables for tracking referrals and payouts

-- Add referral_code to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Referrals table: tracks each referral relationship
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES profiles(id) NOT NULL,
  referral_code text NOT NULL,
  referred_email text,
  referred_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'link_sent'
    CHECK (status IN ('link_sent', 'signed_up', 'subscribed', 'eligible', 'paid_out')),
  total_spent numeric DEFAULT 0,
  spend_threshold numeric DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: users can read their own referrals (as referrer)
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (referrer_id = auth.uid());
CREATE POLICY "Users can insert own referrals" ON referrals
  FOR INSERT WITH CHECK (referrer_id = auth.uid());

-- Referral payouts: tracks pending and completed payouts
CREATE TABLE IF NOT EXISTS referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES profiles(id) NOT NULL,
  referral_id uuid REFERENCES referrals(id),
  amount numeric NOT NULL,
  payout_type text NOT NULL DEFAULT 'referral'
    CHECK (payout_type IN ('referral', 'bonus')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid')),
  bank_details jsonb,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- RLS: users can read their own payouts
ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payouts" ON referral_payouts
  FOR SELECT USING (referrer_id = auth.uid());

-- Index for looking up referrals by code (used during sign-up)
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
