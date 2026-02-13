  # Documentation Page Planning – TitanBtp

  **Document destiné à l'analyse fonctionnelle et technique**

  ---

  ## 1. Vue d'ensemble

  La **page Planning** est une page de gestion de chantiers proposant **deux modes d'affichage** : une **vue Liste** (par défaut) et une **vue Calendrier** mensuelle. Elle permet de visualiser les chantiers, de gérer leur statut et d'afficher les affectations d'équipe.

  | Élément | Détail |
  |--------|--------|
  | **Chemin principal** | `/dashboard/planning` |
  | **Chemin équipe** | `/team-dashboard/planning` |
  | **Composant principal** | `PlanningPage.tsx` |
  | **Titre affiché** | « Planning des Chantiers » |
  | **Sous-titre** | « Calendrier intégré pour organiser vos interventions » |
  | **Vue par défaut** | Liste |

  ---

  ## 2. Objectif et usage

  - Visualiser les chantiers du mois (vue Liste) ou sur une grille calendaire (vue Calendrier)
  - Basculer entre vue Liste et vue Calendrier via un toggle
  - Changer rapidement le statut d'un chantier (planifié / en cours / terminé)
  - Modifier un chantier via une boîte de dialogue
  - Voir les membres d'équipe affectés à chaque chantier
  - Naviguer par mois avec un sélecteur de période
  - Créer un chantier depuis l'état vide (admin)

  ---

  ## 3. Structure de l'interface

  ### 3.1 En-tête

  - Titre « Planning des Chantiers »
  - Bouton de compte utilisateur (`UserAccountButton`)

  ### 3.2 Barre de contrôle

  - Boutons « mois précédent » et « mois suivant »
  - Affichage du mois et de l'année en cours
  - Popover pour choisir directement un mois (grille 12 mois)
  - **Toggle vue** : boutons [Liste] et [Calendrier] – la vue active est en bleu
  - Bouton « Aujourd'hui » pour revenir au mois courant

  ### 3.3 Vue Liste (PlanningListView)

  Affiche les chantiers du mois sous forme de **cartes** avec :

  - **En-tête** : « CHANTIERS DE {MOIS} {ANNÉE} (N chantiers) »
  - Pour chaque chantier :
    - Icône type + nom du chantier
    - Badge statut coloré (Planifié / En cours / Terminé) avec icône (⏳ / 🔄 / ✅)
    - Dates formatées : « Lun 4 - Jeu 7 février 2026 (4 jours) »
    - Client : nom du client
    - Montant devis : format EUR TTC si présent
    - Membres d'équipe : nom + rôle en badges (ex. « Marc - Chef »)
    - Notes : 1–2 lignes max avec ellipsis
    - Boutons : [Modifier le chantier] et [Changer statut] (dropdown)
  - **État vide** : « Aucun chantier en {mois} {année}. » + lien « Créer un chantier » (admin)

  ### 3.4 Vue Calendrier (PlanningCalendarView)

  - **Grille** : 7 colonnes (Dim à Sam), environ 6 semaines
  - Pour chaque jour :
    - Numéro du jour
    - Blocs représentant les chantiers (nom, indicateurs ▶ début / ◀ fin, équipe)
    - Mise en évidence du jour courant (fond bleu, bordure)
    - Jours hors mois affichés en grisé
  - **Légende** : badges Planifié (bleu), En cours (jaune), Terminé (vert)

  ---

  ## 4. Données affichées

  ### 4.1 Entité Chantier

  | Champ | Type | Description |
  |-------|------|-------------|
  | `id` | string | Identifiant unique |
  | `nom` | string | Nom du chantier |
  | `clientId` | string | ID du client |
  | `clientName` | string | Nom du client |
  | `dateDebut` | string | Date de début (format ISO/YYYY-MM-DD) |
  | `duree` | string | Durée (ex. : "2 semaines", "1 mois", "15 jours") |
  | `statut` | enum | `planifié` \| `en cours` \| `terminé` |
  | `typeChantier` | string | Type (piscine, paysage, menuiserie, etc.) |
  | `notes` | string | Description du projet |
  | `notesAvancement` | string | Notes sur l'avancement |
  | `images` | string[] | URLs des images |
  | `montantDevis` | number | Montant du devis (TTC) |

  ### 4.2 Types de chantiers et icônes

  | Type | Libellé | Icône |
  |------|---------|-------|
  | renovation | Rénovation | 🏠 |
  | piscine | Piscine & Spa | 🏊 |
  | menuiserie | Menuiserie Sur-Mesure | 🪟 |
  | paysage | Aménagement Paysager | 🌳 |
  | plomberie | Plomberie | 🚿 |
  | maconnerie | Maçonnerie | 🧱 |
  | electricite | Électricité | ⚡ |
  | peinture | Peinture & Revêtements | 🎨 |
  | chauffage | Chauffage & Climatisation | ☀️ |
  | isolation | Isolation de la charpente | 🧊 |
  | terrasse | Terrasse & Patio | 🪵 |
  | autre | Autre | 📋 |

  ### 4.3 Badges statut (couleurs)

  - **Planifié** : bleu (#3B82F6), icône ⏳
  - **En cours** : ambre (#FBBF24), icône 🔄
  - **Terminé** : vert (#10B981), icône ✅

  ### 4.4 Affectations équipe (TeamMember)

  - Pour chaque chantier, la page charge les membres assignés via `fetchChantierAssignmentsByChantier`
  - Chaque membre affiche : `nom` + `role` (ex. « Marc - Chef de chantier »)

  ---

  ## 5. Interactions utilisateur

  ### 5.1 Toggle vue

  - Clic sur [Liste] → affiche `PlanningListView`
  - Clic sur [Calendrier] → affiche `PlanningCalendarView`

  ### 5.2 Vue Liste

  - **Modifier le chantier** : ouvre `ChantierEditDialog`
  - **Changer statut** : menu déroulant (Planifié / En cours / Terminé) avec mise à jour immédiate
  - **Créer un chantier** (état vide) : redirection vers `/dashboard/projects?openDialog=true`

  ### 5.3 Vue Calendrier

  - Clic sur un bloc chantier : menu contextuel avec changement de statut + modifier le chantier
  - Maximum 2 chantiers affichés par jour ; au-delà : « +N autre(s) »

  ### 5.4 Navigation

  - Mois précédent / suivant
  - Bouton « Aujourd'hui »
  - Popover : choix année (2020–2030) puis mois

  ---

  ## 6. Logique métier

  ### 6.1 Calcul de la date de fin

  La date de fin est calculée à partir de `dateDebut` et `duree` (voir `planningUtils.ts`) :

  - Formats reconnus : « X semaine(s) », « X sem », « X mois », « X jour(s) », « X j », ou un nombre seul (jours)
  - Pour les mois : approximation à 30 jours

  ### 6.2 Filtrage des chantiers par jour

  Un chantier est affiché pour un jour donné si :

  ```
  jour ≥ date_de_début ET jour ≤ date_de_fin
  ```

  ### 6.3 Chantiers « du mois »

  Un chantier est inclus s'il :

  - Commence dans le mois affiché, ou
  - Se termine dans le mois affiché, ou
  - Chevauche le mois

  ---

  ## 7. Architecture des composants

  ```
  PlanningPage.tsx
      │
      ├── planningUtils.ts (parseLocalDate, calculateEndDate, getDaysInMonth, constantes)
      │
      ├── viewMode: 'list' | 'calendar' (état)
      │
      ├── viewMode === 'list'
      │       └── PlanningListView.tsx
      │
      └── viewMode === 'calendar'
              └── PlanningCalendarView.tsx (grille + légende)
  ```

  ---

  ## 8. Fichiers sources

  | Fichier | Rôle |
  |---------|------|
  | `client/src/pages/PlanningPage.tsx` | Page principale, toggle, orchestration |
  | `client/src/components/PlanningListView.tsx` | Vue liste (cartes chantiers) |
  | `client/src/components/PlanningCalendarView.tsx` | Vue calendrier (grille + légende) |
  | `client/src/lib/planningUtils.ts` | Utilitaires dates, constantes, icônes |

  ### État local (PlanningPage)

  - `currentDate`, `viewMode`, `editingChantier`, `updatingChantierId`
  - `periodPickerOpen`, `pickerYear`
  - `assignmentsByChantierId`, `assignmentsRefreshKey`

  ---

  ## 9. Dépendances techniques

  ### 9.1 Contextes

  - `ChantiersContext` : `chantiers`, `updateChantier`

  ### 9.2 API Supabase

  - `fetchChantierAssignmentsByChantier(chantierId)` : récupère les membres assignés

  ### 9.3 Composants UI

  - `PageWrapper`, `Card`, `CardHeader`, `CardContent`, `CardTitle`, `Button`
  - `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuSeparator`
  - `Popover`, `PopoverTrigger`, `PopoverContent`
  - `ChantierEditDialog`

  ### 9.4 Notifications

  - `toast` : confirmation ou erreur lors du changement de statut

  ---

  ## 10. Flux de données

  ```
  ChantiersContext (chantiers)
          │
          ▼
  PlanningPage
          │
          ├── chantiersInMonth → chantiers qui chevauchent le mois
          ├── chantiersInView → union (chantiersInMonth + grille) pour charger les affectations
          │
          ├── viewMode === 'list'
          │       └── PlanningListView (chantiers, currentDate, assignmentsByChantierId)
          │
          └── viewMode === 'calendar'
                  └── PlanningCalendarView (days, getChantiersForDay, assignmentsByChantierId)
  ```

  ---

  ## 11. Permissions et accès

  - **Admin** : accès via `/dashboard/planning`, peut créer un chantier depuis l'état vide
  - **Membre équipe** : accès via `/team-dashboard/planning`
    - `can_view_planning` : droit de voir le planning
    - `can_manage_planning` : droit de gérer (modifier statuts, etc.)

  ---

  ## 12. Points d'attention pour l'analyse

  1. **Vue par défaut** : la vue Liste est affichée par défaut au chargement.
  2. **Interprétation de la durée** : approximation (mois ≈ 30 jours) ; pour des durées précises, une date de fin en base serait plus fiable.
  3. **Limite d'affichage grille** : 2 chantiers par jour ; surplus indiqué par « +N autre(s) ».
  4. **Mise à jour des affectations** : rechargées à la fermeture de `ChantierEditDialog` (via `assignmentsRefreshKey`).
  5. **Prise en compte des fuseaux horaires** : `parseLocalDate` utilise le format local pour éviter les décalages UTC.
  6. **Responsive** : en mobile, la vue Liste empile les champs verticalement ; boutons en colonne.

  ---

  *Document mis à jour pour l'analyse fonctionnelle de la page Planning – TitanBtp*
