-- ==============================================================================
-- InsurTech Sales Coach — Migration: Contact Sharing (contact_shares)
-- ==============================================================================
-- Supabase Dashboard → SQL Editor дээр ажиллуулна.

CREATE TABLE IF NOT EXISTS contact_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  shared_with_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_shares_uniq_idx ON contact_shares(contact_id, shared_with_user_id);
CREATE INDEX IF NOT EXISTS contact_shares_recipient_idx ON contact_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS contact_shares_contact_idx ON contact_shares(contact_id);

ALTER TABLE contact_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_shares' AND policyname = 'contact_shares_all_access'
  ) THEN
    CREATE POLICY contact_shares_all_access ON contact_shares FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
