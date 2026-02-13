# Documentation Page Clients – TitanBtp

**Document destiné à l'analyse fonctionnelle et technique**

---

## 1. Vue d'ensemble

La **page Clients** permet de gérer les clients de l'entreprise et leurs chantiers associés. Elle affiche une liste de clients sous forme de cartes, avec une vue détaillée par client montrant ses chantiers et les actions d'attribution.

| Élément | Détail |
|--------|--------|
| **Chemin** | `/dashboard/clients` |
| **Composant principal** | `ClientsPage.tsx` |
| **Titre affiché** | « Clients » |
| **Sous-titre** | « Gérez vos clients et leurs chantiers » (ou « Chantiers de {nom} » en vue détaillée) |

---

## 2. Objectif et usage

- Consulter la liste de tous les clients
- Créer de nouveaux clients (nom, email, téléphone)
- Voir les chantiers associés à chaque client
- Attribuer un chantier existant à un client
- Créer un nouveau chantier pour un client (redirection vers Mes Chantiers avec client présélectionné)

---

## 3. Structure de l'interface

### 3.1 En-tête

- Titre « Clients »
- Sous-titre dynamique selon la vue
- Bouton « Ajouter un Client » (visible uniquement en vue liste)
- Bouton « Retour à la liste » (visible uniquement en vue détaillée)
- `UserAccountButton` (compte utilisateur)

### 3.2 Vue liste des clients

Grille de cartes (1 à 3 colonnes selon la largeur d'écran) affichant pour chaque client :

- **Avatar** : icône utilisateur dans un cercle
- **Nom** du client
- **Email** (avec icône Mail)
- **Téléphone** (avec icône Phone)
- **Nombre de chantiers** associés (avec icône Building)

**Interaction** : clic sur une carte pour ouvrir la vue détaillée du client.

### 3.3 Vue détaillée d'un client

#### Bloc informations client

- Avatar, nom, email, téléphone
- Style cohérent avec le reste de l'application (glassmorphism)

#### Section « Chantiers de {nom} »

- **Boutons d'action** :
  - « Attribuer un chantier existant » : ouvre un dialogue pour choisir un chantier à attribuer
  - « Ajouter un chantier » : redirige vers `/dashboard/projects?openDialog=true&clientId={id}`

#### Liste des chantiers du client

Pour chaque chantier :

- Image de couverture (si présente) avec badge du nombre d'images
- Nom du chantier
- Date de début
- Durée
- Badge de statut (planifié / en cours / terminé) avec couleur

**État vide** : message « Aucun chantier pour ce client » avec icône.

#### Dialogue « Attribuer un chantier »

- Liste des chantiers **non encore attribués à ce client**
- Pour chaque chantier : nom, client actuel (ou « Non attribué »), date de début
- Bouton « Attribuer à ce client » par chantier
- Message si aucun chantier disponible : « Aucun autre chantier à attribuer... »

---

## 4. Données affichées

### 4.1 Entité Client

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique |
| `name` | string | Nom du client |
| `email` | string | Email |
| `phone` | string | Numéro de téléphone |

### 4.2 Champs du formulaire de création

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| Nom | Oui | Nom du client |
| Email | Oui | Adresse email |
| Téléphone | Oui | Numéro de téléphone |

**Note** : L'adresse n'est pas gérée dans la version actuelle.

### 4.3 Badges statut chantier (couleurs)

- **Planifié** : fond bleu pastel (`bg-blue-500/20`), texte bleu clair (`text-blue-300`)
- **En cours** : fond jaune pastel (`bg-yellow-500/20`), texte jaune clair (`text-yellow-300`)
- **Terminé** : fond vert pastel (`bg-green-500/20`), texte vert clair (`text-green-300`)

---

## 5. Interactions utilisateur

### 5.1 Création de client

1. Clic sur « Ajouter un Client »
2. Remplir Nom, Email, Téléphone (obligatoires)
3. Clic sur « Ajouter » → appel à `addClient`, fermeture du dialogue et affichage d’un toast en cas d’erreur

### 5.2 Consultation d’un client

- Clic sur une carte client → ouverture de la vue détaillée
- Affichage des chantiers dont `clientId === selectedClient.id`

### 5.3 Attribution d’un chantier

1. Dans la vue détaillée, clic sur « Attribuer un chantier existant »
2. Sélection d’un chantier dans la liste (chantiers dont `clientId !== selectedClient.id`)
3. Clic sur « Attribuer à ce client » → appel à `updateChantier` avec `clientId` et `clientName`
4. Toast de confirmation, fermeture du dialogue

### 5.4 Création d’un chantier pour un client

- Clic sur « Ajouter un chantier » → redirection vers `/dashboard/projects?openDialog=true&clientId={id}`
- Le formulaire de création de chantier est pré-rempli avec le client

---

## 6. Logique métier

### 6.1 Filtrage des chantiers

- **Chantiers du client** : `chantiers.filter(c => c.clientId === selectedClient.id)`
- **Chantiers à attribuer** : `chantiers.filter(c => c.clientId !== selectedClient.id)` (inclut les chantiers sans client)

### 6.2 Attribution de chantier

Lors de l’attribution, `updateChantier` met à jour :

- `clientId` : ID du client cible
- `clientName` : nom du client cible

Le chantier passe ainsi sous la responsabilité du nouveau client.

---

## 7. Architecture des composants

```
ClientsPage.tsx
    │
    ├── useChantiers() (ChantiersContext)
    │       ├── clients
    │       ├── chantiers
    │       ├── addClient
    │       └── updateChantier
    │
    ├── État local
    │       ├── selectedClient
    │       ├── isDialogOpen (création client)
    │       ├── isAssignChantierDialogOpen
    │       ├── newClient (formulaire)
    │       ├── isAdding
    │       └── assigningChantierId
    │
    ├── Vue liste : grille de Card (clients)
    └── Vue détaillée : Card client + grille de Card (chantiers)
```

---

## 8. Fichiers sources

| Fichier | Rôle |
|---------|------|
| `client/src/pages/ClientsPage.tsx` | Page principale, liste et vue détaillée |
| `client/src/lib/supabaseClients.ts` | API Supabase clients (`fetchClientsForUser`, `insertClient`) |
| `client/src/context/ChantiersContext.tsx` | Fournit `clients`, `chantiers`, `addClient`, `updateChantier` |

### Table Supabase `clients`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `user_id` | uuid | Référence utilisateur propriétaire |
| `name` | text | Nom |
| `email` | text | Email |
| `phone` | text | Téléphone (nullable) |
| `created_at` | timestamptz | Date de création |

---

## 9. Dépendances techniques

### 9.1 Contextes

- `ChantiersContext` : `clients`, `chantiers`, `addClient`, `updateChantier`

### 9.2 API

- `fetchClientsForUser(userId)` : récupère les clients de l’utilisateur (via ChantiersContext)
- `insertClient(userId, payload)` : crée un client (via `addClient`)
- `updateChantier(id, { clientId, clientName })` : réaffecte un chantier à un client

### 9.3 Composants UI

- `PageWrapper`, `Card`, `CardHeader`, `CardContent`, `CardTitle`, `Button`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogTrigger`
- `Input`, `Label`
- `UserAccountButton`
- `Link` (wouter) pour la navigation

### 9.4 Icônes

- `User`, `Plus`, `Building`, `Mail`, `Phone`, `Image`, `Link2` (lucide-react)

---

## 10. Flux de données

```
ChantiersContext
    ├── clients (chargés via fetchClientsForUser)
    ├── chantiers (chargés via fetchChantiers)
    │
    └── ClientsPage
            ├── Sélection client → clientChantiers, chantiersToAssign
            ├── addClient → insertClient → mise à jour clients
            └── updateChantier → mise à jour clientId/clientName du chantier
```

---

## 11. Permissions et accès

- **Route** : `/dashboard/clients` (admin uniquement, pas de variante équipe)
- La page est protégée par `ProtectedRoute` via le Dashboard

---

## 12. Points d’attention pour l’analyse

1. **Édition de client** : l’édition (modification) d’un client existant n’est pas implémentée ; seule la création est disponible.
2. **Adresse** : le champ adresse mentionné dans la documentation générale n’est pas présent.
3. **Création de facture depuis la fiche client** : non implémentée dans la version actuelle.
4. **Recherche** : pas de champ de recherche ou de filtre sur la liste des clients.
5. **Chantiers sans client** : les chantiers avec `clientId` null ou vide peuvent être attribués via « Attribuer un chantier existant ».

---

*Document mis à jour pour l’analyse fonctionnelle de la page Clients – TitanBtp*
