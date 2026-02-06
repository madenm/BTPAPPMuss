-- Montant du devis (total TTC) sur le chantier.
-- Exécuter une fois dans Supabase : Dashboard > SQL Editor > New query, coller et Run.

ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS montant_devis NUMERIC;
