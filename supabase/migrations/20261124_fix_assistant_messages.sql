-- ==============================================================================
-- InsurTech Sales Coach — Migration: Fix Assistant Messages & Constraints
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр энэхүү скриптийг ажиллуулна.
-- Энэхүү скрипт нь өмнөх бүх өгөгдлийг хэвээр хадгалж, assistant мессеж
-- хадгалахад шаардлагатай багана, index, RLS болон constraint-уудыг найдвартай шинэчилнэ.

-- 1. pgcrypto өргөтгөл (UUID автомат үүсгэлтэд зориулсан)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. users хүснэгт байгааг баталгаажуулах
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  name text,
  image text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. contacts хүснэгт байгааг баталгаажуулах
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  company text,
  role text,
  phone text,
  email text,
  address text,
  stage text NOT NULL DEFAULT 'lead',
  temperature text NOT NULL DEFAULT 'warm',
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts(user_id);

-- 4. messages хүснэгт байгааг баталгаажуулах
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  skill text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Шаардлагатай баганууд байгаа эсэхийг баталгаажуулах (хуучин бүтэцтэй байсан ч алдаа заана)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS skill text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 6. Role check constraint-ийг шинэчлэх ('assistant', 'user', 'system' бүгдийг зөвшөөрөх)
DO $$
BEGIN
  -- Хэрэв хуучин messages_role_check эсвэл бусад check constraint байвал устгаж зөвшөөрнө
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
  ALTER TABLE messages ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 7. Хурд сайжруулах индексүүд
CREATE INDEX IF NOT EXISTS messages_contact_idx ON messages(contact_id);
CREATE INDEX IF NOT EXISTS messages_user_idx ON messages(user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS contacts_updated_at_idx ON contacts(updated_at);

-- 8. Row Level Security (RLS) тохиргоо (Supabase дээр хандалт хаагдахаас сэргийлнэ)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_all_access'
  ) THEN
    CREATE POLICY messages_all_access ON messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
