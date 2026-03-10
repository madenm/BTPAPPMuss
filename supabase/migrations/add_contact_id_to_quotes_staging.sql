-- Pour BDD fraîche (staging) : ajouter contact_id sur quotes en pointant vers clients.
-- À exécuter après schema.sql (qui a déjà la table clients).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON public.quotes(contact_id);
