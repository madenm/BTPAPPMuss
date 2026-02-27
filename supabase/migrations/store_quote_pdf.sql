-- Migration: Ajouter colonne pour stocker le PDF du devis
-- Permet de conserver le devis original et d'ajouter la signature dessus

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_pdf_base64 TEXT NULL;

-- Index pour optimiser la recherche
CREATE INDEX IF NOT EXISTS idx_quotes_pdf ON public.quotes(id) 
WHERE quote_pdf_base64 IS NOT NULL;
