-- ==============================================================================
-- InsurTech Sales Coach — Migration: Add Question Bank (Асуултын банк)
-- ==============================================================================

-- 1. questions хүснэгт
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  author_name text NOT NULL,
  author_image text,
  category text NOT NULL,
  title text NOT NULL,
  question text NOT NULL,
  context text,
  votes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_category_idx ON questions(category);
CREATE INDEX IF NOT EXISTS questions_votes_idx ON questions(votes_count);

-- 2. question_votes хүснэгт (1 хэрэглэгч 1 vote)
CREATE TABLE IF NOT EXISTS question_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS question_votes_uniq_idx ON question_votes(question_id, user_id);
CREATE INDEX IF NOT EXISTS question_votes_question_idx ON question_votes(question_id);

-- 3. question_comments хүснэгт (бодит туршлага, сэтгэгдэл)
CREATE TABLE IF NOT EXISTS question_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  author_name text NOT NULL,
  author_image text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_comments_question_idx ON question_comments(question_id);

-- 4. Row Level Security (RLS) тохиргоо
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_all_access') THEN
    CREATE POLICY questions_all_access ON questions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_votes' AND policyname = 'question_votes_all_access') THEN
    CREATE POLICY question_votes_all_access ON question_votes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_comments' AND policyname = 'question_comments_all_access') THEN
    CREATE POLICY question_comments_all_access ON question_comments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
