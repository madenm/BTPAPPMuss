# Schéma Supabase (TitanBtp)

## Erreurs 404 (table n'existe pas)

Si l’app affiche des erreurs du type **Failed to load resource: 404** pour `quotes`, `chantiers`, `clients`, `planning_notes`, `invoices` ou `payments`, c’est que ces tables n’existent pas encore dans votre projet Supabase.

## Créer les tables

1. Ouvrez le **Dashboard Supabase** du projet utilisé par l’app (celui dont l’URL est dans `VITE_SUPABASE_URL` du `.env`).
2. Allez dans **SQL Editor** → **New query**.
3. Copiez-collez tout le contenu de `schema.sql`.
4. Cliquez sur **Run**.
5. Rechargez l’application : les 404 devraient disparaître et les données s’afficher.

## Résilience côté app

En attendant que les tables existent, l’app ne plante plus : les listes (devis, chantiers, clients, métriques, etc.) s’affichent vides au lieu d’afficher une erreur rouge.
