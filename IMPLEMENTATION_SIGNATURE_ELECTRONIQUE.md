# Configuration: Signature Électronique des Devis

## 🎯 Résumé de la fonctionnalité

Ce system permet aux clients de signer électroniquement les devis directement en ligne (via une page web), sans avoir besoin d'imprimer le PDF. Le workflow est :

1. **Admin envoie le devis** par email avec un lien de signature unique
2. **Client clique** sur le lien pour accéder à une page de signature
3. **Client signe** électroniquement (dessin à la main sur écran)
4. **Système enregistre** la signature et met à jour le statut du devis à "signé"

---

## 📋 Composants implémentés

### 1. **Migrations Supabase**

Deux migrations SQL ont été créées :

#### `quote_signatures.sql`
- `public.quote_signature_links` → tokens uniques pour chaque devis
- `public.quote_signatures` → enregistrement des signatures (prénom, nom, email, image)

#### `add_signed_status_to_quotes.sql`
- Ajoute le statut `"signé"` au champ `status` de la table `quotes`

### 2. **API Backend (routes.ts)**

Deux nouveaux endpoints :

#### `POST /api/generate-quote-signature-link`
Génère un lien de signature unique pour un devis.

**Requête :**
```json
{
  "quoteId": "uuid-du-devis",
  "expirationDays": 30
}
```

**Headers :**
```
Authorization: Bearer <token_utilisateur>
```

**Réponse :**
```json
{
  "ok": true,
  "signatureToken": "...",
  "signatureLink": "https://votreapp.com/sign-quote/...",
  "expiresAt": "2026-03-28T..."
}
```

#### `POST /api/submit-quote-signature`
Soumet et enregistre une signature (appelé par le client).

**Requête :**
```json
{
  "signatureToken": "token-unique",
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "signatureDataBase64": "data:image/png;base64,..."
}
```

**Réponse :**
```json
{
  "ok": true,
  "message": "Signature enregistrée avec succès.",
  "quoteId": "uuid-du-devis"
}
```

#### `POST /api/send-quote-email` (modifié)
Envoie le devis par email avec un lien de signature inclus.

**Nouveaux paramètres :**
```json
{
  "to": "client@example.com",
  "pdfBase64": "...",
  "fileName": "devis-2026.pdf",
  "quoteId": "uuid-du-devis",
  "userId": "uuid-utilisateur"
}
```

Génère automatiquement un lien de signature et l'ajoute au contenu HTML de l'email.

### 3. **Composant React (QuoteSignatureForm.tsx)**

Formulaire de signature avec :
- ✅ Champs: Prénom, Nom, Email
- ✅ Canvas pour dessiner la signature
- ✅ Boutons Effacer/Signer
- ✅ États de chargement et succès
- ✅ Validation des champs

### 4. **Page Publique (SignQuotePage.tsx)**

Page accessible sans authentification :
- `/sign-quote/:token` → affiche le formulaire de signature
- Layout responsive (desktop + mobile)
- Gestion des erreurs (lien expiré, invalide, etc.)
- Message de confirmation après envoi

### 5. **Routing (App.tsx)**

Nouvelle route publique ajoutée :
```tsx
if (pathname.startsWith('/sign-quote/')) {
  return <SignQuotePage />;
}
```

---

## 🚀 Guide d'utilisation (pour le frontend)

### Étape 1 : Générer un lien de signature

Lors de l'envoi d'un devis, appelez l'endpoint :

```typescript
const generateSignatureLink = async (quoteId: string, userId: string) => {
  const token = localStorage.getItem("supabase_auth_token");
  const response = await fetch('/api/generate-quote-signature-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      quoteId,
      expirationDays: 30
    })
  });

  const data = await response.json();
  return data.signatureLink; // Exemple: https://votreapp.com/sign-quote/xyz123...
};
```

### Étape 2 : Envoyer l'email avec le lien

```typescript
const sendQuoteWithSignatureLink = async (
  to: string,
  pdfBase64: string,
  quoteId: string,
  userId: string
) => {
  const response = await fetch('/api/send-quote-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      pdfBase64,
      fileName: 'devis.pdf',
      quoteId,
      userId,
      htmlContent: '<p>Veuillez consulter et signer votre devis.</p>'
    })
  });

  const data = await response.json();
  console.log('Email envoyé avec lien de signature:', data.signatureLink);
};
```

### Étape 3 : Client signe via le lien

Le client reçoit un email > clique sur le lien > remplit le formulaire > signe > confirmation

---

## 🔐 Sécurité

✅ **RLS Policies** : Seul l'utilisateur propriétaire du devis peut voir les signatures
✅ **Tokens uniques** : Impossible de deviner un lien de signature
✅ **Expiration** : Les liens expirent après 30 jours (configurable)
✅ **IP logging** : L'IP et le user-agent sont enregistrés pour audit
✅ **HTTPS obligatoire** : Nécessaire pour la signature électronique

---

## 📊 Statuts du devis

Le champ `status` des devis accepte maintenant :
- `brouillon` → En cours d'édition
- `envoyé` → Envoyé au client
- `signé` → ✨ NOUVEAU - Signé électroniquement
- `accepté` → Accepté et conversion en commande
- `refusé` → Rejeté par le client
- `expiré` → Dépassé la date de validité
- `validé` → Final (après signature ou acceptation)

---

## 🗄️ Données enregistrées

### Table: `quote_signatures`
```
id            → UUID unique
quote_id      → Référence au devis
signature_token → Token d'accès au formulaire
client_firstname → Prénom du signataire
client_lastname  → Nom du signataire
client_email     → Email du signataire
signature_data   → Image PNG (base64)
ip_address       → IP du client
user_agent       → Browser info
created_at       → Timestamp
```

---

## 🔧 Variables d'environnement

Vérifiez que votre `.env` contient :

```
# URL publique pour les liens de signature
PUBLIC_URL=https://votredomaine.com

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# Resend (pour envoyer les emails)
RESEND_API_KEY=...
SENDER_EMAIL=...
```

---

## ✅ Checklist d'implémentation

- [x] Créer les tables Supabase
- [x] Créer les endpoints API
- [x] Créer le composant de signature React
- [x] Créer la page publique `/sign-quote/:token`
- [x] Modifier l'endpoint d'envoi d'email
- [ ] **À FAIRE** : Tester en développement (npm run dev)
- [ ] **À FAIRE** : Exécuter les migrations Supabase
- [ ] **À FAIRE** : Intégrer dans l'interface QuotesPage
- [ ] **À FAIRE** : Tester le workflow complet

---

## 🐛 Dépannage

### "Lien de signature invalide ou expiré"
→ Le token n'existe pas dans la base ou > 30 jours

### "Ce devis a déjà été signé"
→ Le devis peut être signé une seule fois

### "Erreur lors de l'enregistrement de la signature"
→ Vérifier que `quote_signatures` table existe (migration exécutée)

### Email n'inclut pas le lien de signature
→ Vérifier que `quoteId` et `userId` sont passés à l'endpoint

---

## 📝 Exemple complet d'intégration

Dans `QuotesPage.tsx` ou le formulaire d'envoi :

```typescript
// 1. Quand on envoie un devis
const handleSendQuote = async (quoteId: string) => {
  const quote = quotes.find(q => q.id === quoteId);
  const userProfile = ... // récupérer l'utilisateur

  const response = await fetch('/api/send-quote-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: quote.client_email,
      pdfBase64: pdfData,
      quoteId: quote.id,
      userId: userProfile.id,
      htmlContent: `
        <h2>Votre devis est prêt</h2>
        <p>Veuillez consulter et signer votre devis.</p>
        <p>${userProfile.company_name}</p>
      `
    })
  });

  if (response.ok) {
    // Mettre à jour le statut du devis à "envoyé"
    await updateQuoteStatus(quoteId, 'envoyé');
    toast.success('Devis envoyé avec lien de signature');
  }
};

// 2. Plus tard, vérifier le statut
const quote = await supabase
  .from('quotes')
  .select('*')
  .eq('id', quoteId)
  .single();

console.log(quote.status); // "signé" si le client a signé
console.log(quote.accepted_at); // timestamp de la signature
```

---

## 🎓 Prochaines étapes optionnelles

1. **Signature qualifiée (eIDAS)** → Intégrer Yousign ou Universign pour plus de conformité légale
2. **Webhooks** → Notifier l'artisan quand un devis est signé
3. **Archivage automatique** → Créer une facture automatiquement après signature
4. **Multi-signatures** → Permettre plusieurs signataires par devis
5. **Horodatage certifié** → Ajouter un timestamp de confiance

---

## ❓ Questions ?

Consultez le code source :
- Backend: `server/routes.ts` (endpoints)
- Frontend: `client/src/components/QuoteSignatureForm.tsx`
- Page publique: `client/src/pages/SignQuotePage.tsx`
- Migrations: `supabase/migrations/quote_signatures.sql`
