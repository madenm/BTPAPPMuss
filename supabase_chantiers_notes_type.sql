-- Add notes and type_chantier columns to chantiers table.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- Required for "Description du projet" and type de chantier (piscine, paysage, etc.).

ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS type_chantier TEXT;

-- Notes sur l'avancement du projet (zone distincte de la description du projet / devis)
ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS notes_avancement TEXT;
