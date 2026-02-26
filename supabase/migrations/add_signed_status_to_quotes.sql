-- =============================================================================
-- Migration: Add 'signé' status to quotes table
-- =============================================================================

-- Ajouter le statut 'signé' aux statut possibles pour les devis
alter table public.quotes
  drop constraint quotes_status_check,
  add constraint quotes_status_check 
    check (status in ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré', 'validé', 'signé'));

comment on column public.quotes.status is 'Statut du devis : brouillon | envoyé | accepté | refusé | expiré | validé | signé';
