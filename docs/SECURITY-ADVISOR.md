# Supabase Security Advisor – Prod vs Staging

## Pourquoi des différences entre les deux BDD ?

Les deux projets (BTPAPP = prod, Staging_TitanBTP = staging) ne sont **pas strictement identiques** :

- **Prod** a parfois été mis à jour via le dashboard ou d’anciens scripts (fonctions, triggers) qui ne sont plus dans le dépôt.
- **Staging** a été créé / recréé à partir de `staging_init.sql` ou d’un sous-ensemble de migrations.

Résultat typique :

| Environnement | Erreurs | Warnings | Explication |
|---------------|---------|----------|-------------|
| **Prod**      | 1       | 5        | Contient la fonction `update_updated_at_column` + l’advisor peut remonter un warning sur `quote_signature_links`. |
| **Staging**   | 1       | 3        | Pas de fonction `update_updated_at_column` (ou version sans `search_path`), moins d’objets analysés. |

Après application de la migration `security_advisor_fixes.sql` sur **les deux** projets :

- L’**erreur** (RLS désactivée sur `ai_response_cache`) est corrigée.
- Les **warnings** “Function Search Path Mutable” sur `get_chantiers_for_team_member` et `update_updated_at_column` sont traités.
- Les comptes d’erreurs/warnings peuvent encore différer si d’autres objets ou politiques RLS ne sont pas exactement les mêmes (ex. politiques “always true” sur les signatures, paramètre Auth “Leaked password protection”).

## À faire dans le dashboard Supabase

1. **Auth > Settings** : activer **“Leaked password protection”** (warning “Leaked Password Protection Disabled”) sur prod et staging si vous voulez le même niveau de sécurité.
2. **Politiques RLS “always true”** (`quote_signatures` / `quote_signature_links`) :  
   - Sur `quote_signatures`, la policy `WITH CHECK (true)` pour l’insert est **volontaire** (lien public de signature).  
   - Vous pouvez laisser tel quel ou restreindre (ex. vérifier un token) si vous souhaitez durcir la règle.

## Appliquer la migration

- **Staging** : exécuter tout `supabase/migrations/security_advisor_fixes.sql` en une fois dans le SQL Editor.

- **Prod** : en cas d’erreur **« connection timeout »** (la prod peut être plus lente ou limiter la durée des requêtes), utiliser **`supabase/migrations/security_advisor_fixes_prod_split.sql`** et exécuter **chaque partie séparément** dans le SQL Editor (Partie 1, puis Partie 2, puis Partie 3). Chaque bloc est court et évite le timeout.
