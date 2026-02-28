"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

interface QuoteSignatureFormProps {
  quoteId: string;
  signatureToken: string;
  clientEmail?: string | null;
  onSignatureSubmitted?: () => void;
}

export const QuoteSignatureForm: React.FC<QuoteSignatureFormProps> = ({
  quoteId,
  signatureToken,
  clientEmail,
  onSignatureSubmitted,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const email = clientEmail || "";
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialiser le canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1e293b";
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        setHasSignature(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Le prénom est requis.");
      return;
    }
    if (!lastName.trim()) {
      setError("Le nom est requis.");
      return;
    }
    if (!hasSignature) {
      setError("Veuillez signer le document.");
      return;
    }

    setIsSubmitting(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas non disponible");

      const signatureDataBase64 = canvas.toDataURL("image/png");

      const response = await fetch("/api/submit-quote-signature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureToken,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          signatureDataBase64,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        const { error: fallbackError } = await supabase
          .from("quote_signatures")
          .insert({
            quote_id: quoteId || null,
            signature_token: signatureToken,
            client_firstname: firstName.trim(),
            client_lastname: lastName.trim(),
            client_email: email.trim() || null,
            signature_data: signatureDataBase64,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          });

        if (fallbackError) {
          throw new Error(data.message || fallbackError.message || "Erreur lors de l'envoi de la signature.");
        }
      }

      setSuccess(true);
      setFirstName("");
      setLastName("");
      clearSignature();

      if (onSignatureSubmitted) {
        setTimeout(onSignatureSubmitted, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de la signature.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Signature enregistrée !</h3>
        <p className="text-gray-600 mb-4">Merci d'avoir signé le devis. Vous recevrez une confirmation par email.</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Erreur */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Informations du client */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prénom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jean"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dupont"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            disabled={isSubmitting}
          />
        </div>
      </div>


      {/* Zone de signature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Votre signature <span className="text-red-500">*</span>
        </label>
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-md">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-64 cursor-crosshair bg-white block touch-none"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Cliquez et glissez pour signer</p>
      </div>

      {/* Boutons */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={clearSignature}
          disabled={!hasSignature || isSubmitting}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Effacer la signature
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !firstName.trim() || !lastName.trim() || !hasSignature}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "Envoi en cours..." : "Signer et valider"}
        </button>
      </div>
    </motion.form>
  );
};
