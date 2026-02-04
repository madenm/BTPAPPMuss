-- Coordonnées entreprise pour le devis (en-tête PDF).
-- Exécuter une fois dans Supabase : Dashboard > SQL Editor > New query, coller et Run.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_address TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_city_postal TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_phone TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_email TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_siret TEXT;
