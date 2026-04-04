-- Social media engagement log — tracks replies and likes to avoid double-engaging
CREATE TABLE IF NOT EXISTS social_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id text NOT NULL,
  action text NOT NULL,  -- 'like' or 'reply'
  author_username text,
  reply_text text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_engagements_tweet_id ON social_engagements(tweet_id);

ALTER TABLE social_engagements ENABLE ROW LEVEL SECURITY;
