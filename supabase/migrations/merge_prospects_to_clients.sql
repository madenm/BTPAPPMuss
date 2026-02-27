-- Migration: Fusionner prospects en clients
-- Objectif: Une seule table "clients" avec tous les champs CRM

-- 1. Supprimer les contraintes de FK de la table quotes qui pointent vers prospects
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_contact_id_fkey;

-- 2. Supprimer la table clients existante (simple) pour éviter les conflits
DROP TABLE IF EXISTS client_form_links CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- 3. Renommer prospects → clients
ALTER TABLE prospects RENAME TO clients;

-- 4. Ajouter les champs manquants si nécessaire (pour la compatibilité future)
-- Ces champs ne seront pas utilisés au démarrage, mais utiles pour l'adresse plus tard
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street_address TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL;

-- 5. Recréer la contrainte FK pour les quotes
ALTER TABLE quotes 
ADD CONSTRAINT quotes_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES clients(id) ON DELETE SET NULL;

-- 6. Créer l'index sur user_id si absent
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);

-- 7. Vérification : afficher la structure de la table clients
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' AND table_schema = 'public'
ORDER BY ordinal_position;
