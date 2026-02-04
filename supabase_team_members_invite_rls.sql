-- Vérification du code de connexion depuis la page d'invitation (utilisateur anonyme).
-- Une fonction SECURITY DEFINER lit team_invitations et team_members sans être bloquée par la RLS.
-- À exécuter dans le SQL Editor de votre projet Supabase.

CREATE OR REPLACE FUNCTION public.verify_invite_code(invite_token text, login_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mid uuid;
  member_row jsonb;
BEGIN
  SELECT team_member_id INTO mid
  FROM team_invitations
  WHERE token = invite_token
    AND used = false
    AND expires_at > now()
  LIMIT 1;

  IF mid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(t.*) INTO member_row
  FROM team_members t
  WHERE t.id = mid
    AND t.login_code = verify_invite_code.login_code
    AND t.status = 'actif'
  LIMIT 1;

  RETURN member_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_invite_code(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_invite_code(text, text) TO authenticated;
