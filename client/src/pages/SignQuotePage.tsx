import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { motion } from "framer-motion";
import { QuoteSignatureForm } from "@/components/QuoteSignatureForm";

interface Quote {
  id: string;
  client_name: string;
  client_email: string;
  project_description: string;
  total_ht: number;
  total_ttc: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subItems?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }>;
}

export default function SignQuotePage() {
  const [match, params] = useRoute("/sign-quote/:token");
  const signatureToken = params?.token as string || "";
  
  const [quote, setQuote] = useState<Quote | null>(null);
    const [clientEmail, setClientEmail] = useState<string | null>(null); // Ensure clientEmail is initialized
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Récupérer les informations du lien de signature depuis l'API
    if (!signatureToken) {
      setError("Token de signature invalide.");
      setLoading(false);
      return;
    }

    const fetchSignatureLink = async () => {
      try {
        const response = await fetch(`/api/signature-link-info/${signatureToken}`);
        if (response.ok) {
          const data = await response.json();
          setClientEmail(data.prospect_email || null);
          if (data.quote) {
            setQuote(data.quote);
          }
        } else {
          const errData = await response.json().catch(() => ({ message: "Lien invalide ou expiré." }));
          setError(errData.message || "Lien invalide ou expiré.");
          setClientEmail(null);
        }
      } catch (err) {
        setError("Impossible de charger les informations du devis.");
        setClientEmail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignatureLink();
  }, [signatureToken]);

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Lien invalide.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500">Veuillez vérifier le lien fourni dans votre email.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Signature confirmée !</h2>
          <p className="text-gray-600 mb-6">
            Merci d'avoir signé le devis. Vous recevrez une confirmation par email.
          </p>
          <p className="text-sm text-gray-500">
            Vous pouvez fermer cette fenêtre.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Signature du devis</h1>
          <p className="text-gray-600">
            Complétez le formulaire ci-dessous pour signer électroniquement votre devis.
          </p>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulaire de signature */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations et signature</h2>
            <QuoteSignatureForm
              quoteId=""
              signatureToken={signatureToken}
              clientEmail={clientEmail}
              onSignatureSubmitted={() => setCompleted(true)}
            />
          </div>

          {/* Informations du devis */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Devis</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Type</p>
                  <p className="text-gray-900 font-medium">Signature électronique</p>
                </div>
                <div>
                  <p className="text-gray-500">Lien unique</p>
                  <p className="text-gray-900 font-mono text-xs break-all">{signatureToken.slice(0, 16)}...</p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-gray-600 text-xs">
                    💡 Une fois signé, ce devis sera marqué comme signé dans notre système.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            © TitanBtp - Signature électronique sécurisée
          </p>
        </div>
      </motion.div>
    </div>
  );
}
