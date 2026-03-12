-- Colonnes CRM pour le pipeline (glisser-déposer, relances)
-- Nécessaires pour CRMPipelinePage / moveProspectToStage

ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'all';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_action_type TEXT;
