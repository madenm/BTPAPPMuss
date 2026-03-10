# Initialiser la BDD Staging (Supabase)

Une seule requête à exécuter.

## Méthode rapide (recommandée)

1. Ouvre **Supabase** → projet **Staging TitanBTP** → **SQL Editor** → **New query**.
2. Ouvre le fichier **`staging_init.sql`** (à la racine du dossier `supabase/`) dans ton éditeur.
3. Copie **tout** le contenu du fichier.
4. Colle dans l’éditeur SQL Supabase.
5. Clique sur **Run**.
6. Vérifie dans **Table Editor** que les tables sont bien là (user_profiles, clients, chantiers, quotes, invoices, payments, team_members, quote_signature_links, quote_signatures, etc.).

C’est tout. Ta BDD Staging est prête.

---

## Méthode par scripts séparés (si tu préfères)

Si tu préfères exécuter script par script, utilise l’ordre ci‑dessous dans le **SQL Editor** (New query pour chaque, puis Run).

| # | Fichier | Rôle |
|---|---------|------|
| 1 | `schema.sql` | Tables de base |
| 2 | `migrations/create_user_profile_on_signup.sql` | Trigger création profil à l’inscription |
| 3 | `migrations/add_signed_status_to_quotes.sql` | Statut « signé » pour devis |
| 4 | `migrations/quote_signatures.sql` | Tables signature électronique |
| 5 | `migrations/store_quote_pdf.sql` | Colonnes PDF sur quotes |
| 6 | `migrations/add_contact_id_to_quotes_staging.sql` | contact_id sur quotes (vers clients) |
| 7 | `migrations/add_missing_crm_columns_to_clients.sql` | Colonnes CRM sur clients |
| 8 | `migrations/generate_invoice_number.sql` | Fonction `generate_invoice_number` |

**Note :** Pour une BDD vide (staging), utilise `add_contact_id_to_quotes_staging.sql` (qui pointe vers `clients`), pas `add_contact_id_to_quotes.sql` (qui pointe vers l’ancienne table `prospects`).
