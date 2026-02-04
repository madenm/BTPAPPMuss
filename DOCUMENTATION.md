# Documentation Complète - Aos Renov

## Vue d'ensemble

Aos Renov est une application web complète de gestion de chantiers, devis et factures pour les entreprises de rénovation et d'aménagement. L'application permet de gérer les clients, les projets, les devis, les factures, les paiements, l'équipe, et offre un système d'invitation pour les membres d'équipe avec accès restreint. Elle inclut également un CRM Pipeline pour suivre les prospects et automatiser les relances.

## Architecture Technique

### Stack Technologique

- **Frontend** : React 18 + TypeScript + Vite
- **Styling** : Tailwind CSS avec design glassmorphism
- **Animations** : Framer Motion
- **Routing** : Wouter (routing léger)
- **Backend** : Express.js (Node.js)
- **Base de données** : Supabase (PostgreSQL)
- **Stockage** : Supabase Storage
- **PDF** : jsPDF + jspdf-autotable
- **Graphiques** : Recharts (AreaChart, LineChart)
- **IA** : OpenAI API (optionnel) ou Google Gemini API
- **Email** : Resend (prioritaire) ou Brevo
- **Reconnaissance vocale** : Web Speech API (natif)

### Structure du Projet

```
Aos-Renov-main/
├── client/                    # Application React frontend
│   ├── src/
│   │   ├── components/        # Composants réutilisables
│   │   │   ├── ui/           # Composants UI (shadcn/ui)
│   │   │   ├── VoiceInputButton.tsx  # Reconnaissance vocale
│   │   │   ├── ChantierEditDialog.tsx
│   │   │   ├── CRMPipeline.tsx        # Pipeline CRM Kanban
│   │   │   ├── InvoiceDialog.tsx      # Création/édition facture
│   │   │   ├── InvoiceDetailDialog.tsx # Détails facture
│   │   │   ├── PaymentDialog.tsx      # Enregistrement paiement
│   │   │   ├── QuotePreview.tsx      # Prévisualisation devis
│   │   │   └── ...
│   │   ├── context/          # Contextes React (état global)
│   │   │   ├── AuthContext.tsx      # Authentification
│   │   │   ├── ChantiersContext.tsx  # Gestion chantiers/clients
│   │   │   └── UserSettingsContext.tsx  # Paramètres utilisateur
│   │   ├── pages/            # Pages de l'application
│   │   │   ├── Dashboard.tsx         # Dashboard principal
│   │   │   ├── QuotesPage.tsx        # Générateur de devis
│   │   │   ├── ProjectsPage.tsx      # Mes chantiers
│   │   │   ├── PlanningPage.tsx      # Planning
│   │   │   ├── ClientsPage.tsx       # Gestion clients
│   │   │   ├── InvoicesPage.tsx      # Liste factures
│   │   │   ├── CRMPipelinePage.tsx   # CRM Pipeline
│   │   │   ├── TeamPage.tsx          # Gestion équipe
│   │   │   ├── TeamDashboard.tsx     # Dashboard membre équipe
│   │   │   ├── SettingsPage.tsx      # Paramètres
│   │   │   ├── InvitePage.tsx        # Page d'invitation
│   │   │   └── ...
│   │   ├── hooks/            # Hooks personnalisés
│   │   │   ├── useDashboardMetrics.ts  # Métriques dashboard
│   │   │   └── ...
│   │   ├── lib/              # Utilitaires et API
│   │   │   ├── supabase.ts           # API Supabase (équipe, invitations)
│   │   │   ├── supabaseChantiers.ts  # API chantiers
│   │   │   ├── supabaseClients.ts    # API clients
│   │   │   ├── supabaseQuotes.ts     # API devis
│   │   │   ├── supabaseInvoices.ts   # API factures
│   │   │   ├── supabaseRevenues.ts   # Calcul revenus
│   │   │   ├── supabaseProspects.ts  # API prospects CRM
│   │   │   ├── quotePdf.ts           # Génération PDF devis
│   │   │   ├── invoicePdf.ts         # Génération PDF facture
│   │   │   └── ...
│   │   └── App.tsx           # Point d'entrée + routing
│   └── index.html
├── server/                    # Serveur Express backend
│   ├── routes.ts             # Routes API (analyse IA, emails)
│   ├── index.ts              # Serveur Express
│   └── ...
├── supabase_*.sql            # Scripts SQL de migration
└── package.json
```

## Fonctionnalités Principales

### 1. Authentification et Gestion des Utilisateurs

#### Authentification Admin
- **Page de connexion** (`/login`) : Connexion avec email/mot de passe via Supabase Auth
- **Page d'inscription** (`/auth`) : Création de compte avec profil utilisateur
- **Protection des routes** : Routes protégées `/dashboard/*` nécessitent authentification
- **Contexte d'authentification** : `AuthContext` gère l'état de session et utilisateur
- **Gestion de session** : Redirection automatique si non authentifié

#### Système d'Invitation Équipe
- **Création d'invitation** : Génération de lien d'invitation unique avec token
- **Page d'invitation** (`/invite/:token`) : Page publique pour rejoindre l'équipe
- **Code de connexion** : Code visible et modifiable dans le modal d'invitation
- **Vérification du code** : Fonction Postgres `verify_invite_code` (SECURITY DEFINER) pour vérifier le code sans être bloqué par RLS
- **Session équipe** : Stockage du membre d'équipe dans localStorage (pas de session Supabase)
- **Dashboard équipe** : Interface dédiée pour les membres (`/team-dashboard`)

### 2. Gestion des Chantiers

#### Création et Édition
- **Page Mes Chantiers** (`/dashboard/projects`) : Liste de tous les chantiers avec filtres
- **Formulaire de création** : Nom, client, dates, durée, type, statut, images
- **Champs de description** :
  - **Description du projet** (`notes`) : Utilisée pour préremplir les devis
  - **Notes sur l'avancement** (`notes_avancement`) : Suivi de l'avancement
- **Reconnaissance vocale** : Bouton micro à côté des champs de description pour dicter au lieu de taper
- **Upload d'images** : Stockage dans Supabase Storage avec prévisualisation et galerie
- **Montant devis** : Affichage du prix final (TTC) sur la fiche chantier
- **Affectation équipe** : Sélection des membres assignés via checkboxes

#### Gestion des Devis Associés
- **Affichage des devis** : Liste de tous les devis associés au chantier
- **Statut du devis** : Affichage du statut du dernier devis (brouillon, envoyé, accepté, refusé, expiré, validé)
- **Marquer comme validé** : Bouton pour marquer un devis comme "validé" (ne compte plus dans les devis en attente)
- **Suppression de devis** : Possibilité de supprimer les devis en trop avec confirmation
- **Avertissement multiples devis** : Message si plusieurs devis existent pour un chantier
- **Prévisualisation** : Bouton pour prévisualiser le devis en PDF
- **Modification** : Bouton pour modifier le devis (ouvre le générateur)
- **Création de facture** : Bouton pour créer une facture depuis un devis accepté ou validé

#### Types de Chantiers
- Piscine & Spa
- Aménagement Paysager
- Menuiserie Sur-Mesure
- Rénovation
- Autre

#### Statuts
- Planifié
- En cours
- Terminé

### 3. Gestion des Clients

#### Fonctionnalités
- **Page Clients** (`/dashboard/clients`) : Liste complète des clients avec recherche
- **Création/édition** : Nom, email, téléphone, adresse
- **Attribution de chantiers** :
  - Bouton "Ajouter un chantier" : Redirige vers Mes Chantiers avec client présélectionné
  - Bouton "Attribuer un chantier existant" : Dialogue pour réaffecter un chantier non attribué
- **Vue détaillée** : Affichage des chantiers associés et possibilité de créer une facture depuis la fiche client

### 4. Générateur de Devis

#### Workflow en 3 Étapes

**Étape 1 : Informations Client**
- Sélection ou création d'un client
- Informations client (nom, email, téléphone, adresse)
- Sélection d'un chantier existant (optionnel)

**Étape 2 : Description du Projet**
- Type de projet (piscine, paysage, menuiserie, rénovation, autre)
- **Description détaillée** : Champ texte avec **reconnaissance vocale** (bouton micro)
- Préremplissage automatique depuis la description du chantier si un chantier est sélectionné
- Durée de validité du devis
- L'analyse IA se déclenche automatiquement lors du passage à l'étape 3

**Étape 3 : Détail du Devis**
- Lignes de travaux avec description, quantité, unité, prix unitaire HT
- Sous-lignes pour détailler les lots
- Calcul automatique : Total HT, TVA (20%), Total TTC
- Auto-sauvegarde lors des modifications (débounce 2 secondes)
- Bouton "Télécharger le devis en PDF"
- Bouton "Prévisualiser le devis" pour voir le rendu avant téléchargement
- Message de chargement : "Votre devis est en train d'être généré, veuillez patienter."

#### Analyse IA Automatique
- **Avec clé OpenAI/Gemini** : Analyse détaillée avec lots, sous-lignes, quantités estimées
- **Sans clé** : Préremplissage par règles (détection quantités m², jours, etc.)
- L'analyse se déclenche automatiquement lors du passage à l'étape 3 (plus de bouton "Analyser avec l'IA")
- Indicateur de chargement discret pendant l'analyse

#### Modification de Devis Existant
- Depuis Mes Chantiers : Bouton "Modifier le devis" ouvre le générateur à l'étape 3
- Préremplissage avec les données sauvegardées
- Synchronisation du total TTC avec le chantier
- Mise à jour du statut si nécessaire

#### Statuts de Devis
- **Brouillon** : Devis en cours de création
- **Envoyé** : Devis envoyé au client
- **Accepté** : Devis accepté par le client
- **Refusé** : Devis refusé par le client
- **Expiré** : Devis expiré (après la durée de validité)
- **Validé** : Devis validé manuellement (ne compte plus dans "Devis en attente")

### 5. Système de Facturation Complet

#### Page Factures (`/dashboard/invoices`)
- **Liste des factures** : Tableau avec toutes les factures
- **Filtres** :
  - Par client
  - Par chantier
  - Par statut (Brouillon, En attente de paiement, Payée, Partiellement payée, Annulée)
  - Par année
- **Recherche** : Recherche par numéro de facture
- **Affichage** :
  - Numéro de facture (avec icône)
  - Date (avec icône calendrier)
  - Client (avec icône utilisateur)
  - Chantier associé
  - Montant TTC (avec icône euro, formatage monétaire)
  - Payé / Restant (barre de progression visuelle avec pourcentage)
  - Statut (badge coloré avec icône)
  - Actions (Voir/Modifier)

#### Création de Facture
- **Depuis un devis** : Bouton "Créer une facture depuis ce devis" sur la page devis ou chantier
- **Depuis un chantier** : Bouton "Créer une facture" sur la fiche chantier
- **Depuis un client** : Bouton "Créer une facture" sur la fiche client
- **Formulaire** :
  - Sélection client et chantier
  - Date de facture
  - Date d'échéance
  - Lignes de facturation (description, quantité, prix unitaire HT)
  - Calcul automatique : Total HT, TVA (20%), Total TTC
  - Notes (optionnel)

#### Numérotation Automatique
- **Format** : `YYYYNNNNNNN` (ex: 2026000001)
- **Fonction RPC** : `generate_invoice_number()` pour générer un numéro unique
- **Incrémentation** : Automatique par année

#### Statuts de Facture
- **Brouillon** : Facture en cours de création
- **Envoyée** (affiché "En attente de paiement") : Facture envoyée au client
- **Payée** : Facture entièrement payée
- **Partiellement payée** : Facture partiellement payée (avec tolérance de 0.01€)
- **Annulée** : Facture annulée

#### Calcul du Statut
- **Logique robuste** : Calcul automatique basé sur les paiements enregistrés
- **Tolérance** : 0.01€ pour gérer les arrondis
- **Recalcul** : À chaque enregistrement/suppression de paiement
- **Fonction helper** : `calculateInvoiceStatus()` pour garantir la cohérence

#### Enregistrement des Paiements
- **Dialogue de paiement** : Accessible depuis la fiche facture
- **Champs** :
  - Date de paiement
  - Montant payé
  - Méthode de paiement (optionnel)
  - Notes (optionnel)
- **Bouton "Montant total"** : Remplit automatiquement le montant restant à payer
- **Validation** : Vérifie que le montant ne dépasse pas le reste à payer
- **Mise à jour automatique** : Le statut de la facture est recalculé après chaque paiement

#### PDF Facture
- **Génération client-side** : Utilise jsPDF + jspdf-autotable
- **Contenu** :
  - En-tête avec logo, nom entreprise, coordonnées
  - Informations facture (numéro, dates, client)
  - Tableau des lignes (description, quantité, prix unitaire, total)
  - Totaux (HT, TVA, TTC)
  - Paiements enregistrés (si présents)
  - Reste à payer
  - Notes
- **Téléchargement** : Bouton "Télécharger en PDF"

#### Envoi par Email
- **Bouton "Envoyer par email"** : Sur la fiche facture
- **Contenu email** :
  - PDF en pièce jointe
  - Corps HTML avec détails complets de la facture
  - Bloc de contact avec coordonnées de l'utilisateur
- **Intégration** : Resend ou Brevo selon configuration

### 6. CRM Pipeline

#### Vue Kanban (`/dashboard/crm`)
- **Colonnes** :
  - Tous les prospects
  - Envoi du devis
  - Relance devis 1
  - Relance devis 2
  - Envoi de la facture
  - Relance facture 1
  - Relance facture 2
- **Drag & Drop** : Déplacement des prospects entre colonnes
- **Création de prospect** : Formulaire avec nom, email, téléphone, entreprise, notes

#### Envoi de Devis
- **Modal d'envoi** : Clic sur "Envoyer le devis" dans la colonne "Envoi du devis"
- **Sélection du devis** :
  - Liste déroulante avec tous les devis
  - Pré-sélection automatique du devis correspondant au prospect (même email)
  - Possibilité d'uploader un PDF manuellement
- **Envoi** :
  - PDF en pièce jointe
  - Corps HTML avec détails complets du devis (lignes, totaux)
  - Bloc de contact avec coordonnées de l'utilisateur
  - Mise à jour automatique du stage du prospect vers "quote"

#### Envoi de Facture
- **Modal d'envoi** : Clic sur "Envoyer la facture" dans la colonne "Envoi de la facture"
- **Sélection de la facture** : Liste déroulante avec toutes les factures
- **Envoi** :
  - PDF en pièce jointe
  - Corps HTML avec détails complets de la facture
  - Bloc de contact avec coordonnées de l'utilisateur
  - Mise à jour automatique du stage du prospect vers "invoice"

#### Relances Automatiques
- **Relances devis** : 2 relances possibles (relance 1 et relance 2)
- **Relances facture** : 2 relances possibles (relance 1 et relance 2)
- **Messages par défaut** :
  - Relance devis : "Bonjour, je souhaite faire un suivi concernant notre échange précédent et le devis que je vous ai transmis..."
  - Relance facture : "Bonjour, je souhaite faire un suivi concernant la facture que je vous ai transmise..."
- **Personnalisation** : Messages modifiables avant envoi
- **Envoi** :
  - Corps HTML avec message personnalisé
  - Bloc de contact avec coordonnées de l'utilisateur
  - Mise à jour automatique du stage du prospect
- **Envoi manuel** : Possibilité d'envoyer une relance manuellement depuis n'importe quelle colonne

#### Configuration Email
- **Service** : Resend (prioritaire) ou Brevo (fallback)
- **Variable d'environnement** : `RESEND_TEST_EMAIL` pour rediriger tous les emails de test vers une adresse
- **Expéditeur** : Configuré dans les variables d'environnement
- **Bloc de contact** : Ajouté automatiquement à tous les emails (devis, factures, relances)

### 7. Planning des Chantiers

#### Vue Calendrier
- **Page Planning** (`/dashboard/planning`) : Calendrier mensuel avec vue grille
- **Affichage des chantiers** : Chantiers affichés sur les jours de leur période (début + durée)
- **Affectations équipe** : Affichage des membres d'équipe assignés à chaque chantier
- **Changement de statut** : Menu déroulant pour changer le statut directement depuis le calendrier
- **Navigation** : Mois précédent/suivant, sélection rapide de mois/année, bouton "Aujourd'hui"
- **Liste du mois** : Section "Chantiers du mois" avec détails et affectations équipe

#### Planning Membre d'Équipe
- **Vue simplifiée** (`/team-dashboard/planning`) : Calendrier en lecture seule
- **Chantiers filtrés** : Affiche uniquement les chantiers assignés au membre
- **Navigation mois** : Précédent/suivant, "Aujourd'hui"
- **Légende** : Planifié (bleu), En cours (jaune), Terminé (vert)

### 8. Gestion d'Équipe

#### Page Gestion Équipe (`/dashboard/team`)
- **Liste des membres** : Nom, rôle, email, téléphone, code de connexion, statut
- **Ajout de membre** : Formulaire avec génération automatique de lien d'invitation
- **Édition** : Modification des informations et affectation aux chantiers
- **Suppression** : Suppression d'un membre avec confirmation
- **Génération de lien d'invitation** : Bouton "Partager" sur chaque membre pour obtenir un nouveau lien
- **Modification du code de connexion** : Dans le modal d'invitation, le code est affiché et modifiable

#### Affectation aux Chantiers
- **Depuis la fiche chantier** : Sélection des membres assignés via checkboxes
- **Depuis la page Équipe** : Édition d'un membre permet de sélectionner ses chantiers
- **Table de liaison** : `chantier_assignments` (chantier_id, team_member_id)

#### Rôles Disponibles
- Chef de chantier
- Ouvrier
- Commercial
- Assistant
- Autre

### 9. Dashboard Membre d'Équipe

#### Accès
- **Route** : `/team-dashboard` (protégée par `ProtectedTeamRoute`)
- **Authentification** : Via lien d'invitation + code de connexion (pas de compte Supabase)

#### Onglets

**Vue d'ensemble**
- Statistiques : Nombre de chantiers actifs, en cours, planifiés
- Liste des chantiers récents (5 premiers)

**Mes Chantiers** (`/team-dashboard/projects`)
- Grille de cartes avec tous les chantiers assignés (y compris terminés)
- Informations : Nom, client, dates, durée, images, statut
- Badge de statut coloré

**Planning** (`/team-dashboard/planning`)
- Calendrier simplifié avec uniquement les chantiers assignés
- Navigation mois, légende des statuts

#### Chargement des Données
- **RPC Supabase** : `get_chantiers_for_team_member(team_member_id)` (SECURITY DEFINER)
- **Filtrage automatique** : Seuls les chantiers assignés sont chargés
- **Rafraîchissement** : Au montage du dashboard et après modifications

### 10. Dashboard Principal

#### Métriques Clés

**Chiffre d'Affaires**
- **Calcul** : Somme des paiements enregistrés (table `payments`)
- **Affichage** : Format monétaire EUR
- **Indicateur** : "Paiements enregistrés" / "Aucun paiement enregistré"

**Chantiers Actifs**
- **Calcul** : Nombre de chantiers avec statut "en cours" ou "planifié"
- **Affichage** : Nombre total

**Devis en Attente**
- **Calcul** : Nombre distinct de chantiers ayant au moins un devis avec statut "envoyé" ou "brouillon", plus les devis sans chantier associé
- **Exclusion** : Les devis avec statut "validé" ne sont pas comptés
- **Affichage** : Nombre total

**Taux de Conversion**
- **Calcul** : (Factures envoyées / Devis envoyés) × 100
- **Factures envoyées** : Factures avec statut "envoyée", "payée", ou "partiellement_payée"
- **Devis envoyés** : Devis avec statut "envoyé"
- **Affichage** : Pourcentage avec indicateur "Factures envoyées / devis envoyés"

#### Graphiques

**Évolution des Revenus**
- **Type** : AreaChart (Recharts)
- **Période** : 12 derniers mois
- **Données** : Revenus par mois (somme des paiements)
- **Affichage** : Même si aucun paiement, affiche 0 pour tous les mois
- **Y-Axis** :
  - Marge en haut : 20% au-dessus du maximum des données
  - Formatage : Valeurs >= 1000 affichées avec "k" (ex: 1k, 2k), valeurs < 1000 arrondies
  - Valeurs arrondies : Maximum arrondi à la magnitude supérieure (ex: 1234 → 2000)

**Évolution du Taux de Conversion**
- **Type** : LineChart (Recharts)
- **Période** : 4 dernières semaines
- **Calcul** : Pour chaque semaine, (factures envoyées / devis envoyés) × 100
- **Affichage** : Pourcentage par semaine

### 11. Reconnaissance Vocale

#### Composant VoiceInputButton
- **Fichier** : `client/src/components/VoiceInputButton.tsx`
- **Technologie** : Web Speech API (natif, gratuit)
- **Langue** : Français (`fr-FR`)
- **Compatibilité** : Chrome, Edge, Safari (iOS 14.5+)

#### Utilisation
- **Champs équipés** :
  - Description du projet (QuotesPage, ChantierEditDialog, ProjectsPage)
  - Notes sur l'avancement (ChantierEditDialog, ProjectsPage)
- **Fonctionnement** :
  - Bouton micro à côté du Textarea
  - Clic → démarre l'écoute (icône rouge)
  - Transcription en temps réel → texte ajouté automatiquement
  - Clic à nouveau → arrête l'écoute
- **Gestion d'erreurs** : Messages d'erreur contextuels (permission refusée, réseau, etc.)

### 12. Paramètres Utilisateur

#### Page Paramètres (`/dashboard/settings`)
- **Coordonnées Entreprise** :
  - Adresse (rue et numéro)
  - Ville et Code Postal
  - Téléphone
  - Email
  - Numéro SIRET
- **Logo** : Upload et affichage dans les devis/factures PDF
- **Couleur de thème** : Personnalisation de la couleur d'accent

#### Utilisation dans les Documents
- **En-tête PDF** : Nom de l'entreprise, adresse, téléphone, email, SIRET
- **Pied de page** : Coordonnées complètes
- **Emails** : Bloc de contact avec toutes les coordonnées à la fin de chaque email

### 13. Emails avec Signature

#### Bloc de Contact
- **Fonction** : `buildContactBlockHtml()` dans `quotePdf.ts`
- **Contenu** :
  - Nom et prénom de l'utilisateur
  - Téléphone
  - Email
  - Adresse complète (rue, ville, code postal)
- **Phrase d'introduction** : "Pour me joindre :" (au lieu de "Veuillez me recontacter :")
- **Intégration** : Ajouté automatiquement à tous les emails (devis, factures, relances)

## Structure de la Base de Données

### Tables Principales

#### `user_profiles`
- Informations utilisateur (email, nom, logo, couleur thème)
- Coordonnées entreprise (adresse, ville, code postal, téléphone, email, SIRET)
- Liaison avec `auth.users` via `user_id`

#### `clients`
- Informations clients (nom, email, téléphone, adresse)
- Liaison avec `user_id`

#### `chantiers`
- Informations chantiers (nom, client_id, dates, durée, statut, type)
- Champs texte : `notes` (description), `notes_avancement`
- Montant : `montant_devis` (prix final TTC)
- Images : Tableau d'URLs (Supabase Storage)
- Liaison avec `user_id`

#### `quotes`
- Devis sauvegardés
- Colonnes : description, lignes (JSON), total HT, TVA, total TTC, status, client_email, client_name, validity_days
- Liaison avec `chantier_id` (optionnel)
- Liaison avec `user_id`
- Statuts : brouillon, envoyé, accepté, refusé, expiré, validé

#### `invoices`
- Factures
- Colonnes : invoice_number (unique), client_id, chantier_id, invoice_date, due_date, total_ht, tva_rate, total_ttc, status, notes, quote_id (optionnel)
- Liaison avec `user_id`
- Statuts : brouillon, envoyée, payée, partiellement_payée, annulée

#### `payments`
- Paiements enregistrés
- Colonnes : invoice_id, payment_date, amount, payment_method, notes
- Liaison avec `user_id` (via invoice)
- Soft delete : `deleted_at`

#### `prospects`
- Prospects CRM
- Colonnes : name, email, phone, company, notes, stage
- Liaison avec `user_id`
- Stages : all, quote, quote_followup1, quote_followup2, invoice, invoice_followup1, invoice_followup2, followup1, followup2, followup3, followup4

#### `team_members`
- Membres d'équipe (nom, rôle, email, téléphone, code de connexion, statut)
- Liaison avec `user_id` (propriétaire)

#### `team_invitations`
- Invitations (token unique, email, team_member_id, expires_at, used)
- Utilisé pour générer les liens d'invitation

#### `chantier_assignments`
- Table de liaison chantier ↔ membre équipe
- Colonnes : `chantier_id`, `team_member_id`

### Fonctions RPC

#### `generate_invoice_number()`
- Génère un numéro de facture unique au format `YYYYNNNNNNN`
- Incrémentation automatique par année
- SECURITY DEFINER

#### `verify_invite_code(token, login_code)`
- Vérifie le code de connexion d'une invitation
- Retourne les informations du membre d'équipe si valide
- SECURITY DEFINER (pour contourner RLS)

#### `get_chantiers_for_team_member(team_member_id)`
- Récupère tous les chantiers assignés à un membre d'équipe
- Inclut les informations client et affectations
- SECURITY DEFINER (pour contourner RLS)

## Scripts SQL à Exécuter

### 1. Colonnes chantiers (`supabase_chantiers_notes_type.sql`)
Ajoute les colonnes `notes`, `type_chantier`, `notes_avancement` à la table `chantiers`.

### 2. Coordonnées entreprise (`supabase_user_profiles_company.sql`)
Ajoute les colonnes `company_address`, `company_city`, `company_postal_code`, `company_phone`, `company_email`, `company_siret` à `user_profiles`.

### 3. Montant devis (`supabase_chantiers_montant_devis.sql`)
Ajoute la colonne `montant_devis` (numeric) à `chantiers`.

### 4. Vérification code invitation (`supabase_team_members_invite_rls.sql`)
Crée la fonction `verify_invite_code(token, login_code)` (SECURITY DEFINER) pour vérifier le code sans être bloqué par RLS.

### 5. Chantiers pour membre équipe (`supabase_get_chantiers_for_team_member.sql`)
Crée la fonction `get_chantiers_for_team_member(team_member_id)` (SECURITY DEFINER) pour récupérer les chantiers assignés à un membre.

### 6. Système de facturation (`supabase_invoices_tables.sql`)
Crée les tables `invoices` et `payments`, ainsi que la fonction `generate_invoice_number()` pour la numérotation automatique.

### 7. Statut validé pour devis (`supabase_quotes_status_valide.sql`)
Étend la contrainte CHECK sur `quotes.status` pour inclure le statut "validé".

### 8. Stages CRM (`supabase_prospects_stage_check.sql`)
Étend la contrainte CHECK sur `prospects.stage` pour inclure tous les stages du pipeline CRM (envoi devis/facture + relances).

### 9. Suppression de devis (`supabase_quotes_delete_all.sql`)
Script utilitaire pour supprimer tous les devis (à utiliser avec précaution).

## Configuration

### Variables d'Environnement

#### `.env` (racine du projet)
```env
# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role

# OpenAI (optionnel - pour analyse IA)
OPENAI_API_KEY=sk-...

# Google Gemini (optionnel - alternative à OpenAI)
GEMINI_API_KEY=...

# Email - Resend (prioritaire)
RESEND_API_KEY=re_...
RESEND_FROM=contact@votredomaine.fr
RESEND_TEST_EMAIL=votre-email@test.fr  # Pour rediriger tous les emails de test

# Email - Brevo (fallback si Resend non configuré)
BREVO_API_KEY=xkeysib-...
SENDER_EMAIL=votre-email@outlook.fr
```

#### `client/.env`
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

## Flux d'Authentification

### Admin
1. Inscription/Connexion via `/auth` ou `/login`
2. Authentification Supabase (email/password)
3. Création automatique du profil dans `user_profiles`
4. Redirection vers `/dashboard`
5. Routes protégées par `ProtectedRoute`

### Membre d'Équipe
1. Réception du lien d'invitation (`/invite/:token`)
2. Saisie du code de connexion
3. Vérification via `verify_invite_code()` (RPC Supabase)
4. Stockage du membre dans localStorage (`teamMember`, `userType: 'team'`)
5. Redirection vers `/team-dashboard`
6. Routes protégées par `ProtectedTeamRoute`
7. Chargement des chantiers via `get_chantiers_for_team_member()` (RPC)

## Flux de Données

### Chantiers
```
ChantiersContext (état global)
  ↓
fetchChantiersForUser() ou fetchChantiersForTeamMember()
  ↓
Supabase (table chantiers)
  ↓
Filtrage par affectations (si membre équipe)
  ↓
Affichage dans UI
```

### Devis
```
QuotesPage (formulaire)
  ↓
Analyse IA (optionnel) → /api/parse-quote-description
  ↓
Sauvegarde → insertQuote() / updateQuote()
  ↓
Supabase (table quotes)
  ↓
Génération PDF → downloadQuotePdf()
  ↓
Téléchargement ou envoi email
```

### Factures
```
InvoiceDialog (formulaire)
  ↓
Génération numéro → generate_invoice_number() (RPC)
  ↓
Sauvegarde → insertInvoice() / updateInvoice()
  ↓
Supabase (table invoices)
  ↓
Enregistrement paiement → insertPayment()
  ↓
Recalcul statut → calculateInvoiceStatus()
  ↓
Génération PDF → downloadInvoicePdf()
  ↓
Envoi email avec PDF
```

### Équipe
```
TeamPage
  ↓
createTeamMember() → Supabase (team_members)
  ↓
createTeamInvitation() → Supabase (team_invitations)
  ↓
Génération lien → /invite/:token
  ↓
InvitePage → verify_invite_code() (RPC)
  ↓
Stockage localStorage → TeamDashboard
```

### CRM Pipeline
```
CRMPipelinePage
  ↓
Drag & Drop → updateProspect()
  ↓
Envoi devis/facture → buildQuoteEmailHtml() / buildInvoiceEmailHtml()
  ↓
Ajout bloc contact → buildContactBlockHtml()
  ↓
Envoi email → /api/send-email (Resend/Brevo)
  ↓
Mise à jour stage → updateProspect()
```

## Sécurité

### Row Level Security (RLS)
- Les tables Supabase utilisent RLS pour filtrer par `user_id`
- Les membres d'équipe n'ont pas de `user_id` Supabase → utilisation de fonctions SECURITY DEFINER
- Les fonctions RPC sont marquées SECURITY DEFINER pour contourner RLS quand nécessaire

### Routes Protégées
- **Admin** : `ProtectedRoute` vérifie la session Supabase
- **Équipe** : `ProtectedTeamRoute` vérifie localStorage (`teamMember`, `userType`)

### Permissions
- Les membres d'équipe ne peuvent que **lire** leurs chantiers assignés (pas de modification)
- Les admins ont accès complet à tous les chantiers/clients/devis/factures

### Validation des Données
- **Paiements** : Vérification que le montant ne dépasse pas le reste à payer
- **Statuts** : Contraintes CHECK en base de données
- **Numéros de facture** : Unicité garantie par la fonction RPC

## Composants Réutilisables

### VoiceInputButton
- Reconnaissance vocale Web Speech API
- Props : `onTranscript`, `disabled`, `className`
- Gestion automatique des permissions et erreurs

### ChantierEditDialog
- Dialogue modal pour créer/éditer un chantier
- Upload d'images, sélection de client, affectation équipe
- Reconnaissance vocale intégrée pour description

### InvoiceDialog
- Dialogue modal pour créer/éditer une facture
- Sélection client/chantier, lignes de facturation
- Calcul automatique des totaux

### InvoiceDetailDialog
- Dialogue modal pour afficher les détails d'une facture
- Affichage des paiements, reste à payer
- Actions : Enregistrer paiement, Envoyer email, Télécharger PDF

### PaymentDialog
- Dialogue modal pour enregistrer un paiement
- Bouton "Montant total" pour remplir automatiquement le reste à payer
- Validation du montant

### QuotePreview
- Prévisualisation d'un devis avant téléchargement
- Affichage formaté avec toutes les informations

### ProtectedRoute / ProtectedTeamRoute
- HOCs pour protéger les routes selon le type d'utilisateur
- Redirection automatique si non authentifié

## Points d'Attention

### Compatibilité Navigateur
- **Reconnaissance vocale** : Chrome/Edge/Safari uniquement (pas Firefox)
- **HTTPS requis** : Pour la reconnaissance vocale en production (localhost HTTP accepté)

### Performance
- **Auto-sauvegarde devis** : Débounce de 2 secondes pour éviter trop de requêtes
- **Chargement chantiers** : Protection contre appels multiples (`loadingRef`)
- **Calculs dashboard** : Protection contre recalculs inutiles

### Limitations
- **Membres équipe** : Pas de session Supabase, données en localStorage uniquement
- **Images** : Stockées dans Supabase Storage (limite selon plan)
- **Emails de test** : Variable `RESEND_TEST_EMAIL` pour rediriger tous les emails vers une adresse de test

### Gestion des Erreurs
- **Contraintes CHECK** : Messages d'erreur spécifiques pour guider l'utilisateur vers les scripts SQL nécessaires
- **Fonctions RPC** : Vérification de l'existence avant appel
- **Floating point** : Tolérance de 0.01€ pour les comparaisons de montants

## Évolutions Futures Possibles

- Notifications en temps réel (WebSockets)
- Application mobile (React Native)
- Export Excel des données
- Intégration calendrier Google/Outlook
- Chat interne équipe
- Suivi temps de travail
- Rappels automatiques de paiement
- Statistiques avancées et rapports
- Multi-devises
- Templates de devis/factures personnalisables

---

**Dernière mise à jour** : Février 2026
