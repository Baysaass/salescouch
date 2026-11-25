// supabase/schema.sql-тэй ижил. Апп эхлэхдээ (IF NOT EXISTS) ажиллуулна.
export const SCHEMA_SQL = `
-- InsurTech Sales Coach — Supabase (Postgres) схем
-- Supabase → SQL Editor дээр нэг удаа ажиллуулна (апп өөрөө ч эхний хүсэлтээр үүсгэнэ).
create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  full_name text not null,
  company text,
  role text,
  phone text,
  email text,
  address text,
  stage text not null default 'lead',
  temperature text not null default 'warm',
  channels jsonb not null default '{}'::jsonb,
  persona jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_user_idx on contacts(user_id);
create index if not exists contacts_updated_at_idx on contacts(updated_at);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  skill text,
  created_at timestamptz not null default now()
);
create index if not exists messages_contact_idx on messages(contact_id);
create index if not exists messages_user_idx on messages(user_id);
create index if not exists messages_created_at_idx on messages(created_at);

-- Асуултын банк (Question Bank)
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  author_name text not null,
  author_image text,
  category text not null,
  title text not null,
  question text not null,
  context text,
  votes_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists questions_category_idx on questions(category);
create index if not exists questions_votes_idx on questions(votes_count);

create table if not exists question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists question_votes_uniq_idx on question_votes(question_id, user_id);
create index if not exists question_votes_question_idx on question_votes(question_id);

create table if not exists question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id text not null,
  author_name text not null,
  author_image text,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists question_comments_question_idx on question_comments(question_id);
`;
