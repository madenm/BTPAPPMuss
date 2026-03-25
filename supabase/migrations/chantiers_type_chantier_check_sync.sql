-- =============================================================================
-- Alignement staging / prod : CHECK type_chantier = mêmes valeurs que l'app
-- (Projets, Devis : SelectItem piscine, paysage, …, autre).
--
-- Historique : la contrainte existait en prod (SQL manuel) mais absente du repo
-- → staging sans CHECK, prod avec une liste parfois plus courte → erreur 23514
-- (ex. "terrasse" refusé).
--
-- Idempotent : normalise les lignes invalides vers 'autre', puis remplace la contrainte.
-- =============================================================================

UPDATE public.chantiers
SET type_chantier = 'autre'
WHERE type_chantier IS NOT NULL
  AND trim(type_chantier) <> ''
  AND lower(trim(type_chantier)) NOT IN (
    'piscine',
    'paysage',
    'menuiserie',
    'renovation',
    'plomberie',
    'maconnerie',
    'terrasse',
    'chauffage',
    'isolation',
    'electricite',
    'peinture',
    'autre'
  );

ALTER TABLE public.chantiers
  DROP CONSTRAINT IF EXISTS chantiers_type_chantier_check;

ALTER TABLE public.chantiers
  ADD CONSTRAINT chantiers_type_chantier_check
  CHECK (
    type_chantier IS NULL
    OR trim(type_chantier) = ''
    OR lower(trim(type_chantier)) = ANY (
      ARRAY[
        'piscine',
        'paysage',
        'menuiserie',
        'renovation',
        'plomberie',
        'maconnerie',
        'terrasse',
        'chauffage',
        'isolation',
        'electricite',
        'peinture',
        'autre'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT chantiers_type_chantier_check ON public.chantiers IS
  'Types alignés sur l''UI (dashboard/projets, devis). NULL ou chaîne vide acceptés.';
