-- À exécuter une fois en prod (SQL Editor Supabase) pour corriger l'erreur
-- "user_tariffs_category_check" sur l'insertion de tarifs.
-- Les catégories doivent être exactement celles envoyées par l'app (minuscules + accents).

alter table public.user_tariffs drop constraint if exists user_tariffs_category_check;
alter table public.user_tariffs add constraint user_tariffs_category_check check (category in ('matériau', 'service', 'main-d''œuvre', 'location', 'sous-traitance', 'transport', 'équipement', 'fourniture', 'autre'));
