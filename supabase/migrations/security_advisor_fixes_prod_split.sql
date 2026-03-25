-- =============================================================================
-- MÊME MIGRATION EN 3 PARTIES (pour prod en cas de timeout)
-- Sur BTPAPP (prod), exécuter chaque bloc séparément dans le SQL Editor.
-- =============================================================================

-- ---------- PARTIE 1 : RLS sur ai_response_cache (1 requête) ----------
alter table if exists public.ai_response_cache enable row level security;


-- ---------- PARTIE 2 : get_chantiers_for_team_member (2 requêtes) ----------
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


-- ---------- PARTIE 3 : update_updated_at_column (2 requêtes) ----------
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
