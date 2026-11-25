-- ==============================================================================
-- InsurTech Sales Coach — Migration: Question Intelligence, Vectors & Clusters
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр ажиллуулах скрипт

-- 1. pgvector өргөтгөл (Supabase дээр вектор индекс ашиглах боломжтой бол идэвхжүүлнэ)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. question_clusters хүснэгт
CREATE TABLE IF NOT EXISTS question_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  summary text NOT NULL,
  performance_verdict text NOT NULL,
  best_personas jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_cluster_id uuid,
  next_cluster_reason text,
  refined_question text NOT NULL,
  refined_rationale text NOT NULL,
  centroid jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 0,
  avg_votes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. questions хүснэгтэд вектор, кластер болон AI дүгнэлтийн баганууд нэмэх
ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding_model text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS cluster_id uuid REFERENCES question_clusters(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS persona_scores jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ai_analysis text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS refined_variant text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS related_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS questions_cluster_idx ON questions(cluster_id);

-- 4. Supabase pgvector native багана болон индекс (сонголтоор)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);
    CREATE INDEX IF NOT EXISTS questions_embedding_vec_idx ON questions USING hnsw (embedding_vec vector_cosine_ops);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 5. RLS тохиргоо
ALTER TABLE question_clusters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_clusters' AND policyname = 'question_clusters_all_access') THEN
    CREATE POLICY question_clusters_all_access ON question_clusters FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
