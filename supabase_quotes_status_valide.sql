-- Ajouter le statut "validé" aux devis (quotes).
-- À exécuter dans l'éditeur SQL Supabase.

-- Supprimer toute contrainte CHECK existante sur quotes.status (quel que soit son nom)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
    WHERE t.relname = 'quotes' AND c.contype = 'c' AND a.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE quotes DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Au cas où le nom exact est quotes_status_check
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (
  status IN (
    'brouillon',
    'envoyé',
    'accepté',
    'refusé',
    'expiré',
    'validé'
  )
);
