-- Social media post log — tracks what's been posted to avoid repeats
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar text NOT NULL,
  text text NOT NULL,
  tweet_id text,
  posted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- No RLS needed — only accessed by service role from the cron function
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
