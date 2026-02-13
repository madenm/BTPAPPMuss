# TitanBtp

Application professionnelle pour la gestion de chantiers et devis avec design glassmorphism et fond MeshGradient animé.

## Démarrer l'application en local

**Important :** L’erreur `ERR_CONNECTION_REFUSED` signifie que le serveur n’est pas démarré. Il faut **toujours** lancer le serveur avant d’ouvrir l’app dans le navigateur.

### Méthode 1 : double-clic (Windows)

1. Placez-vous dans le dossier du projet (celui qui contient `package.json`).
2. Double-cliquez sur **`demarrer.bat`**.
3. Attendez le message `serving on http://127.0.0.1:5000`.
4. Ouvrez votre navigateur à l’adresse : **http://127.0.0.1:5000**

### Méthode 2 : terminal

1. **Ouvrir un terminal** dans le dossier du projet (celui qui contient `package.json` et le dossier `server/`).
2. **Installer les dépendances** (une seule fois) :  
   `npm install`
3. **Lancer le serveur** :  
   `npm run dev`
4. **Attendre** le message dans le terminal : `serving on http://127.0.0.1:5000`
5. **Ouvrir le navigateur** à l’adresse : **http://127.0.0.1:5000**

### Si vous voyez ERR_CONNECTION_REFUSED

- Le serveur n’est pas lancé ou a planté.
- **À faire :** dans un terminal, allez dans le dossier du projet (où se trouve `package.json`) et exécutez `npm run dev`. Ne fermez pas ce terminal.
- Attendez le message `serving on http://127.0.0.1:5000`, puis ouvrez ou rechargez **http://127.0.0.1:5000** dans le navigateur.
- Si le terminal affiche une erreur au démarrage (ex. erreur de syntaxe), corrigez-la avant de relancer `npm run dev`.

## Déploiement sur Vercel

### Prérequis
- Compte GitHub
- Compte Vercel
- Node.js 20.x ou supérieur

### Étapes de déploiement

1. **Connecter le dépôt GitHub à Vercel**
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez sur "New Project"
   - Importez le dépôt (ou votre fork TitanBtp)

2. **Configuration automatique**
   - Vercel détectera automatiquement la configuration depuis `vercel.json`
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`

3. **Variables d'environnement (si nécessaire)**
   - Ajoutez vos variables d'environnement dans les paramètres du projet Vercel
   - Exemple: `PORT`, `NODE_ENV`, etc.

4. **Déploiement**
   - Cliquez sur "Deploy"
   - Vercel construira et déploiera automatiquement votre application

### Commandes locales

```bash
# Installation des dépendances
npm install

# Développement
npm run dev

# Build pour production
npm run build

# Démarrer en production
npm start
```

## 📦 Technologies utilisées

- React 18
- Vite
- TypeScript
- Express
- Tailwind CSS
- Framer Motion
- @paper-design/shaders-react (MeshGradient)
- Wouter (routing)

## 🎨 Fonctionnalités

- Design glassmorphism avec transparence
- Fond MeshGradient animé
- Dashboard complet avec gestion de devis
- CRM Pipeline avec drag & drop
- Visualisation IA
- Planning de chantiers
- Gestion des paiements
- Portfolio avant/après
- Analytics

## 📧 Envoi d’emails (devis par email)

L’envoi automatique du devis par email (CRM Pipeline) supporte **Brevo** (gratuit) ou **Resend**.

### Option gratuite sans domaine : Brevo

1. **Créez un compte** sur [brevo.com](https://www.brevo.com) (gratuit, 300 emails/jour).
2. **Récupérez une clé API** : Paramètres → Clés API → Créer une clé.
3. **Ajoutez et vérifiez un expéditeur** : [Expéditeurs Brevo](https://app.brevo.com/senders/list) → Ajouter un expéditeur → saisissez votre adresse (Outlook, Gmail, etc.) → Brevo envoie un **code à 6 chiffres** à cette adresse → entrez le code pour valider. **Aucun domaine à acheter.**
4. **Dans le `.env`** :
   - `BREVO_API_KEY=xkeysib-...` (votre clé)
   - `SENDER_EMAIL=votre-adresse@outlook.fr` (l’adresse que vous avez vérifiée dans Brevo)
5. Si vous avez configuré votre email dans le CRM (« Configuration Email »), cette adresse sera utilisée ; elle doit être vérifiée dans Brevo.

L’app utilise Brevo en priorité si `BREVO_API_KEY` est défini. Vous pouvez alors envoyer des devis à **n’importe quel prospect** sans acheter de domaine.

### Option avec domaine : Resend

- **`RESEND_API_KEY`** : clé API [Resend](https://resend.com). Pour envoyer à des prospects, un **domaine vérifié** est requis sur [resend.com/domains](https://resend.com/domains) (ex. domaine acheté chez OVH, Gandi).
- **`SENDER_EMAIL`** ou **`RESEND_FROM`** : adresse du domaine vérifié (ex. `contact@votredomaine.fr`).

Si `BREVO_API_KEY` n’est pas défini mais `RESEND_API_KEY` l’est, l’app utilise Resend.

Un fichier `.env.example` à la racine du projet liste ces variables ; copiez-le en `.env` et renseignez les valeurs.

## 🤖 Activer l’analyse IA des devis

L’app peut générer automatiquement un **devis détaillé** (lignes de travaux, matériaux, main d’œuvre) à partir de la description du projet (étape 2 → 3 du Générateur de devis). Deux modes :

- **Avec clé OpenAI** : analyse IA détaillée (lots, sous-lignes, quantités estimées).
- **Sans clé** : préremplissage par **règles** (découpage du texte, détection des quantités m², jours, etc.).

### Activer l’analyse IA (OpenAI)

1. Créez un compte sur [OpenAI](https://platform.openai.com) si besoin.
2. Allez dans [Clés API](https://platform.openai.com/api-keys) et créez une clé (ex. `sk-...`).
3. À la **racine du projet** (dossier qui contient `package.json`), créez ou éditez le fichier **`.env`**.
4. Ajoutez une ligne :  
   `OPENAI_API_KEY=sk-votre-cle-ici`
5. **Redémarrez le serveur** (`npm run dev`). À l’étape suivante du devis, l’analyse IA sera utilisée automatiquement et le bouton **« Analyser avec l’IA »** sera pleinement actif.

Le fichier `.env` doit être au même niveau que `package.json`. Sans clé, l’app utilise l’analyse par règles et affiche un message explicatif.

## 🗄️ Supabase – colonnes chantiers

Si l’ajout ou la modification d’un chantier renvoie une erreur du type **« Could not find the 'notes' column of 'chantiers' »**, la table `chantiers` n’a pas encore les colonnes `notes` et `type_chantier`.

1. Ouvrez votre projet sur [Supabase](https://supabase.com) → **SQL Editor**.
2. Exécutez le script **`supabase_chantiers_notes_type.sql`** (à la racine du projet).
3. Rechargez l’application : la création et l’édition de chantiers (avec description du projet et type) fonctionneront.

## 🗄️ Supabase – coordonnées entreprise (devis)

Pour afficher les coordonnées de l’entreprise dans l’en-tête du devis PDF (Paramètres → Coordonnées pour le devis) :

1. Ouvrez votre projet sur [Supabase](https://supabase.com) → **SQL Editor**.
2. Exécutez le script **`supabase_user_profiles_company.sql`** (à la racine du projet).
3. Les champs Adresse, Ville et Code Postal, Téléphone et Email seront alors sauvegardés et utilisés dans les devis téléchargés ou envoyés par email.

## 🗄️ Supabase – code de connexion équipe (page d’invitation)

Si, sur la page « Rejoindre l’équipe » (lien d’invitation), le message **« Code de connexion incorrect »** s’affiche alors que le code est correct, il faut créer la fonction Postgres qui permet de vérifier le code sans être bloqué par la RLS.

1. Ouvrez votre projet sur [Supabase](https://supabase.com) → **SQL Editor**.
2. Exécutez le script **`supabase_team_members_invite_rls.sql`** (à la racine du projet). Ce script crée la fonction `verify_invite_code` (SECURITY DEFINER) et accorde son exécution au rôle `anon`.
3. Rechargez la page d’invitation et réessayez avec le code de connexion : la vérification fonctionnera.

## 🗄️ Supabase – chantiers visibles par le membre d'équipe invité

Pour qu'un membre d'équipe invité (sans compte Supabase) voie les chantiers auxquels il est assigné sur le dashboard équipe :

1. Ouvrez votre projet sur [Supabase](https://supabase.com) → **SQL Editor**.
2. Exécutez le script **`supabase_get_chantiers_for_team_member.sql`** (à la racine du projet). Ce script crée la fonction `get_chantiers_for_team_member` (SECURITY DEFINER) et accorde son exécution aux rôles `anon` et `authenticated`.

## 🗄️ Supabase – permissions des membres d'équipe

Pour que les accès accordés par le patron (tableau de bord, chantiers, planning, devis, factures, etc.) s’affichent correctement sur la page du membre, y compris lorsqu’il se connecte depuis un autre appareil ou navigateur, les permissions doivent être en base.

1. La migration **`add_team_members_permissions_columns`** (script `supabase_team_members_permissions.sql`) ajoute les colonnes de permissions sur la table `team_members`. Si elle n’a pas encore été exécutée, ouvrez le **SQL Editor** de votre projet Supabase et exécutez le contenu de **`supabase_team_members_permissions.sql`**.
2. **Après** avoir exécuté cette migration : en tant que patron, ouvrez **Gestion de l’équipe** → **Modifier le Membre** pour chaque membre concerné, cochez les droits souhaités, puis cliquez sur **Enregistrer**. Les permissions seront alors enregistrées en base et le membre verra les bons onglets et contenus à sa prochaine connexion (sur n’importe quel appareil).

## 📝 Notes

- Le projet utilise un serveur Express pour servir l'application
- Le build génère les fichiers statiques dans `dist/public`
- Le serveur Express est configuré pour servir les fichiers statiques en production

