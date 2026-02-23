-- Ajout des colonnes paramètres entreprise / documents / légales
-- Exécuter dans le SQL Editor de Supabase

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_tva_number text,
  ADD COLUMN IF NOT EXISTS company_rcs text,
  ADD COLUMN IF NOT EXISTS company_ape text,
  ADD COLUMN IF NOT EXISTS company_capital text,
  ADD COLUMN IF NOT EXISTS insurance_name text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS qualifications text,
  ADD COLUMN IF NOT EXISTS default_tva_rate text DEFAULT '20',
  ADD COLUMN IF NOT EXISTS default_validity_days text DEFAULT '30',
  ADD COLUMN IF NOT EXISTS default_conditions text,
  ADD COLUMN IF NOT EXISTS invoice_mentions text,
  ADD COLUMN IF NOT EXISTS quote_prefix text,
  ADD COLUMN IF NOT EXISTS invoice_prefix text;
