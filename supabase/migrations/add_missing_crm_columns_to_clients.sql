-- Ajouter les colonnes CRM manquantes à la table clients

-- Colonnes pour les informations de suivi CRM
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0;

-- Vérifier que toutes les colonnes existent
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' AND table_schema = 'public'
ORDER BY ordinal_position;
