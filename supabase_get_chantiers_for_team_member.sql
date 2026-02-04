-- Permet à un membre d'équipe (sans session Supabase) de récupérer les chantiers auxquels il est assigné.
-- À exécuter dans le SQL Editor de votre projet Supabase.

CREATE OR REPLACE FUNCTION public.get_chantiers_for_team_member(p_team_member_id uuid)
RETURNS SETOF chantiers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.*
  FROM chantiers c
  JOIN chantier_assignments a ON a.chantier_id = c.id
  WHERE a.team_member_id = p_team_member_id
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_chantiers_for_team_member(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_chantiers_for_team_member(uuid) TO authenticated;
