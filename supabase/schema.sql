-- InsurTech Sales Coach — Supabase (Postgres) схем
-- Supabase → SQL Editor дээр нэг удаа ажиллуулна (апп өөрөө ч эхний хүсэлтээр үүсгэнэ).
create extension if not exists pgcrypto;
do $$ begin create extension if not exists vector; exception when others then null; end $$;

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

-- Асуултын кластер ба AI оюун ухааны дүгнэлт
create table if not exists question_clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text not null,
  performance_verdict text not null,
  best_personas jsonb not null default '[]'::jsonb,
  next_cluster_id uuid,
  next_cluster_reason text,
  refined_question text not null,
  refined_rationale text not null,
  centroid jsonb not null default '[]'::jsonb,
  question_count integer not null default 0,
  avg_votes integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Асуултын банк (Question Bank + Vector & Insights)
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
  embedding jsonb,
  embedding_model text,
  cluster_id uuid references question_clusters(id) on delete set null,
  persona_scores jsonb not null default '[]'::jsonb,
  ai_analysis text,
  refined_variant text,
  related_question_ids jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists questions_category_idx on questions(category);
create index if not exists questions_votes_idx on questions(votes_count);
create index if not exists questions_cluster_idx on questions(cluster_id);

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

-- Row Level Security
alter table messages enable row level security;
alter table question_clusters enable row level security;
alter table questions enable row level security;
alter table question_votes enable row level security;
alter table question_comments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'messages' and policyname = 'messages_all_access') then
    create policy messages_all_access on messages for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'question_clusters' and policyname = 'question_clusters_all_access') then
    create policy question_clusters_all_access on question_clusters for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'questions' and policyname = 'questions_all_access') then
    create policy questions_all_access on questions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'question_votes' and policyname = 'question_votes_all_access') then
    create policy question_votes_all_access on question_votes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'question_comments' and policyname = 'question_comments_all_access') then
    create policy question_comments_all_access on question_comments for all using (true) with check (true);
  end if;
end $$;
