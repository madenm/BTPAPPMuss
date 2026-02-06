-- Supprimer TOUS les devis (repartir à 0).
-- À exécuter dans l'éditeur SQL Supabase (Dashboard > SQL Editor).
-- Attention : cette action est irréversible.

DELETE FROM quotes;

-- Vérifier qu'il ne reste aucun devis :
-- SELECT COUNT(*) FROM quotes;
