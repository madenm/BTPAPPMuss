-- =============================================================================
-- Security Advisor: corrections RLS + search_path (prod et staging)
-- À exécuter sur les deux projets pour aligner et supprimer l'erreur + warnings.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ERREUR: RLS désactivée sur public.ai_response_cache
--    Accès réservé au backend (service_role bypass RLS). Aucune policy = aucun accès anon/authenticated.
-- -----------------------------------------------------------------------------
alter table if exists public.ai_response_cache enable row level security;

-- Pas de policy pour anon/authenticated => seul le backend (service_role) peut accéder au cache.

-- -----------------------------------------------------------------------------
-- 2. WARNING: Function Search Path Mutable - get_chantiers_for_team_member
-- -----------------------------------------------------------------------------
drop function if exists get_chantiers_for_team_member(uuid);

create or replace function get_chantiers_for_team_member(p_team_member_id uuid)
returns setof chantiers
language sql
security definer
set search_path = public
as $$
  select c.*
  from chantiers c
  inner join chantier_assignments ca on ca.chantier_id = c.id
  where ca.team_member_id = p_team_member_id
    and c.is_deleted = false;
$$;

-- -----------------------------------------------------------------------------
-- 3. WARNING: Function Search Path Mutable - update_updated_at_column (si elle existe en prod)
--    Création idempotente avec search_path pour aligner staging sur prod.
-- -----------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_updated_at_column() is 'Trigger: met à jour updated_at (search_path fixé pour Security Advisor)';
