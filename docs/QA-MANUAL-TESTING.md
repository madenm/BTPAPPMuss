# Document QA – Tests manuels – TitanBtp

**Version :** 1.0  
**Date :** 2025-03-11  
**Objectif :** Permettre de tester manuellement toute l’application de façon structurée, avec des scénarios et cas de tests pour limiter les régressions et les bugs.

---

## 1. Introduction

Ce document décrit les **scénarios de test** et **cas de test** à exécuter manuellement sur l’application TitanBtp. Il couvre :

- Les parcours utilisateur principaux (auth, estimation, devis, projets, planning, CRM, factures, tarifs, équipe, paramètres).
- Les pages publiques (signature de devis, formulaire client, invitation).
- Les validations, erreurs et cas limites.

**Rôles à considérer :**

- **Utilisateur connecté** (dashboard `/dashboard/*`).
- **Équipe** (team dashboard `/team-dashboard/*`) si applicable.
- **Visiteur** (pages sans auth : signature devis, formulaire client, invite).

---

## 2. Périmètre et prérequis

### 2.1 Routes à tester

| Zone | Routes principales |
|------|--------------------|
| Publique | `/`, `/auth`, `/login`, `/loading`, `/invite/:token`, `/client-form/:token`, `/sign-quote/:token` |
| Dashboard | `/dashboard`, `/dashboard/estimation`, `/dashboard/projects`, `/dashboard/projects/:id`, `/dashboard/planning`, `/dashboard/crm`, `/dashboard/quotes`, `/dashboard/clients`, `/dashboard/invoices`, `/dashboard/tarifs`, `/dashboard/team`, `/dashboard/settings`, `/dashboard/create-user`, `/dashboard/ai-visualization`, `/dashboard/prospects` |
| Team | `/team-dashboard`, `/team-dashboard/projects`, `/team-dashboard/quotes`, `/team-dashboard/crm`, `/team-dashboard/invoices`, `/team-dashboard/team`, `/team-dashboard/clients`, `/team-dashboard/planning`, `/team-dashboard/ai-visualization` |

### 2.2 Prérequis

- Environnement de dev ou staging opérationnel (`npm run dev`, Supabase configuré).
- Compte utilisateur de test avec email vérifié.
- Données de test : au moins 1 client, 1 chantier, 1 devis (brouillon + signé si possible), 1 facture.
- Navigateur à jour (Chrome/Firefox/Edge). Tester aussi en responsive (mobile/tablette) pour les flux critiques.

---

## 3. Scénarios par domaine

### 3.1 Authentification

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| AUTH-01 | Connexion réussie | Aller sur `/auth`, saisir email + mot de passe valides, soumettre | Redirection vers `/dashboard`, pas d’erreur |
| AUTH-02 | Connexion avec identifiants invalides | Saisir email ou mot de passe incorrect | Message d’erreur, pas de redirection |
| AUTH-03 | Champs vides | Soumettre sans email ou sans mot de passe | Message d’erreur ou validation côté formulaire |
| AUTH-04 | Déconnexion | Cliquer sur le bouton compte utilisateur puis « Déconnexion » | Redirection vers `/` ou `/auth`, session fermée |
| AUTH-05 | Accès page protégée sans être connecté | Aller sur `/dashboard` ou `/dashboard/quotes` sans être connecté | Redirection vers login/auth |
| AUTH-06 | Rate limit (trop de tentatives) | Enchaîner plusieurs connexions échouées | Message du type « Trop de tentatives récentes » et blocage temporaire |
| AUTH-07 | Changement de mot de passe (si proposé) | Depuis le compte ou modal dédié : ancien mot de passe + nouveau + confirmation | Message de succès, reconnexion éventuelle |
| AUTH-08 | Lien de confirmation email (inscription) | Cliquer sur le lien reçu par email | Compte activé, possibilité de se connecter |

---

### 3.2 Accueil et navigation

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| NAV-01 | Accès à la home | Aller sur `/` | Page d’accueil s’affiche (landing ou redirection selon état auth) |
| NAV-02 | Menu latéral – tous les liens | Depuis le dashboard, cliquer sur chaque entrée du menu (Vue d’ensemble, Estimation, Projets, Planning, CRM, Devis, Tarifs, Factures, Équipe, Contacts, Paramètres) | Chaque page se charge sans erreur 404 ni crash |
| NAV-03 | Breadcrumb / retour | Depuis Détail projet, cliquer sur « Retour » ou lien « Mes Projets » | Retour à la liste des projets |
| NAV-04 | Page inexistante | Aller sur `/dashboard/inexistant` | Page 404 ou message « Page non trouvée » |

---

### 3.3 Contacts / Clients

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| CLI-01 | Liste des clients | Aller sur `/dashboard/clients` | Liste (ou vide) avec recherche/filtres si présents |
| CLI-02 | Création client – champs obligatoires | Ouvrir « Ajouter un client », remplir uniquement les champs obligatoires (nom, email, téléphone selon règles), enregistrer | Client créé, apparition dans la liste |
| CLI-03 | Création client – tous les champs | Remplir nom, email, téléphone, adresse, code postal, ville, enregistrer | Client créé avec toutes les infos |
| CLI-04 | Validation email invalide | Saisir un email sans @ ou domaine invalide | Message d’erreur, enregistrement bloqué |
| CLI-05 | Validation téléphone | Saisir un numéro non 06/07 ou format invalide | Message d’erreur type « Format 06/07… » |
| CLI-06 | Code postal 5 chiffres | Saisir un code postal avec moins ou plus de 5 chiffres | Erreur si validation côté formulaire |
| CLI-07 | Modification client | Ouvrir un client existant, modifier nom ou email, enregistrer | Modifications sauvegardées et visibles en liste |
| CLI-08 | Suppression client | Supprimer un client (avec confirmation si prévu) | Client retiré de la liste |
| CLI-09 | Recherche / filtre | Utiliser la recherche par nom ou filtre (actifs/terminés) | Résultats cohérents |
| CLI-10 | Lien formulaire client | Générer ou ouvrir un lien « formulaire client » (partagé), remplir et soumettre depuis un autre navigateur/session | Nouveau contact enregistré et visible dans Contacts |

---

### 3.4 Estimation automatique

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| EST-01 | Accès page estimation | Aller sur `/dashboard/estimation` | Page avec étapes (Photos, Questions, Résultats) |
| EST-02 | Upload photos | Ajouter une ou plusieurs photos de chantier | Photos affichées, pas d’erreur serveur |
| EST-03 | Choix du type de chantier | Sélectionner un type (ex. Peinture, Rénovation) | Questions spécifiques au type s’affichent |
| EST-04 | Questionnaire – champs obligatoires | Répondre aux questions obligatoires uniquement | Passage à l’étape suivante ou génération possible |
| EST-05 | Questionnaire – question optionnelle peinture | Pour type Peinture : remplir « Répartition des surfaces » (ex. 100 m² extérieur, 400 m² intérieur) | Valeur prise en compte si utilisée pour l’IA |
| EST-06 | Génération estimation IA | Avec photos + type + réponses, lancer l’estimation (bouton type « Générer ») | Résultat avec montant et détail (lignes avec unités si applicable) |
| EST-07 | Création devis depuis estimation | Après résultat, cliquer « Créer un devis » (ou équivalent) | Redirection vers Devis avec lignes pré-remplies, client pris en compte si sélectionné |
| EST-08 | Sélection client / nouveau client | Choisir un client existant OU saisir nom/email/téléphone sans cliquer « Ajouter » puis créer le devis | Devis créé avec les infos client correctes (nom, email, téléphone) |
| EST-09 | Bouton « Nouvelle estimation » | Cliquer sur « Nouvelle estimation » | Réinitialisation du flux (photos/questions effacées ou remises à zéro) |
| EST-10 | Quota IA / limite quotidienne | Dépasser la limite d’usage IA si configurée | Message explicite, pas de crash |

---

### 3.5 Devis

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| DEV-01 | Liste des devis | Aller sur `/dashboard/quotes` | Liste des devis avec statuts (brouillon, envoyé, signé, etc.) |
| DEV-02 | Nouveau devis vide | Créer un nouveau devis sans repartir d’une estimation | Formulaire avec au moins une ligne vide, client optionnel ou requis selon règles |
| DEV-03 | Sauvegarde devis – client sans email | Remplir nom client, pas d’email, au moins une ligne avec description et montant, sauvegarder | Sauvegarde réussie (email non bloquant si règle métier actuelle) |
| DEV-04 | Sauvegarde devis – champs obligatoires | Devis sans nom client ou sans ligne avec montant, tenter sauvegarde | Message d’erreur ou bouton désactivé |
| DEV-05 | Ajout / suppression de lignes | Ajouter plusieurs lignes, modifier quantité/PU, supprimer une ligne | Sous-total et total recalculés correctement |
| DEV-06 | Unités des lignes | Saisir ou sélectionner une unité (m², Forfait, U, etc.) pour chaque ligne | Unités conservées à la sauvegarde et sur le PDF |
| DEV-07 | Modèle conditions générales « Magasin » | Dans « Conditions générales / Notes », sélectionner le modèle « Magasin / local commercial » | Le textarea est remplacé par le texte type magasin (horaires, protection, acompte, etc.) |
| DEV-08 | Modèle « Défaut (profil) » | Sélectionner « Défaut (profil) » | Contenu remplacé par les conditions par défaut du profil |
| DEV-09 | Génération PDF | Sur un devis rempli, cliquer « Télécharger PDF » ou équivalent | PDF téléchargé, lisible, avec logo, totaux et conditions cohérents |
| DEV-10 | Création chantier depuis devis | Sur un devis (avec ou sans email client), cliquer « Créer un chantier pour ce devis » | Chantier créé, lié au client (recherche par nom si pas d’email), redirection vers détail chantier ou liste |
| DEV-11 | Chargement devis existant | Ouvrir un devis déjà sauvegardé (client avec nom mais email vide) | Email/téléphone complétés depuis la liste des clients si disponible |
| DEV-12 | Lien de signature | Copier/envoyer le lien de signature du devis, ouvrir en navigation privée | Page signature s’affiche (voir section 3.12) |

---

### 3.6 Projets / Chantiers

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| PROJ-01 | Liste des projets | Aller sur `/dashboard/projects` | Cartes ou liste des chantiers avec statut, dates, client |
| PROJ-02 | Création chantier – formulaire | Ouvrir « Nouveau projet », remplir type, client, dates, description, enregistrer | Chantier créé et visible en liste |
| PROJ-03 | Ajout client depuis formulaire projet | Dans le dialogue de création/édition, utiliser le « + » pour ajouter un contact : remplir Prénom, Nom, Email (optionnel selon règles), Téléphone, « Créer le contact » | Nouveau client créé et sélectionné dans le champ Client |
| PROJ-04 | Validation nouveau contact (chantier) | Bouton « + » : ne pas remplir Prénom ou Nom ou Email (si obligatoire), « Créer le contact » désactivé | Impossible de créer tant que les champs requis ne sont pas remplis |
| PROJ-05 | Édition chantier | Ouvrir un chantier, modifier dates ou description, enregistrer | Modifications sauvegardées |
| PROJ-06 | Affectation membres équipe | Depuis le détail chantier, affecter un ou plusieurs membres | Affectations enregistrées et visibles (planning, détail) |
| PROJ-07 | Documents chantier | Ajouter un document (upload), vérifier affichage, supprimer si possible | Fichier enregistré, liste à jour |
| PROJ-08 | Devis liés au chantier | Depuis le chantier, créer ou lier un devis, consulter les devis du chantier | Devis listés, statuts corrects |
| PROJ-09 | Facture depuis devis | Depuis un devis signé/accepté du chantier, créer une facture | Facture créée et liée |
| PROJ-10 | Suppression chantier | Supprimer un chantier (avec confirmation) | Chantier retiré de la liste, comportement cohérent pour devis/factures liés |
| PROJ-11 | KPIs / indicateurs | Vérifier barre ou indicateurs (devis signés, facturé, etc.) sur carte ou détail | Chiffres cohérents avec les données |

---

### 3.7 Planning

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| PLA-01 | Vue calendrier | Aller sur `/dashboard/planning`, vue Calendrier par défaut | Mois affiché, chantiers positionnés sur les dates |
| PLA-02 | Vue liste / vue semaine | Basculer en vue Liste puis vue Semaine | Affichage adapté, pas d’erreur |
| PLA-03 | Changement de mois | Utiliser les flèches ou le sélecteur pour changer de mois | Chantiers du mois sélectionné |
| PLA-04 | Filtres (statut, type, membre) | Appliquer filtre « En cours », « Terminé », type de chantier, membre | Liste/calendrier filtrée correctement |
| PLA-05 | Notes de planning | Ajouter une note sur une date, sauvegarder, recharger la page | Note persistée et affichée |
| PLA-06 | Édition chantier depuis planning | Cliquer sur un chantier pour l’éditer (dates, durée) | Modifications sauvegardées, planning mis à jour |
| PLA-07 | Chantiers en retard | Présence de chantiers avec date de fin &lt; aujourd’hui et statut non terminé | Indication « en retard » ou badge cohérent |

---

### 3.8 CRM Pipeline

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| CRM-01 | Affichage des colonnes | Aller sur `/dashboard/crm` | Colonnes du pipeline visibles (ex. Prospect, Devis, Relance, Gagné/Perdu) |
| CRM-02 | Drag & drop prospect | Déplacer une carte d’une colonne à une autre | Statut/stage du prospect mis à jour après drop |
| CRM-03 | Ajout prospect | Créer un nouveau prospect (si fonctionnalité présente) | Carte apparaît dans la colonne appropriée |
| CRM-04 | Détail prospect | Ouvrir le détail d’un prospect, modifier champs, enregistrer | Données mises à jour |
| CRM-05 | Lien devis – création / envoi | Depuis un prospect, créer ou envoyer un devis | Devis créé ou lien envoyé, statut cohérent |
| CRM-06 | Relance | Cliquer sur « Relance » (email) pour un prospect en attente | Comportement attendu (envoi ou enregistrement), pas d’erreur |
| CRM-07 | Passage Gagné / Perdu | Déplacer un prospect en « Gagné » ou « Perdu » (ou équivalent) | Prospect marqué, plus dans les colonnes actives si applicable |
| CRM-08 | Suppression prospect | Retirer un prospect du pipeline (si possible) | Carte disparaît après confirmation |

---

### 3.9 Factures

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| FAC-01 | Liste des factures | Aller sur `/dashboard/invoices` | Tableau/liste avec numéros, clients, montants, statuts |
| FAC-02 | Filtres (client, chantier, statut, année) | Utiliser les filtres disponibles | Résultats filtrés cohérents |
| FAC-03 | Création depuis devis | Créer une facture à partir d’un devis signé/accepté | Facture créée avec lignes et totaux issus du devis |
| FAC-04 | Édition facture (brouillon) | Modifier une facture en brouillon | Sauvegarde OK |
| FAC-05 | Changement de statut | Passer une facture en « Envoyée », « Payée », « Partiellement payée » | Statut mis à jour et affiché |
| FAC-06 | Enregistrement paiement | Saisir un paiement (montant, date) sur une facture | Montant enregistré, statut mis à jour si payée en totalité |
| FAC-07 | Téléchargement PDF facture | Télécharger le PDF d’une facture | PDF généré avec mentions légales et totaux corrects |

---

### 3.10 Tarifs

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| TAR-01 | Liste des tarifs | Aller sur `/dashboard/tarifs` | Liste/tableau des tarifs utilisateur |
| TAR-02 | Ajout manuel | Créer un tarif : libellé, catégorie, unité, prix HT | Tarif créé et visible |
| TAR-03 | Import Excel | Importer un fichier Excel (colonnes attendues : libellé, catégorie, unité, prix HT) | Tarifs importés, liste à jour |
| TAR-04 | Édition / suppression | Modifier un tarif, supprimer un tarif | Modifications et suppression effectives |
| TAR-05 | Filtre par catégorie | Filtrer par catégorie (matériau, service, etc.) | Liste filtrée |
| TAR-06 | Utilisation dans un devis | Depuis la page Devis, ajouter une ligne en choisissant un tarif (si fonctionnalité) | Ligne pré-remplie avec libellé, unité, prix |

---

### 3.11 Équipe et utilisateurs

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| EQU-01 | Liste des membres | Aller sur `/dashboard/team` | Liste des membres de l’équipe |
| EQU-02 | Invitation | Envoyer une invitation (email) | Email envoyé ou lien généré, pas d’erreur |
| EQU-03 | Acceptation invitation | Ouvrir le lien `/invite/:token` avec un token valide | Page d’acceptation, création ou liaison du compte |
| EQU-04 | Création utilisateur (admin) | Depuis `/dashboard/create-user` si accessible : créer un utilisateur | Utilisateur créé et visible dans l’équipe |

---

### 3.12 Paramètres

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| SET-01 | Profil utilisateur | Modifier nom, email (si possible) | Sauvegarde OK, données affichées à jour |
| SET-02 | Données entreprise | Remplir ou modifier raison sociale, adresse, SIRET, TVA, RCS, APE, capital, assurance, qualifications | Sauvegarde OK, champs utilisés dans PDF devis/factures |
| SET-03 | Logo | Uploader un logo, sauvegarder | Logo visible sur les PDF et en-têtes |
| SET-04 | Conditions par défaut | Modifier « Conditions générales par défaut » | Texte utilisé pour les nouveaux devis (modèle Défaut) |
| SET-05 | TVA / validité par défaut | Modifier TVA par défaut et validité des devis (jours) | Valeurs appliquées aux nouveaux devis |
| SET-06 | Thème / préférences | Changer la couleur de thème si proposé | Thème appliqué à l’interface |

---

### 3.13 Pages publiques (sans connexion)

| ID | Scénario | Étapes principales | Résultat attendu |
|----|----------|--------------------|------------------|
| PUB-01 | Signature de devis – token valide | Ouvrir `/sign-quote/:token` avec un token valide | Page de visualisation du devis + formulaire de signature (email, acceptation) |
| PUB-02 | Signature – token invalide ou expiré | Ouvrir avec un token invalide ou expiré | Message « Lien invalide ou expiré » (ou équivalent) |
| PUB-03 | Soumission signature | Renseigner l’email et accepter les conditions, signer | Message de succès, statut du devis passé à « signé » côté app |
| PUB-04 | Formulaire client – token valide | Ouvrir `/client-form/:token`, remplir nom, email, téléphone, adresse (selon champs requis), soumettre | Message de succès, contact enregistré |
| PUB-05 | Formulaire client – validation | Saisir email invalide ou téléphone invalide | Messages d’erreur, envoi bloqué |
| PUB-06 | Invitation – token valide | Ouvrir `/invite/:token` | Page d’acceptation d’invitation, processus clair |

---

## 4. Cas de test détaillés (format tableau)

À utiliser pour suivre l’exécution (Pass / Fail / Bloqué).

### 4.1 Exemple – Devis

| ID | Cas de test | Étapes | Données | Résultat attendu | Pass / Fail |
|----|-------------|--------|--------|-------------------|------------|
| DEV-T01 | Sauvegarde devis avec client sans email | 1) Nouveau devis 2) Nom client « Dupont » 3) Aucun email 4) Une ligne « Prestation » 10 € HT 5) Sauvegarder | Nom = Dupont, email vide | Devis sauvegardé, visible en liste | |
| DEV-T02 | Modèle Magasin remplace les conditions | 1) Ouvrir un devis 2) Onglet/section Conditions 3) Sélectionner « Magasin / local commercial » | — | Textarea contient le texte type magasin (horaires, protection, acompte…) | |
| DEV-T03 | Création chantier depuis devis sans email client | 1) Devis avec client « Martin », pas d’email 2) « Créer un chantier pour ce devis » | Client Martin existant en base avec même nom | Chantier créé, client « Martin » associé | |

### 4.2 Exemple – Estimation

| ID | Cas de test | Étapes | Données | Résultat attendu | Pass / Fail |
|----|-------------|--------|--------|-------------------|------------|
| EST-T01 | Devis créé avec client formulaire (sans clic Ajouter) | 1) Estimation avec résultat 2) Saisir nom/email/tel dans formulaire client sans cliquer « Ajouter » 3) Créer le devis | Nouveau client saisi | Devis avec nom, email, téléphone renseignés | |
| EST-T02 | Lignes IA ont une unité | 1) Type chantier avec surface 2) Générer estimation IA 3) Créer devis | — | Chaque ligne a une unité (m², Forfait, U, etc.) | |

### 4.3 Exemple – Contacts

| ID | Cas de test | Étapes | Données | Résultat attendu | Pass / Fail |
|----|-------------|--------|--------|-------------------|------------|
| CLI-T01 | Création contact depuis chantier – champs requis | 1) Nouveau chantier 2) Cliquer « + » client 3) Remplir Prénom, Nom, Email 4) « Créer le contact » | Prénom=Jean, Nom=Dupont, Email=jean@test.fr | Contact créé et sélectionné | |
| CLI-T02 | Bouton Créer désactivé si email manquant | 1) « + » client 2) Prénom + Nom seulement, pas d’email | — | Bouton « Créer le contact » désactivé | |

---

## 5. Smoke tests (régression critique)

À exécuter avant chaque release ou déploiement. Durée cible : 10–15 minutes.

1. **Connexion** : se connecter sur `/auth` → redirection `/dashboard`.
2. **Navigation** : ouvrir Devis, Projets, Planning, CRM, Factures, Contacts, Paramètres → aucune page 404 ou crash.
3. **Devis** : créer un devis minimal (nom client + 1 ligne), sauvegarder → devis en liste.
4. **PDF** : télécharger le PDF du devis → fichier ouvert, totaux corrects.
5. **Client** : créer un client (nom, email, téléphone) → visible dans Contacts.
6. **Projet** : créer un chantier (type, client, dates) → visible dans Projets et Planning.
7. **Déconnexion** : se déconnecter → redirection vers accueil/auth.

---

## 6. Checklist avant release

- [ ] Tous les smoke tests passent.
- [ ] Au moins les scénarios critiques (AUTH, DEV, EST, CLI, PROJ) ont été parcourus.
- [ ] Test sur un navigateur secondaire (ex. Firefox si dev sur Chrome).
- [ ] Test responsive sur un écran étroit (menu, formulaires, tableaux).
- [ ] Vérification des liens publics (sign-quote, client-form, invite) avec tokens valides et invalides.
- [ ] Aucune clé API ou secret exposé dans le front (vérification manuelle ou audit).
- [ ] Messages d’erreur utilisateur clairs (pas de stack trace brute).

---

## 7. Suivi des bugs

Lors d’un test, tout comportement non conforme peut être noté ainsi :

- **ID du scénario / cas de test** concerné
- **Navigateur / OS**
- **Étapes pour reproduire**
- **Résultat observé** vs **résultat attendu**
- **Capture d’écran** si utile

Ce document peut être versionné avec l’application et complété par de nouveaux cas au fil des livraisons.
