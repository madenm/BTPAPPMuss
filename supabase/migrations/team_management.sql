-- =============================================================================
-- Migration: Gestion d'équipe - Tables pour membres et affectations chantiers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- team_members (membres de l'équipe avec permissions)
-- -----------------------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  email text not null,
  phone text,
  status text not null default 'actif' check (status in ('actif', 'inactif')),
  login_code text not null,
  -- Permissions
  can_view_dashboard boolean default false,
  can_use_estimation boolean default false,
  can_view_all_chantiers boolean default false,
  can_manage_chantiers boolean default false,
  can_view_planning boolean default false,
  can_manage_planning boolean default false,
  can_access_crm boolean default false,
  can_create_quotes boolean default false,
  can_manage_invoices boolean default false,
  can_use_ai_visualization boolean default false,
  can_manage_team boolean default false,
  can_manage_clients boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_login_code on public.team_members(login_code);
create index if not exists idx_team_members_status on public.team_members(status);
alter table public.team_members enable row level security;

create policy "Users can manage own team members"
  on public.team_members for all using (auth.uid() = user_id);

-- Politique pour permettre la lecture sans auth (pour la page de connexion)
create policy "Anyone can read team members for login"
  on public.team_members for select using (true);

-- -----------------------------------------------------------------------------
-- chantier_assignments (affectation membres -> chantiers)
-- -----------------------------------------------------------------------------
create table if not exists public.chantier_assignments (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(chantier_id, team_member_id)
);

create index if not exists idx_chantier_assignments_chantier_id on public.chantier_assignments(chantier_id);
create index if not exists idx_chantier_assignments_team_member_id on public.chantier_assignments(team_member_id);
alter table public.chantier_assignments enable row level security;

-- Politique: les affectations sont visibles selon les droits sur le chantier parent
create policy "Users can manage assignments for own chantiers"
  on public.chantier_assignments for all using (
    chantier_id in (select id from chantiers where user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Fonction RPC pour récupérer les chantiers d'un membre d'équipe
-- -----------------------------------------------------------------------------
-- Supprimer l'ancienne fonction si elle existe
drop function if exists get_chantiers_for_team_member(uuid);

create or replace function get_chantiers_for_team_member(p_team_member_id uuid)
returns setof chantiers
language sql
security definer
as $$
  select c.*
  from chantiers c
  inner join chantier_assignments ca on ca.chantier_id = c.id
  where ca.team_member_id = p_team_member_id
    and c.is_deleted = false;
$$;

-- -----------------------------------------------------------------------------
-- Commentaires
-- -----------------------------------------------------------------------------
comment on table public.team_members is 'Membres de l''équipe avec permissions';
comment on table public.chantier_assignments is 'Affectations chantiers <-> membres équipe';
