# Documentation Page Gestion de l'Équipe – TitanBtp

**Document destiné à l'analyse fonctionnelle et technique**

---

## 1. Vue d'ensemble

La **page Gestion de l'Équipe** permet à l'administrateur de gérer les membres de son équipe : création, modification, suppression, génération de liens d'invitation, attribution des permissions et affectation aux chantiers.

| Élément | Détail |
|--------|--------|
| **Chemin** | `/dashboard/team` |
| **Composant** | `TeamPage.tsx` |
| **Titre affiché** | « Gestion de l'Équipe » |
| **Sous-titre** | « Gérez les membres de votre équipe et leurs codes de connexion » |
| **Accès** | Admin uniquement (ProtectedRoute) |

---

## 2. Objectif et usage

- Lister les membres de l'équipe avec recherche
- Ajouter un nouveau membre avec permissions granulaires
- Modifier un membre existant (infos, permissions, chantiers affectés)
- Supprimer un membre
- Générer un lien d'invitation pour chaque membre
- Gérer le code de connexion (affiché, modifiable)
- Affecter les membres aux chantiers (via l'édition d'un membre)

---

## 3. Structure de l'interface

### 3.1 En-tête

- Titre « Gestion de l'Équipe »
- Bouton « Ajouter un Membre » (ouvre le dialog de création)
- Bouton de compte utilisateur (`UserAccountButton`)

### 3.2 Carte « Membres de l'Équipe »

- **Recherche** : champ de recherche (nom, email, téléphone, rôle, code)
- **Liste des membres** : cartes pour chaque membre avec :
  - Avatar (icône User)
  - Nom, rôle
  - Email, téléphone, code de connexion
  - Badge statut (Actif / Inactif)
  - Boutons : Partager (invitation), Modifier, Supprimer
- **État vide** : message si aucun membre
- **État recherche vide** : « Aucun membre trouvé pour "..." »

### 3.3 Carte « Affectation aux Chantiers »

- Texte d’information : rappel que l’affectation se fait depuis la fiche chantier ou le planning

### 3.4 Dialog « Ajouter un Nouveau Membre »

- Nom complet
- Rôle (sélecteur : Chef de chantier, Ouvrier, Commercial, Assistant, Autre)
- Email
- Téléphone
- Code de connexion (obligatoire, max 10 caractères)
- Section **Permissions** (checkboxes) : voir détail section 5
- Boutons : Annuler, Ajouter le Membre

### 3.5 Dialog « Modifier le Membre »

- Mêmes champs que création + Statut (Actif / Inactif)
- Section **Permissions** identique
- Section **Chantiers affectés** : liste de checkboxes des chantiers (depuis `ChantiersContext`)
- Boutons : Annuler, Enregistrer

### 3.6 Modal « Lien d'invitation créé »

- Champ lecture seule avec l’URL d’invitation
- Bouton Copier
- Champ Code de connexion (modifiable, enregistré au blur)
- Bouton Fermer

---

## 4. Données – Entité TeamMember

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique |
| `name` | string | Nom complet |
| `role` | string | Rôle (Chef de chantier, Ouvrier, etc.) |
| `email` | string | Email |
| `phone` | string \| null | Téléphone |
| `status` | enum | `actif` \| `inactif` |
| `login_code` | string | Code de connexion (max 10 car.) |
| `user_id` | string \| null | ID utilisateur admin propriétaire |
| `created_at` | string | Date de création |
| `updated_at` | string | Date de mise à jour |

### 4.1 Permissions (booléens optionnels)

| Permission | Description |
|------------|-------------|
| `can_view_dashboard` | Accès au tableau de bord |
| `can_use_estimation` | Utiliser l'estimation automatique |
| `can_view_all_chantiers` | Voir tous les chantiers |
| `can_manage_chantiers` | Gérer les chantiers (créer, modifier, supprimer) |
| `can_view_planning` | Voir le planning |
| `can_manage_planning` | Gérer le planning |
| `can_access_crm` | Accès au pipeline CRM |
| `can_create_quotes` | Créer des devis |
| `can_manage_invoices` | Gérer les factures |
| `can_use_ai_visualization` | Utiliser la visualisation IA |
| `can_manage_team` | Gérer l'équipe |
| `can_manage_clients` | Gérer les clients |

**Note** : Les permissions peuvent être stockées en base (si migration exécutée) ou dans `localStorage` (clé `team_member_permissions_{id}`) en secours.

---

## 5. Rôles disponibles

- Chef de chantier
- Ouvrier
- Commercial
- Assistant
- Autre

---

## 6. Interactions utilisateur

### 6.1 Ajout d’un membre

1. Clic sur « Ajouter un Membre »
2. Saisie des champs obligatoires (nom, rôle, email, code)
3. Configuration des permissions
4. Clic sur « Ajouter le Membre »
5. Création du membre puis génération du lien d’invitation
6. Ouverture du modal d’invitation avec lien et code

### 6.2 Modification d’un membre

1. Clic sur l’icône Modifier (crayon)
2. Mise à jour des champs et des permissions
3. Sélection/désélection des chantiers affectés
4. Clic sur « Enregistrer »

### 6.3 Suppression d’un membre

1. Clic sur l’icône Supprimer (corbeille)
2. Confirmation via `confirm()`
3. Suppression en base puis rechargement de la liste

### 6.4 Lien d’invitation

1. Clic sur l’icône Partager (Share2)
2. Génération du lien via `createTeamInvitation(member.id, member.email)`
3. Ouverture du modal avec lien + code
4. Copie possible du lien
5. Code modifiable et enregistré au blur via `updateTeamMember`

### 6.5 Recherche

- Filtrage en temps réel sur : nom, email, rôle, code, téléphone
- Tri : correspondances exactes en premier, puis début de chaîne

---

## 7. Logique métier

### 7.1 Affectation aux chantiers

- Chargement via `fetchChantierAssignmentsByTeamMember(memberId)` à l’ouverture du dialog d’édition
- Sauvegarde via `setChantierAssignmentsForMember(memberId, chantierIds)` à l’enregistrement
- Les chantiers proviennent de `ChantiersContext` (chantiers de l’admin)

### 7.2 Invitations

- `createTeamInvitation(memberId, email)` crée une entrée dans `team_invitations` et retourne l’URL d’invitation
- Le membre utilise cette URL + son code de connexion pour accéder au dashboard équipe (`/team-dashboard`)

---

## 8. Dépendances techniques

### 8.1 API Supabase (lib/supabase.ts)

- `fetchTeamMembers()` : liste des membres de l’équipe (filtrée par `user_id`)
- `createTeamMember(member)` : création
- `updateTeamMember(id, updates)` : mise à jour
- `deleteTeamMember(id)` : suppression
- `createTeamInvitation(memberId, email)` : génération du lien
- `fetchChantierAssignmentsByTeamMember(memberId)` : chantiers assignés
- `setChantierAssignmentsForMember(memberId, chantierIds)` : mise à jour des affectations

### 8.2 Contexte

- `ChantiersContext` : fournit `chantiers` pour la section « Chantiers affectés »

### 8.3 Composants UI

- `PageWrapper`, `Card`, `CardHeader`, `CardContent`, `CardTitle`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogTrigger`, `DialogFooter`
- `Button`, `Input`, `Label`, `Select`, `Checkbox`, `Badge`
- `UserAccountButton`

---

## 9. Tables Supabase

| Table | Rôle |
|-------|------|
| `team_members` | Membres de l’équipe |
| `team_invitations` | Liens d’invitation |
| `chantier_assignments` | Affectations membre ↔ chantier |

---

## 10. Flux de données

```
Admin (authentifié)
        │
        ▼
TeamPage
        │
        ├── loadMembers() → fetchTeamMembers() → members
        │
        ├── handleAddMember() → createTeamMember() → createTeamInvitation()
        ├── handleUpdateMember() → updateTeamMember() → setChantierAssignmentsForMember()
        ├── handleDeleteMember() → deleteTeamMember()
        ├── handleGetInviteLink() → createTeamInvitation()
        └── handleEditMember() → fetchChantierAssignmentsByTeamMember() → editAssignedChantierIds
```

---

## 11. Points d’attention pour l’analyse

1. **Permissions** : stockage possible en `localStorage` si les colonnes n’existent pas en base (migration SQL optionnelle).
2. **Code de connexion** : requis à la création, modifiable dans le modal d’invitation et dans l’édition.
3. **Statut** : `fetchTeamMembers` filtre sur `status: 'actif'` ; les membres inactifs ne s’affichent pas dans la liste principale.
4. **Suppression** : supprime physiquement le membre en base (pas de soft delete).
5. **Recherche** : effectuée côté client sur la liste chargée.
6. **Design** : style glassmorphism (fond noir/20, bordures blanches).

---

## 12. Fichier source

- **Chemin** : `client/src/pages/TeamPage.tsx`
- **Lignes** : ~1118 lignes

---

*Document généré pour l'analyse fonctionnelle de la page Gestion de l'Équipe – TitanBtp*
