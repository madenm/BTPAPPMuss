-- =============================================================================
-- Migration: Allow NULL quote_id in quote_signature_links and quote_signatures
-- Pour supporter les signatures sans devis en base de données
-- =============================================================================

-- Modifier quote_signature_links pour permettre quote_id NULL
ALTER TABLE public.quote_signature_links
  ALTER COLUMN quote_id DROP NOT NULL;

-- Modifier quote_signatures pour permettre quote_id NULL
ALTER TABLE public.quote_signatures
  ALTER COLUMN quote_id DROP NOT NULL;

-- Ajouter une colonne optionnelle pour stocker le email du prospect
ALTER TABLE public.quote_signature_links
  ADD COLUMN prospect_email text;

ALTER TABLE public.quote_signatures
  ADD COLUMN prospect_email text;

comment on column public.quote_signature_links.quote_id is 'Référence au devis (optionnel - peut être NULL pour signatures ponctuelles)';
comment on column public.quote_signatures.quote_id is 'Référence au devis (optionnel - peut être NULL pour signatures ponctuelles)';
