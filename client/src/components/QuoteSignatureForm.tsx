"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

interface QuoteSignatureFormProps {
  quoteId: string;
  signatureToken: string;
  prospectEmail?: string;
  onSignatureSubmitted?: () => void;
}

export const QuoteSignatureForm: React.FC<QuoteSignatureFormProps> = ({
  quoteId,
  signatureToken,
  prospectEmail,
  onSignatureSubmitted,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(prospectEmail || "");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mettre à jour l'email si prospectEmail change
  React.useEffect(() => {
    if (prospectEmail) {
      setEmail(prospectEmail);
    }
  }, [prospectEmail]);

  // Initialiser le canvas (prise en charge écrans HD / mobile)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(5, 5, rect.width - 10, rect.height - 10);
      }
    }
  }, []);

  const startDrawing = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1e293b";
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    startDrawing(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draw(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    stopDrawing();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (touch) startDrawing(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) draw(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.changedTouches[0]) stopDrawing();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(5, 5, rect.width - 10, rect.height - 10);
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
        const data = await response.json();
        throw new Error(data.message || "Erreur lors de l'envoi de la signature.");
      }

      setSuccess(true);
      setFirstName("");
      setLastName("");
      setEmail("");
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

      {/* Email */}
      {prospectEmail && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>
      )}
      {!prospectEmail && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email (optionnel)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jean.dupont@email.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Zone de signature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Votre signature <span className="text-red-500">*</span>
        </label>
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-md touch-none">
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ touchAction: "none" }}
            className="w-full h-64 cursor-crosshair bg-white block min-h-[200px]"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Cliquez et glissez pour signer (ou utilisez le doigt sur mobile)</p>
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
