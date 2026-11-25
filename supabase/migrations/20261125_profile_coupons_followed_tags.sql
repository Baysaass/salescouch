-- ==============================================================================
-- InsurTech Sales Coach — Migration: Profile Pro Coupon & Followed Hashtags (max 5)
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр ажиллуулна.

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS followed_tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS redeemed_coupon text;
