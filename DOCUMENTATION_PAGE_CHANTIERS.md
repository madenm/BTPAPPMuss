# Documentation Page Chantiers (Mes Chantiers) – ChantierPro

**Document destiné à l'analyse fonctionnelle et technique**

---

## 1. Vue d'ensemble

La **page Mes Chantiers** (ou page Chantiers) permet de gérer tous les chantiers (projets) de l'entreprise : création, modification, suivi des devis et factures par chantier, affectation de membres d'équipe et gestion des images.

| Élément | Détail |
|--------|--------|
| **Chemin** | `/dashboard/projects` |
| **Composant principal** | `ProjectsPage.tsx` |
| **Titre affiché** | « Mes Chantiers » |
| **Sous-titre** | « Gérez tous vos projets en cours et terminés » |

---

## 2. Objectif et usage

- Consulter la liste de tous les chantiers sous forme de cartes
- Créer un nouveau chantier (nom, client, type, dates, durée, statut, description, notes d'avancement, images, membres affectés)
- Modifier un chantier existant (mêmes champs + gestion des devis et factures)
- Depuis la fiche chantier : créer / prévisualiser / télécharger / valider / supprimer des devis
- Depuis la fiche chantier : voir les factures du chantier et créer une facture
- Affecter ou retirer des membres d'équipe à un chantier (création et édition)
- Ouvrir la page depuis la page Clients avec un client présélectionné (`?openDialog=true&clientId=...`)
- Ouvrir l'édition d'un chantier depuis le Planning (`?edit=chantierId`)

---

## 3. Structure de l'interface

### 3.1 En-tête

- Titre « Mes Chantiers »
- Sous-titre « Gérez tous vos projets en cours et terminés »
- Lien / bouton « Clients » (vers `/dashboard/clients`)
- Bouton « Ajouter un Chantier » (ouvre le dialogue de création)
- `UserAccountButton` (compte utilisateur)

### 3.2 Zone principale : grille de chantiers

- **État vide** : message « Aucun chantier » avec bouton « Ajouter un chantier ».
- **Liste** : grille responsive (1 à 3 colonnes selon la largeur) de cartes cliquables.

Pour chaque carte chantier :

- **Image(s)** : première image en couverture ; si plusieurs images, indicateur « X / N » et flèches gauche/droite au survol pour naviguer
- **Nom** du chantier
- **Client** (nom, avec icône User)
- **Type de chantier** (libellé si renseigné : Piscine & Spa, Rénovation, etc.)
- **Date de début** (format DD/MM/YYYY)
- **Durée** (texte libre, ex. « 2 semaines »)
- **Montant devis** (si renseigné, format EUR)
- **Badge de statut** : Planifié (bleu), En cours (jaune), Terminé (vert)

**Interaction** : clic sur une carte → ouverture du dialogue « Modifier le chantier ».

### 3.3 Dialogue « Nouveau Chantier »

Champs :

- Nom du chantier (obligatoire)
- Client (select + bouton pour créer un client « Client N »)
- Type de chantier (select : Piscine & Spa, Aménagement Paysager, Menuiserie, Rénovation, Plomberie, Maçonnerie, Terrasse & Patio, Chauffage & Climatisation, Isolation, Électricité, Peinture & Revêtements, Autre)
- Date de début (sélecteur de date, format JJ/MM/AAAA)
- Durée (texte libre)
- Statut (Planifié / En cours / Terminé)
- Description du projet (textarea, reprise dans le devis)
- Notes sur l'avancement (textarea)
- Images (upload multiple, prévisualisation, suppression par image)
- Membres affectés (liste de membres d'équipe avec cases à cocher)

Boutons : Annuler, Ajouter.

### 3.4 Dialogue « Modifier le chantier »

Même structure que la création, avec en plus :

- **Devis** : liste des devis du chantier avec pour chaque devis :
  - Date, montant TTC, statut (validé avec icône si applicable), badge « Date de validité dépassée » si expiré
  - Actions : Prévisualiser, Télécharger (PDF), Modifier, Valider (si non validé), Supprimer
  - Lien « Créer un devis » (vers `/dashboard/quotes?chantierId=...`)
- **Factures** : texte « X facture(s) associée(s) » + boutons « Voir les factures » (vers `/dashboard/invoices?chantierId=...`) et « Créer une facture » (ouvre `InvoiceDialog`)

En édition : champs description et notes d'avancement avec **VoiceInputButton** (saisie vocale).

Boutons : Annuler, Enregistrer les modifications.

### 3.5 Autres dialogues

- **Aperçu du devis** : dialogue avec `QuotePreview` pour le devis sélectionné.
- **InvoiceDialog** : création de facture (chantier et client pré-remplis quand ouverts depuis la fiche chantier).

---

## 4. Données affichées

### 4.1 Entité Chantier (contexte)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique |
| `nom` | string | Nom du chantier |
| `clientId` | string | ID du client |
| `clientName` | string | Nom du client |
| `dateDebut` | string | Date de début (ISO YYYY-MM-DD) |
| `duree` | string | Durée (texte libre) |
| `images` | string[] | URLs des images (Supabase Storage) |
| `statut` | 'planifié' \| 'en cours' \| 'terminé' | Statut du chantier |
| `notes` | string? | Description du projet |
| `notesAvancement` | string? | Notes d'avancement |
| `typeChantier` | string? | Type (piscine, paysage, renovation, etc.) |
| `montantDevis` | number? | Montant du devis associé (si renseigné) |

### 4.2 Types de chantier (liste)

Piscine & Spa, Aménagement Paysager, Menuiserie Sur-Mesure, Rénovation, Plomberie, Maçonnerie, Terrasse & Patio, Chauffage & Climatisation, Isolation de la charpente, Électricité, Peinture & Revêtements, Autre.

### 4.3 Badges statut (couleurs)

- **Planifié** : `bg-blue-500/20`, `text-blue-300`
- **En cours** : `bg-yellow-500/20`, `text-yellow-300`
- **Terminé** : `bg-green-500/20`, `text-green-300`

---

## 5. Interactions utilisateur

### 5.1 Création de chantier

1. Clic sur « Ajouter un Chantier »
2. Remplir au minimum : Nom, Client, Date de début, Durée
3. Optionnel : type, statut, description, notes d'avancement, images, membres affectés
4. Clic sur « Ajouter » → `addChantier` puis affectations membres → toast de succès, fermeture du dialogue

Validation : toast « Informations manquantes » si un champ obligatoire est vide (liste des champs concernés).

### 5.2 Édition de chantier

1. Clic sur une carte chantier → ouverture du dialogue « Modifier le chantier »
2. Modification des champs puis « Enregistrer les modifications » → `updateChantier` + mise à jour des affectations membres (ajout/retrait)
3. Gestion des images : suppression d’images existantes, ajout de nouvelles (upload Storage)

### 5.3 Devis (depuis la fiche chantier)

- **Créer un devis** : lien vers `/dashboard/quotes?chantierId=...` ou bouton « Créer un devis » dans la section Devis
- **Prévisualiser** : ouverture du dialogue avec `QuotePreview`
- **Télécharger** : génération PDF via `downloadQuotePdf` (logo, profil entreprise, numéro de devis)
- **Valider** : `updateQuoteStatus(..., 'validé')` → toast « Devis validé »
- **Supprimer** : confirmation puis `deleteQuote` → toast « Devis supprimé »

### 5.4 Factures (depuis la fiche chantier)

- **Voir les factures** : redirection vers `/dashboard/invoices?chantierId=...`
- **Créer une facture** : ouverture de `InvoiceDialog` avec `chantierId` et `clientId` du chantier ; après enregistrement, rechargement de la liste des factures du chantier

### 5.5 Ouverture avec paramètres URL

- `?openDialog=true&clientId=xxx` : ouverture du dialogue « Nouveau Chantier » avec le client présélectionné (depuis la page Clients).
- `?edit=chantierId` : ouverture directe du dialogue « Modifier le chantier » pour le chantier donné (depuis le Planning). L’URL est ensuite nettoyée (`replaceState` vers `/dashboard/projects`).

---

## 6. Logique métier

### 6.1 Chantiers et clients

- Les chantiers et clients viennent du `ChantiersContext` (chargés selon l’utilisateur connecté ou le membre d’équipe).
- Création chantier : `addChantier` (contexte) qui appelle l’API Supabase (chantiers) ; le client doit exister dans la liste `clients`.

### 6.2 Affectation membres d’équipe

- À la création : pour chaque ID dans `newChantierMemberIds`, appel à `addChantierAssignment(chantierId, memberId)`.
- À l’édition : comparaison entre affectations courantes et sélection dans le dialogue ; ajout des nouvelles affectations, suppression des retirées (`addChantierAssignment` / `removeChantierAssignment`).

### 6.3 Images

- Upload : `uploadFile` vers le bucket Supabase « uploads », chemin `{userId}/chantiers/{folderId ou chantierId}/{timestamp}-{nom}`.
- Suppression en édition : `removeFile(publicUrlToPath(url))` pour les URLs Storage.

### 6.4 Devis expiré

- Un devis est considéré expiré si `created_at + validity_days` est antérieur à la date du jour. Un badge « Date de validité dépassée » est affiché si expiré et statut différent de « expiré ».

---

## 7. Architecture des composants

```
ProjectsPage.tsx
    │
    ├── useAuth(), useChantiers(), useUserSettings(), useToast()
    │
    ├── État local
    │       ├── isDialogOpen (création), isEditDialogOpen (édition)
    │       ├── selectedChantier, editChantier
    │       ├── newChantier, newChantierMemberIds, newChantierTeamMembers
    │       ├── editAssignedMemberIds, teamMembers
    │       ├── chantierQuotes, chantierInvoices
    │       ├── isQuotePreviewOpen, selectedQuoteForPreview
    │       ├── isInvoiceDialogOpen
    │       ├── currentImageIndex (par chantier)
    │       └── divers états de chargement (quotes, invoices, upload, etc.)
    │
    ├── PageWrapper
    │       ├── En-tête (titre, Clients, Ajouter un Chantier, UserAccountButton)
    │       ├── Dialog Nouveau Chantier (formulaire complet)
    │       ├── Dialog Modifier le chantier (formulaire + Devis + Factures)
    │       ├── Dialog Aperçu devis (QuotePreview)
    │       ├── InvoiceDialog
    │       └── main : grille de Card (chantiers) ou état vide
    │
    └── ChantierEditDialog non utilisé ici ; formulaire d’édition intégré dans ProjectsPage
```

---

## 8. Fichiers sources

| Fichier | Rôle |
|---------|------|
| `client/src/pages/ProjectsPage.tsx` | Page principale : liste, création, édition, devis, factures |
| `client/src/context/ChantiersContext.tsx` | Fournit `chantiers`, `clients`, `addChantier`, `updateChantier`, `addClient` |
| `client/src/lib/supabaseChantiers.ts` | API chantiers (insert, update, fetch pour user / team member) |
| `client/src/lib/supabase.ts` | Affectations chantier–membre, `fetchTeamMembers` |
| `client/src/lib/supabaseQuotes.ts` | Devis (fetch par chantier, update statut, delete, etc.) |
| `client/src/lib/supabaseInvoices.ts` | Factures (fetch par chantier, etc.) |
| `client/src/lib/supabaseStorage.ts` | Upload / suppression d’images |
| `client/src/lib/quotePdf.ts` | Génération PDF devis |
| `client/src/components/QuotePreview.tsx` | Aperçu rendu du devis |
| `client/src/components/InvoiceDialog.tsx` | Dialogue de création de facture |
| `client/src/components/VoiceInputButton.tsx` | Saisie vocale pour description et notes |

### Tables Supabase concernées

- `chantiers` : chantiers (user_id, nom, client_id, client_name, date_debut, duree, images, statut, notes, type_chantier, notes_avancement, montant_devis, etc.)
- `chantier_assignments` : lien chantier ↔ membre d’équipe
- `team_members` : membres (pour les affectations)
- `quotes` : devis (chantier_id, etc.)
- `invoices`, `payments` : factures et paiements

---

## 9. Dépendances techniques

### 9.1 Contextes

- `AuthContext` : `user`
- `ChantiersContext` : `chantiers`, `clients`, `addChantier`, `updateChantier`, `addClient`, `loading`
- `UserSettingsContext` : `logoUrl`, `themeColor`, `profile` (pour le PDF devis)

### 9.2 API / lib

- `fetchTeamMembers`, `fetchChantierAssignmentsByChantier`, `addChantierAssignment`, `removeChantierAssignment`
- `fetchQuotesByChantierId`, `fetchQuotesForUser`, `getQuoteDisplayNumber`, `updateQuoteStatus`, `deleteQuote`
- `fetchInvoicesForUser` (filtre `chantierId`)
- `uploadFile`, `removeFile`, `publicUrlToPath`
- `downloadQuotePdf`, `fetchLogoDataUrl`

### 9.3 Composants UI

- `PageWrapper`, `Card`, `CardHeader`, `CardContent`, `CardTitle`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogTrigger`
- `Input`, `Label`, `Textarea`, `Select`, `Button`, `Badge`
- `Popover`, `Calendar`, `Checkbox`
- `Link` (wouter), `UserAccountButton`, `QuotePreview`, `InvoiceDialog`, `VoiceInputButton`

---

## 10. Flux de données

```
ChantiersContext
    ├── chantiers (fetchChantiersForUser ou fetchChantiersForTeamMember)
    ├── clients (fetchClientsForUser)
    ├── addChantier → insertChantier (supabaseChantiers)
    └── updateChantier → updateChantierRemote

ProjectsPage
    ├── Liste : affichage de chantiers
    ├── Création : addChantier + addChantierAssignment (par membre coché)
    ├── Édition : updateChantier + add/removeChantierAssignment
    ├── Devis : fetchQuotesByChantierId, updateQuoteStatus, deleteQuote, downloadQuotePdf
    └── Factures : fetchInvoicesForUser(chantierId), InvoiceDialog
```

---

## 11. Permissions et accès

- **Route** : `/dashboard/projects` (propriétaire uniquement, pas de variante équipe pour cette page).
- La page est protégée par `ProtectedRoute` ; les chantiers affichés dépendent de l’utilisateur connecté (ou du membre d’équipe dans le cas du dashboard équipe `/team-dashboard/projects`, qui utilise un autre flux de données).

---

## 12. Points d’attention pour l’analyse

1. **Pas de recherche ni filtre** : tous les chantiers sont affichés sans filtre par statut, type ou client.
2. **Création de client rapide** : le bouton « + » à côté du select client crée un client « Client N » (sans formulaire détaillé) et le sélectionne pour le nouveau chantier.
3. **Plusieurs devis par chantier** : l’interface permet plusieurs devis par chantier ; un message invite à supprimer les doublons si besoin.
4. **Date de début** : stockée en ISO (YYYY-MM-DD) ; affichage et saisie en DD/MM/YYYY avec calendrier.
5. **ChantierEditDialog** : composant existant mais non utilisé sur cette page ; l’édition est entièrement gérée dans `ProjectsPage.tsx`.

---

*Document mis à jour pour l’analyse fonctionnelle de la page Mes Chantiers – ChantierPro*
