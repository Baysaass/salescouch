-- ==============================================================================
-- InsurTech Sales Coach — Migration: Persuasion Trigger Styles & A/B Outcomes
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр ажиллуулна.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS trigger_style text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ab_group text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ab_variant_label text;

ALTER TABLE question_comments ADD COLUMN IF NOT EXISTS outcome text;
