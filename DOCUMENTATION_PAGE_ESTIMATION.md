# Documentation Page Estimation Automatique des Chantiers – Aos Renov

**Document destiné à l'analyse fonctionnelle et technique**

---

## 1. Vue d'ensemble

La **page Estimation automatique des chantiers** permet d'obtenir une estimation prévisionnelle d'un chantier en 3 étapes : photo de la zone (analyse IA), questions détaillées selon le type de projet, puis résultats (temps, matériaux, outils, coûts, recommandations). L'estimation est générée par l'IA (Gemini) à partir des données saisies et de l'analyse de la photo.

| Élément | Détail |
|--------|--------|
| **Chemin** | `/dashboard/estimation` |
| **Composant principal** | `EstimationPage.tsx` |
| **Titre affiché** | « Estimation Automatique des Chantiers » |
| **Sous-titre** | Dynamique : « Étape 1/3 - Photo de la zone », « Étape 2/3 - Questions », « Étape 3/3 - Résultats de l'estimation » |

---

## 2. Objectif et usage

- **Étape 1** : l'utilisateur insère une photo de la zone du futur chantier. Un bouton « Analyser la zone » envoie l'image à l'IA (Gemini Vision) qui renvoie une description de la zone et des suggestions (type de projet, surface estimée). Le bouton « Continuer » n'est actif qu'après analyse.
- **Étape 2** : questions posées à l'utilisateur (surface en m², type de projet, questions conditionnelles selon le type — ex. piscine : matériau coque/liner, skimmers, chauffage —, localisation, délai). Client optionnel (recherche parmi les clients existants ou création d'un nouveau). Les suggestions de l'étape 1 peuvent pré-remplir type et surface. Bouton « Obtenir l'estimation » envoie les données à l'API et affiche l'étape 3.
- **Étape 3** : affichage des résultats IA : récapitulatif de la saisie, temps de réalisation, liste des matériaux, outils nécessaires, nombre d'ouvriers, coût total / marge / bénéfice, répartition des coûts, recommandations. Bouton « Nouvelle estimation » réinitialise tout et revient à l'étape 1.

---

## 3. Structure de l'interface

### 3.1 En-tête

- Titre « Estimation Automatique des Chantiers »
- Sous-titre indiquant l'étape courante (1/3, 2/3 ou 3/3) et le libellé de l'étape
- `UserAccountButton` (compte utilisateur)

### 3.2 Étape 1 – Photo de la zone

- **Zone de dépôt** : glisser-déposer une photo ou clic pour sélectionner un fichier (accept `image/*`). Libellé : « Insérez une photo de la zone du chantier. Elle sera analysée par l'IA. »
- **Prévisualisation** : grille des images ajoutées, avec bouton × pour supprimer (la suppression réinitialise l'analyse).
- **Bouton « Analyser la zone »** : affiché dès qu'au moins une photo est présente. Au clic : conversion de la première image en base64, appel `POST /api/analyze-estimation-photo`, affichage d'un chargement puis du résultat.
- **Résultat de l'analyse** : bloc affichant la description de la zone (`descriptionZone`) et, si présentes, les suggestions (type projet, surface estimée).
- **Message d'erreur** : en cas d'échec de l'API (réseau, clé Gemini manquante, etc.), un bloc rouge affiche le message.
- **Bouton « Continuer »** : actif uniquement si une analyse a été effectuée avec succès ; passe à l'étape 2.

### 3.3 Étape 2 – Questions pour l'estimation

#### Bloc Client (optionnel)

- **Recherche** : champ « Rechercher un client existant » avec filtre en temps réel sur nom, email, téléphone (liste des clients du contexte `useChantiers()`).
- **Sélection** : clic sur un client dans la liste → client sélectionné (nom, email, tél affichés) avec bouton « Changer de client ».
- **Création** : bouton « Créer un nouveau client » ouvre un formulaire Nom / Email / Téléphone et boutons « Ajouter le client » / « Annuler ». Le client créé est mémorisé localement (non persisté en base).

#### Bloc Réponses (questions)

- **Quelle est la surface en m² ?** : champ numérique.
- **Quel est le type de projet ?** : liste déroulante (types alignés sur le reste de l'app : Piscine & Spa, Rénovation, Plomberie, Maçonnerie, Terrasse & Patio, etc. — voir `TYPE_CHANTIER_LABELS`).
- **Questions conditionnelles** : selon le type choisi, un ensemble de questions s'affiche (défini dans `estimationQuestionnaire.ts`). Exemples :
  - **Piscine** : matériau (Coque, Liner, Polyester, Béton), skimmers (Oui/Non), chauffage (Oui/Non), couverture (Oui/Non).
  - **Rénovation** : type de travaux (Peinture, Carrelage, Plomberie, Électricité, Mixte), nombre de pièces, rénovation complète (Oui/Non).
  - **Terrasse** : matériau (Bois, Composite, Carrelage, Dalles), abri/pergola (Oui/Non).
  - Autres types (plomberie, peinture, electricite, etc.) : 1 à 3 questions chacune.
- **Type « Autre »** : pas de questions conditionnelles ; un champ « Précisez le projet ou les matériaux » est affiché à la place.
- **Localisation ?** et **Délai souhaité ?** : champs texte optionnels.

#### Navigation

- **Retour** : retour à l'étape 1 (conserve photos et analyse).
- **Obtenir l'estimation** : actif si surface et type de projet sont renseignés et que toutes les questions conditionnelles du type ont une réponse. Déclenche l'appel `POST /api/estimate-chantier` puis affichage de l'étape 3. Pendant l'appel : bouton désactivé, libellé « Estimation en cours... » avec spinner. En cas d'erreur : message sous les boutons (clé Gemini manquante, réponse invalide, réseau).

### 3.4 Étape 3 – Résultats de l'estimation

- **Récapitulatif de votre saisie** : client (nom, email, tél), surface, type de projet, matériaux, localisation, délai (selon ce qui a été saisi).
- **Estimation du temps de réalisation** : une ligne (ex. « 3 semaines »).
- **Liste des matériaux nécessaires** : pour chaque matériau — nom, quantité, prix (€). Si vide : « Aucun matériau listé par l'estimation. »
- **Outils nécessaires** : liste à puces. Si vide : « Aucun outil listé. »
- **Nombre d'ouvriers requis** : une valeur (ex. « 2 ouvrier(s) »).
- **Coût total prévisionnel** : coût de base, marge, bénéfice estimé (mis en avant).
- **Répartition des coûts** : barres par poste (transport, main-d'œuvre, matériaux, autres) avec montant en €.
- **Recommandations automatiques** : liste à puces. Si vide : « Aucune recommandation fournie. »

**Bouton « Nouvelle estimation »** : réinitialise tout (étape 1, images, analyse photo, client, chantierInfo, questionnaireAnswers, analysisResults) et revient à l'étape 1.

---

## 4. Données et APIs

### 4.1 État local (EstimationPage)

| State | Description |
|-------|-------------|
| `step` | 1, 2 ou 3 |
| `images` | Tableau `{ file, preview }` (preview = URL blob ou Supabase) |
| `photoAnalysis` | `{ descriptionZone, suggestions?: { typeProjet?, surfaceEstimee? } }` ou null |
| `isAnalyzingPhoto`, `photoAnalysisError` | Chargement et erreur de l'analyse photo |
| `selectedClient` | Client choisi ou créé (id, name, email, phone) — optionnel |
| `chantierInfo` | surface, materiaux, localisation, delai, metier |
| `questionnaireAnswers` | `Record<questionId, value>` (réponses aux questions conditionnelles) |
| `analysisResults` | Réponse de l'API estimation (temps, materiaux, outils, coûts, etc.) |
| `isEstimating`, `estimateError` | Chargement et erreur de l'estimation |

### 4.2 API Backend

**POST `/api/analyze-estimation-photo`**

- **Body** : `{ imageBase64: string, mimeType?: string }`
- **Comportement** : envoi de l'image à Gemini (vision) avec un prompt demandant une description de la zone et des suggestions (type projet, surface). Réponse JSON : `{ descriptionZone: string, suggestions?: { typeProjet?: string, surfaceEstimee?: string } }`.
- **Erreurs** : 400 (image manquante), 502 (réponse invalide), 503 (clé Gemini manquante ou erreur API).

**POST `/api/estimate-chantier`**

- **Body** : `{ client?: { name, email, phone }, chantierInfo: { surface, materiaux?, localisation?, delai?, metier }, photoAnalysis?: string, questionnaireAnswers?: Record<string, string> }`
- **Comportement** : construction d'un prompt à partir des champs + description photo + réponses au questionnaire, appel Gemini, retour JSON structuré.
- **Réponse** : `{ tempsRealisation, materiaux: [{ nom, quantite, prix }], outils: string[], nombreOuvriers, coutTotal, marge, benefice, repartitionCouts: { transport, mainOeuvre, materiaux, autres }, recommandations: string[] }`.
- **Validation** : surface et metier obligatoires. 400 si manquants ; 502/503 en cas d'erreur IA.

### 4.3 Questionnaire conditionnel

- **Fichier** : `client/src/lib/estimationQuestionnaire.ts`
- **Fonctions** : `getQuestionsForType(metier)` retourne la liste des questions pour un type (piscine, renovation, terrasse, etc.) ; `hasQuestionsForType(metier)` indique si le type a des questions.
- **Structure d'une question** : `id`, `label`, `type: 'choice' | 'yesno'`, `options?` (pour choice : tableau `{ value, label }` ; pour yesno : Oui/Non).
- Les réponses sont stockées dans `questionnaireAnswers` et envoyées à `/api/estimate-chantier` pour affiner l'estimation.

---

## 5. Flux de données

```
Étape 1 : Photo
  → Utilisateur ajoute une photo (upload Storage ou blob)
  → Clic « Analyser la zone » → fileToBase64(images[0].file) → POST /api/analyze-estimation-photo
  → Réponse : descriptionZone, suggestions → setPhotoAnalysis(...)
  → Clic « Continuer » → setStep(2)

Étape 2 : Questions
  → Pré-remplissage optionnel : useEffect si photoAnalysis.suggestions → surface, metier
  → Utilisateur remplit surface, type, réponses aux questions conditionnelles, optionnellement client, localisation, délai
  → Clic « Obtenir l'estimation » → POST /api/estimate-chantier { client, chantierInfo, photoAnalysis: descriptionZone, questionnaireAnswers }
  → Réponse : analysisResults → setAnalysisResults(data), setStep(3)

Étape 3 : Résultats
  → Affichage en lecture seule (récap + tous les blocs IA)
  → Clic « Nouvelle estimation » → reset complet, setStep(1)
```

---

## 6. Fichiers sources

| Fichier | Rôle |
|---------|------|
| `client/src/pages/EstimationPage.tsx` | Page complète : 3 étapes, formulaire, questionnaire, résultats, appels API |
| `client/src/lib/estimationQuestionnaire.ts` | Configuration des questions par type de chantier (piscine, renovation, terrasse, etc.) |
| `client/src/lib/planningUtils.ts` | `TYPE_CHANTIER_LABELS` (liste des types de chantier) |
| `client/src/lib/supabaseStorage.ts` | `uploadFile` pour l'envoi des photos (Storage Supabase) |
| `server/routes.ts` | Routes `POST /api/analyze-estimation-photo` et `POST /api/estimate-chantier` (Gemini) |

### Dépendances UI

- `PageWrapper`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Input`
- `UserAccountButton`
- `motion`, `AnimatePresence` (framer-motion)
- Icônes : `Upload`, `Wand2`, `Plus`, `Calculator`, `User`, `ArrowRight`, `ArrowLeft`, `CheckCircle2`, `Search`, `Loader2` (lucide-react)

### Contextes

- `useAuth()` : utilisateur connecté (pour l'upload Storage).
- `useChantiers()` : liste des clients existants (recherche / sélection à l'étape 2).

---

## 7. Configuration requise

- **Clé API Gemini** : pour que l'analyse photo et l'estimation fonctionnent, la variable d'environnement `GEMINI_API_KEY` doit être définie côté serveur (fichier `.env`). Sinon, les deux APIs renvoient 503 avec un message explicite.
- **Supabase** : bucket Storage pour l'upload des photos (étape 1) ; les clients listés à l'étape 2 viennent de Supabase via `ChantiersContext`.

---

## 8. Points d'attention

1. **Client non persisté** : le client créé à l'étape 2 (formulaire « Créer un nouveau client ») n'est pas enregistré en base ; il sert uniquement au flux d'estimation. La recherche, elle, affiche les clients déjà en base (ChantiersContext).
2. **Pas d'enregistrement du résultat** : les résultats de l'étape 3 ne sont pas sauvegardés ni associés à un chantier. Une évolution possible : bouton « Créer un chantier à partir de cette estimation » qui pré-remplirait le formulaire de création de chantier.
3. **Une photo analysée** : seule la première image du tableau est envoyée à l'API d'analyse. L'ajout d'une nouvelle photo réinitialise `photoAnalysis` (il faut ré-analyser).
4. **Valeurs par défaut étape 3** : si l'API renvoie des champs manquants, l'interface utilise des fallbacks (tableaux vides, « Non estimé », 0) pour éviter les erreurs d'affichage.

---

*Documentation de la page Estimation automatique des chantiers – Aos Renov*
