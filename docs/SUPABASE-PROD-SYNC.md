# Aligner la base Supabase Production avec Staging

Pour que la **production** et le **staging** aient le même schéma, le script unique dans le dépôt fait référence. Exécuter le même script sur les deux environnements (staging en premier pour tester, puis prod).

---

## Méthode recommandée : script unique

**Fichier : `supabase/run_all_migrations_prod.sql`**

Ce script est idempotent et contient tout le schéma cible (tables, colonnes, contraintes, RLS, fonctions, storage). Il inclut notamment :

- Tables métier : `user_profiles`, `clients`, `chantiers`, `quotes`, `invoices`, `payments`, `planning_notes`, `user_tariffs`, `chantier_documents`, `quote_signatures`, `client_form_links`
- Tables additionnelles : **`admin_codes`**, **`user_email_connections`**, **`estimations`**, **`invoice_numbering`**, **`team_invitations`**, `team_members`, `chantier_assignments`, `ai_usage`, `ai_response_cache`
- Colonnes CRM sur `clients` (stage, linked_quote_id, company, notes, etc.) et `notes_avancement` sur `chantiers`
- Contrainte catégories sur `user_tariffs` (alignée avec l’app)
- Fonction `generate_invoice_number`, bucket `uploads`, policies RLS

**Procédure :**

1. **Staging** : SQL Editor du projet **staging** → coller tout le contenu de `run_all_migrations_prod.sql` → Run.
2. Tester l’app sur staging (connexion, tarifs, devis, factures, équipe, estimations, etc.).
3. **Prod** : SQL Editor du projet **prod** → coller le **même** script → Run.

Aucune donnée existante n’est supprimée (pas de `DROP TABLE` sur les tables de données, sauf dans le bloc conditionnel prospects → clients si la table `prospects` existe).

---

## Méthode 2 : migrations fichier par fichier (Dashboard)

1. Ouvre le **Dashboard Supabase** du projet **production** : https://supabase.com/dashboard → ton projet prod.
2. Va dans **SQL Editor** → **New query**.
3. Pour **chaque** fichier ci‑dessous, dans l’ordre :
   - Ouvre le fichier dans `supabase/migrations/nom_du_fichier.sql`
   - Copie tout son contenu
   - Colle dans l’éditeur SQL
   - Clique sur **Run**
   - Si une erreur indique "already exists" ou "column already exists", c’est souvent normal (migration déjà appliquée) : passe à la suivante.

### Ordre recommandé des migrations

Exécuter dans cet ordre (les numéros sont juste pour le suivi) :

| # | Fichier | Rôle |
|---|---------|------|
| 1 | `create_user_profile_on_signup.sql` | Trigger profil à la création utilisateur |
| 2 | `user_profiles_settings_columns.sql` | Colonnes supplémentaires sur `user_profiles` |
| 3 | `rename_prospects_to_clients.sql` | Renommage table prospects → clients (si tu avais l’ancienne table) |
| 4 | `merge_prospects_to_clients.sql` | Fusion données prospects dans clients |
| 5 | `add_contact_id_to_quotes_staging.sql` | Colonne `contact_id` sur `quotes` (référence `clients`) |
| 6 | `add_signed_status_to_quotes.sql` | Statut "signé" sur les devis |
| 7 | `quote_signatures.sql` | Table liens de signature devis |
| 8 | `store_quote_pdf.sql` | Stockage PDF devis |
| 9 | `client_form_links.sql` | Liens formulaire client public (si pas déjà dans schema.sql) |
| 10 | `chantier_documents.sql` | Table documents chantier (bons de commande, etc.) |
| 11 | `user_tariffs.sql` | Table tarifs utilisateur |
| 12 | `generate_invoice_number.sql` | Fonction numéro de facture |
| 13 | `crm_prospect_enhancements.sql` | Améliorations CRM |
| 14 | `add_crm_columns_to_clients.sql` | Colonnes CRM sur `clients` |
| 15 | `add_missing_crm_columns_to_clients.sql` | Colonnes CRM manquantes |
| 16 | `ai_usage_and_cache.sql` | Usage IA + cache |
| 17 | `team_management.sql` | Gestion équipe |
| 18 | `storage_uploads_bucket.sql` | **Bucket "uploads"** (évite "Bucket not found" pour les documents projet) |

À faire **une seule fois**, uniquement si tu avais l’ancienne table `prospects` et des devis à relier :
- `backfill_contact_id_quotes.sql` — remplit `contact_id` sur les anciens devis (après avoir exécuté la migration qui ajoute la colonne).

**À ne pas exécuter sur prod** (spécifique staging ou doublon) :
- `add_contact_id_to_quotes.sql` — ancienne version (référence `prospects`) ; utiliser `add_contact_id_to_quotes_staging.sql` à la place.

---

## Méthode 2 : Supabase CLI (si configurée)

Si tu utilises la CLI Supabase et que le projet prod est lié :

```bash
# Lier le projet prod (une fois)
supabase link --project-ref <PROJECT_REF_PROD>

# Appliquer toutes les migrations en attente
supabase db push
```

`supabase db push` applique les migrations du dossier `supabase/migrations/` dans l’ordre (par nom de fichier). Vérifier avant que le projet lié est bien la **production**.

---

## Vérifications après exécution

1. **Storage** : Dans Supabase → **Storage**, le bucket **uploads** doit exister (sinon l’upload de documents projet échoue).
2. **Tables** : Vérifier que les tables `chantier_documents`, `quote_signatures`, `user_tariffs`, `admin_codes`, `user_email_connections`, `estimations`, `invoice_numbering`, `team_invitations`, etc. existent (Table Editor).
3. **Politiques RLS** : Les tables concernées doivent avoir des politiques RLS activées (vérifiable dans Authentication → Policies ou dans le SQL des migrations).

---

## Si la prod part de zéro

Si la base production est vide ou très ancienne :

1. Exécuter d’abord **`supabase/schema.sql`** en entier (schéma de base : `user_profiles`, `clients`, `chantiers`, `quotes`, `invoices`, `payments`, `planning_notes`, `user_tariffs`, etc.).
2. Puis exécuter **`supabase/run_all_migrations_prod.sql`** en entier (ajoute les tables manquantes et aligne les colonnes/contraintes/RLS).

Une fois tout exécuté, staging et prod ont le même schéma et les mêmes capacités (documents projet, factures, CRM, équipe, estimations, codes admin, connexion email, etc.).
