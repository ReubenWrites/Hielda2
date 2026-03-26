-- Add onboarding_complete to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Add auto_chase to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auto_chase boolean DEFAULT true;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'trialing',
  plan text NOT NULL DEFAULT 'pro',
  trial_start timestamptz DEFAULT now(),
  trial_end timestamptz DEFAULT (now() + interval '7 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Chase log table
CREATE TABLE IF NOT EXISTS chase_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chase_stage text NOT NULL,
  email_to text NOT NULL,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now()
);

-- RLS for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS for chase_log
ALTER TABLE chase_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chase logs"
  ON chase_log FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure existing tables have RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Profiles RLS (idempotent - drop if exists first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Invoices RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own invoices' AND tablename = 'invoices') THEN
    CREATE POLICY "Users can read own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own invoices' AND tablename = 'invoices') THEN
    CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own invoices' AND tablename = 'invoices') THEN
    CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Daily chase scheduler cron (run this manually in Supabase SQL editor after enabling pg_cron)
-- SELECT cron.schedule(
--   'daily-chase-check',
--   '0 9 * * *',
--   $$SELECT net.http_post(
--     url := 'https://oufopsyfxhdtexkbjfop.supabase.co/functions/v1/chase-scheduler',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
--   )$$
-- );
