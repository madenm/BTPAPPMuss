-- Add chantier_id to quotes table so devis can be linked to a chantier.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers(id) ON DELETE SET NULL;

-- Optional: index for fetching quotes by chantier
CREATE INDEX IF NOT EXISTS idx_quotes_chantier_id ON quotes(chantier_id);
