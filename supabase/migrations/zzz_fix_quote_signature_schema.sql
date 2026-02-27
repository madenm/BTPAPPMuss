-- =============================================================================
-- Migration de correction: Assurer que quote_signature_links a le bon schéma
-- Cette migration s'exécute APRÈS quote_signatures.sql et permet les modifications
-- =============================================================================

-- Si la table existe déjà avec quote_id NOT NULL, le corriger
ALTER TABLE IF EXISTS public.quote_signature_links
    ALTER COLUMN quote_id DROP NOT NULL;

-- Ajouter la colonne prospect_email si elle n'existe pas
ALTER TABLE IF EXISTS public.quote_signature_links
    ADD COLUMN IF NOT EXISTS prospect_email text;

-- Appliquer la même correction à quote_signatures
ALTER TABLE IF EXISTS public.quote_signatures
    ALTER COLUMN quote_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.quote_signatures
    ADD COLUMN IF NOT EXISTS prospect_email text;

-- Assurer que la policy de service_role existe
DROP POLICY IF EXISTS "Service role can insert quote signature links" ON public.quote_signature_links;
CREATE POLICY "Service role can insert quote signature links"
    ON public.quote_signature_links FOR INSERT
    WITH CHECK (true);

-- Ajouter des commentaires
COMMENT ON COLUMN public.quote_signature_links.quote_id IS 'Référence au devis (optionnel - peut être NULL pour signatures ponctuelles)';
COMMENT ON COLUMN public.quote_signatures.quote_id IS 'Référence au devis (optionnel - peut être NULL pour signatures ponctuelles)';
