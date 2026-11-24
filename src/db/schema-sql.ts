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

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id text not null,
  role text not null,
  content text not null,
  skill text,
  created_at timestamptz not null default now()
);
create index if not exists messages_contact_idx on messages(contact_id);
`;
