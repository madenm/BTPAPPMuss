-- Date de fin (optionnelle) et soft delete pour chantiers.
-- Exécuter une fois dans Supabase : Dashboard > SQL Editor > New query, coller et Run.

-- Date de fin (pour indicateur "En retard")
ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS date_fin DATE;

-- Soft delete
ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

ALTER TABLE chantiers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index pour performances (filtrage, tri)
CREATE INDEX IF NOT EXISTS idx_chantiers_user_id ON chantiers(user_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_client_id ON chantiers(client_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_statut ON chantiers(statut);
CREATE INDEX IF NOT EXISTS idx_chantiers_type_chantier ON chantiers(type_chantier);
CREATE INDEX IF NOT EXISTS idx_chantiers_date_debut ON chantiers(date_debut);
CREATE INDEX IF NOT EXISTS idx_chantiers_is_deleted ON chantiers(is_deleted);

COMMENT ON COLUMN chantiers.date_fin IS 'Date de fin prévue ou réelle; utilisée pour indicateur "En retard"';
COMMENT ON COLUMN chantiers.is_deleted IS 'Soft delete: true = chantier archivé/masqué';
COMMENT ON COLUMN chantiers.deleted_at IS 'Date/heure du soft delete';
