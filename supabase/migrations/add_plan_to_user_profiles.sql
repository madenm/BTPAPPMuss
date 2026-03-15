-- Ajout de la colonne plan (solo / pro) à user_profiles pour le système de plans TitanBtp.
-- Valeurs possibles : 'solo', 'pro'. Défaut : 'solo'.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'solo'
  CHECK (plan IN ('solo', 'pro'));

COMMENT ON COLUMN public.user_profiles.plan IS 'Plan utilisateur : solo (limité) ou pro (illimité).';
