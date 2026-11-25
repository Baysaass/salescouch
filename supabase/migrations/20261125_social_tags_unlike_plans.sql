-- ==============================================================================
-- InsurTech Sales Coach — Migration: Social Hashtags, Like/Unlike, Plan & Clean Mock Data
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр ажиллуулна.

-- 1. users хүснэгтэд Free/Pro багцын багана нэмэх
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- 2. questions хүснэгтэд #hashtag болон unlike тоолуур нэмэх
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS dislikes_count integer NOT NULL DEFAULT 0;

-- 3. question_votes хүснэгтэд like/unlike болон хэн дарсныг харуулах нэр/зураг нэмэх
ALTER TABLE question_votes ADD COLUMN IF NOT EXISTS vote_type text NOT NULL DEFAULT 'like';
ALTER TABLE question_votes ADD COLUMN IF NOT EXISTS voter_name text NOT NULL DEFAULT '';
ALTER TABLE question_votes ADD COLUMN IF NOT EXISTS voter_image text;

-- 4. Өмнө нь орсон хуурамч mock сэтгэгдэл ба хуурамч тоонуудыг цэвэрлэх (бодит хэрэглэгчдийнх хэвээр үлдэнэ!)
DELETE FROM question_comments WHERE user_id IN ('system', 'seed-user');

UPDATE questions q
SET
  author_name = 'Жишээ асуулт',
  votes_count = (SELECT count(*)::int FROM question_votes qv WHERE qv.question_id = q.id AND qv.vote_type = 'like'),
  dislikes_count = (SELECT count(*)::int FROM question_votes qv WHERE qv.question_id = q.id AND qv.vote_type = 'unlike')
WHERE q.id::text LIKE '10000000-0000-4000-8000-0000000000%';

-- Жишээ: Өөрийн бүртгэлээ Pro болгох бол доорх мөрийн тайлбарыг авч имэйлээ оруулан ажиллуулна уу:
-- UPDATE users SET plan = 'pro' WHERE email = 'your-email@gmail.com';
