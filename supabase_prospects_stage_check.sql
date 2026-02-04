-- Étendre la contrainte prospects_stage_check pour inclure les stages du pipeline CRM
-- (envoi facture + relances devis/facture). À exécuter dans l’éditeur SQL Supabase.

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_stage_check;

ALTER TABLE prospects ADD CONSTRAINT prospects_stage_check CHECK (
  stage IN (
    'all',
    'quote',
    'quote_followup1',
    'quote_followup2',
    'invoice',
    'invoice_followup1',
    'invoice_followup2',
    'followup1',
    'followup2',
    'followup3',
    'followup4'
  )
);
