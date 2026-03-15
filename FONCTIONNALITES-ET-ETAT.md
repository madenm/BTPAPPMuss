# TitanBtp — Fonctionnalités et état de l'application

Document de référence décrivant **toutes les fonctionnalités** et l’**état actuel** de l’application (mars 2026).

---

## 1. Vue d’ensemble

**TitanBtp** est une application web de gestion pour entreprises du BTP (chantiers, devis, factures, CRM, planning, équipe). Elle s’adresse au **propriétaire / admin** (compte Supabase) et aux **membres d’équipe** (accès par lien d’invitation + code).

- **URL prod** : https://app.titanbtp.com  
- **Stack** : React 18, TypeScript, Vite, Tailwind, Framer Motion, Express, Supabase (PostgreSQL + Auth + Storage), Resend (emails), OpenAI/Gemini (IA optionnelle).

---

## 2. Routes et accès

### 2.1 Routes publiques (sans connexion)

| Route | Description |
|-------|-------------|
| `/` | Page d’accueil |
| `/login` | Connexion admin (email / mot de passe) |
| `/auth` | Inscription (création de compte) |
| `/invite/:token` | Acceptation d’invitation équipe (saisie du code) |
| `/client-form/:token` | Formulaire client public (soumission par lien) |
| `/sign-quote/:token` | Signature électronique d’un devis (lien unique) |
| `/loading` | Redirection de chargement |

### 2.2 Espace admin (dashboard)

Toutes les routes ci‑dessous sont sous **`/dashboard/...`** et protégées par authentification Supabase.

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Vue d’ensemble, KPIs, graphiques, actions rapides |
| `/dashboard/estimation` | Estimation | Estimation de chantier à partir de photo + IA |
| `/dashboard/projects` | Mes Projets | Liste des chantiers, création, édition, filtres |
| `/dashboard/projects/:id` | Détail projet | Fiche chantier, devis, factures, équipe |
| `/dashboard/planning` | Planning | Vue Semaine / Liste / Mois, notes du jour, chantiers |
| `/dashboard/crm` | CRM Pipeline | Kanban prospects, envoi devis, relances, colonne Terminé |
| `/dashboard/quotes` | Devis | Création / édition de devis (étapes client, description, lignes) |
| `/dashboard/quotes/new` | Nouveau devis | Formulaire nouveau devis |
| `/dashboard/tarifs` | Tarifs | Gestion des tarifs (Artiprix / personnalisés) |
| `/dashboard/invoices` | Factures | Liste factures, filtres, paiements, envoi email, PDF |
| `/dashboard/team` | Équipe | Membres, invitations, codes, permissions |
| `/dashboard/clients` | Contacts | Liste clients, chantiers associés |
| `/dashboard/settings` | Paramètres | Coordonnées entreprise, logo, thème, facturation |
| `/dashboard/create-user` | Créer un utilisateur | Réservé admin (création de compte) |
| `/dashboard/ai-visualization` | IA Visualisation | Génération d’images IA (optionnel) |
| `/dashboard/prospects` | Prospects | Liste des prospects (entrée alternative au CRM) |

### 2.3 Espace équipe (team-dashboard)

Sous **`/team-dashboard`** (et sous‑routes). Accès par **invitation + code**, sans compte Supabase. Droits selon le membre (chantiers assignés, CRM, factures, etc.).

| Route | Contenu |
|-------|--------|
| `/team-dashboard` | Vue d’ensemble équipe |
| `/team-dashboard/projects` | Mes chantiers (assignés) |
| `/team-dashboard/planning` | Planning (chantiers assignés) |
| `/team-dashboard/quotes` | Créer un devis |
| `/team-dashboard/crm` | CRM (si autorisé) |
| `/team-dashboard/invoices` | Factures (si autorisé) |
| `/team-dashboard/team` | Équipe (si autorisé) |
| `/team-dashboard/clients` | Clients (si autorisé) |
| `/team-dashboard/ai-visualization` | IA Visualisation |

---

## 3. Fonctionnalités par module

### 3.1 Authentification

- **Admin** : Inscription `/auth`, connexion `/login`, session Supabase.
- **Équipe** : Lien `/invite/:token` + code de connexion, pas de compte Supabase ; session en localStorage.
- **Protection** : `ProtectedRoute` (admin), `ProtectedTeamRoute` (équipe).

### 3.2 Dashboard (Vue d’ensemble)

- Chiffre d’affaires (paiements enregistrés).
- Chantiers actifs, devis en attente, taux de conversion.
- Graphiques : évolution des revenus (12 mois), évolution du taux de conversion (4 semaines).
- Alertes et actions rapides : factures impayées, projets, devis, planning, équipe.
- Raccourcis : nouveau projet, créer un devis, créer une facture, planning, équipe.

### 3.3 Mes Projets (Chantiers)

- Liste avec filtres (recherche, statut, client, etc.).
- Création / édition : nom, client, dates, durée, type de chantier, statut, description, notes d’avancement.
- **Reconnaissance vocale** (micro) sur description et notes.
- Images : upload Supabase Storage, galerie.
- Devis associés : liste, statuts, prévisualisation PDF, modification, création de facture depuis devis accepté/validé.
- Affectation d’équipe (membres assignés).
- Types : Piscine & Spa, Aménagement paysager, Menuiserie, Rénovation, Autre.
- Statuts : Planifié, En cours, Terminé.

### 3.4 Planning

- **Vues** : Semaine, Liste, Mois.
- **Vue Semaine** : colonnes par jour, hauteur minimale ~400 px par jour pour meilleure lisibilité.
- Chantiers affichés sur leur plage de dates (début + durée).
- Notes du jour par date, éditables.
- Changement de statut (Planifié / En cours / Terminé) depuis le planning.
- Filtres et bouton « Aujourd’hui ».

### 3.5 Devis

- **Workflow en 3 étapes** :
  1. **Client** : sélection ou création, infos contact.
  2. **Description du projet** : type, description (texte + **dictée vocale**), validité, **option « Utiliser l’analyse IA pour préremplir le devis »** (décochée par défaut).
  3. **Lignes du devis** : lignes / sous-lignes, quantités, prix, totaux.

- **Dictée vocale (création de devis)** :
  - Bouton « Parler » / « Arrêter » à côté de la description.
  - Retranscription **en direct** (« En direct : … ») sous le champ.
  - Si la description est remplie via le micro et qu’il reste des utilisations IA, la case **« Utiliser l’analyse IA »** est **cochée automatiquement**.
  - Message d’état « Écoute en cours… Parlez maintenant » aligné à droite pour ne pas dépasser l’écran.

- **IA** : analyse de la description (OpenAI ou Gemini) pour préremplir les lignes ; quota journalier (ex. 10 utilisations).
- Génération PDF, envoi par email, lien de signature.
- Statuts : Brouillon, Envoyé, Accepté, Refusé, Expiré, Validé.
- Liste des devis, filtres, recherche, duplication.

### 3.6 Factures

- Liste avec filtres (client, chantier, statut, année), recherche par numéro.
- Création depuis un devis ou depuis un chantier / client.
- Numérotation automatique (format type `YYYYNNNNNNN`).
- Lignes, totaux HT / TVA / TTC.
- **Paiements** : enregistrement des paiements (date, montant, moyen), recalcul du statut (brouillon, envoyée, payée, partiellement payée, annulée).
- **PDF** : téléchargement depuis la fiche facture.
- **Envoi par email** : bouton « Envoyer par email » avec PDF en pièce jointe (Resend).  
  En **production (Vercel)**, le token d’auth est envoyé dans le **body** de la requête et réinjecté en en-têtes côté serveur pour contourner la suppression des en-têtes par la plateforme.

### 3.7 CRM Pipeline

- **Vue Kanban** :
  - **Devis** : Devis envoyé, À relancer (relance 1 / 2).
  - **Résultat** : **Terminé** (Gagné / Perdu) — **seuls les 5 derniers** (par date de dernière action) sont affichés ; les plus anciens sortent de la liste.

- Drag & drop entre colonnes.
- Envoi de devis par email (sélection d’un devis ou upload PDF), relances personnalisables.
- Détail prospect : fiche sans bouton « Modifier » ni icône lien externe sur le devis lié.
- Détection signature / expiration des devis, mise à jour des statuts.

### 3.8 Tarifs

- Gestion des tarifs (personnalisés et / ou Artiprix).
- Utilisation dans les devis pour suggérer des prix.

### 3.9 Équipe

- Liste des membres (nom, rôle, email, code de connexion, etc.).
- Création d’invitations (lien + code).
- Permissions par membre (accès CRM, factures, équipe, clients, etc.).
- Affectation des membres aux chantiers.

### 3.10 Contacts (Clients)

- Liste clients, création / édition (nom, email, téléphone, adresse).
- Liaison avec les chantiers, accès aux factures associées.

### 3.11 Paramètres

- Coordonnées entreprise (adresse, ville, code postal, téléphone, email, SIRET).
- Logo (upload), couleur d’accent (thème).
- Options facturation (préfixe, mentions).

### 3.12 Estimation (photo + IA)

- Upload d’une photo de chantier.
- Analyse IA (description, suggestions) pour aider à la création de devis.
- Quota d’utilisation IA.

### 3.13 Signature de devis

- Page publique `/sign-quote/:token` : le client signe électroniquement le devis ; mise à jour du statut (signé / accepté).

### 3.14 Formulaire client public

- Page `/client-form/:token` : formulaire de saisie client accessible par lien (sans être connecté).

---

## 4. État actuel et déploiement

### 4.1 Environnements

| Environnement | Branche Git | URL | Usage |
|---------------|-------------|-----|--------|
| **Production** | `main` | https://app.titanbtp.com | Utilisation réelle |
| **Preview / Staging** | `staging` | (URL Vercel Preview) | Tests avant prod |

- Déploiement automatique via **Vercel** (push sur `main` → prod, push sur `staging` → preview).

### 4.2 Points techniques importants

- **Envoi d’email (facture) en prod** : les en-têtes `Authorization` peuvent être supprimés par Vercel. Le client envoie le token dans le **body** (`accessToken`) ; le handler serverless `api/invoices/[id]/send-email.js` le remet dans les en-têtes avant d’appeler Express. Ne pas supprimer ce contournement sans vérifier que les en-têtes arrivent bien jusqu’au serveur.
- **CSP (Content-Security-Policy)** : `vercel.json` autorise `connect-src` vers Supabase (`https://*.supabase.co`, `wss://*.supabase.co`) et `data:` pour éviter les erreurs de connexion (ex. WebSocket Supabase, logos en data URI).
- **Reconnaissance vocale** : Web Speech API (navigateur), langue `fr-FR` ; nécessite HTTPS en prod (sauf localhost).

### 4.3 Variables d’environnement (résumé)

- **Supabase** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (serveur), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client).
- **Email** : `RESEND_API_KEY`, `SENDER_EMAIL`.
- **IA** : `OPENAI_API_KEY` et / ou `GEMINI_API_KEY`.
- **Admin** : `VITE_ADMIN_EMAIL` (ou `ADMIN_EMAIL`) pour les accès réservés admin.

---

## 5. Récapitulatif des fonctionnalités

| Module | Fonctionnalités principales |
|--------|-----------------------------|
| **Auth** | Connexion / inscription admin, invitation équipe + code |
| **Dashboard** | KPIs, graphiques, alertes, actions rapides |
| **Projets** | CRUD chantiers, images, devis, factures, équipe, vocale |
| **Planning** | Semaine / Liste / Mois, notes du jour, statuts |
| **Devis** | Création en 3 étapes, vocale + IA, PDF, email, signature |
| **Factures** | Liste, création, paiements, PDF, envoi email (body token en prod) |
| **CRM** | Kanban (Devis / À relancer / Terminé 5 derniers), envoi devis, relances |
| **Tarifs** | Gestion tarifs personnalisés / Artiprix |
| **Équipe** | Membres, invitations, permissions, affectations |
| **Clients** | Liste, CRUD, lien chantiers / factures |
| **Paramètres** | Entreprise, logo, thème, facturation |
| **Estimation** | Photo + IA pour aide à la création de devis |
| **Public** | Signature devis, formulaire client par lien |

---

**Dernière mise à jour** : Mars 2026
