-- Renommer la table prospects en clients
-- Cette migration consiste à renommer la table et toutes ses contraintes/index

-- 1. Renommer les contraintes et les index existants
ALTER INDEX IF EXISTS prospects_pkey RENAME TO clients_pkey;

-- 2. Renommer la table
ALTER TABLE prospects RENAME TO clients;

-- 3. Recréer les index avec les nouveaux noms
ALTER INDEX IF EXISTS clients_pkey RENAME TO clients_pkey;

-- Vérifier que la table existe bien
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'clients' AND table_schema = 'public';
