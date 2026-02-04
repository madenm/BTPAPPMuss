import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { Resend } from "resend";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Lazy init: resolve client on first use (after .env is loaded).
let _gemini: GoogleGenAI | null | undefined = undefined;
function getGeminiClient(): GoogleGenAI | null {
  if (_gemini !== undefined) return _gemini;
  let key = (process.env.GEMINI_API_KEY || "").trim();
  if (key && (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  _gemini = key ? new GoogleGenAI({ apiKey: key }) : null;
  return _gemini;
}

/** Extract JSON from response text (raw JSON or ```json ... ``` block). */
function extractJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();
  return trimmed;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const PROJECT_TYPE_LABELS: Record<string, string> = {
    piscine: "Piscine & Spa",
    paysage: "Aménagement paysager",
    menuiserie: "Menuiserie Sur-Mesure",
    renovation: "Rénovation",
    autre: "Autre",
  };

  app.get("/api/ai-status", (_req: Request, res: Response) => {
    res.json({ available: !!getGeminiClient() });
  });

  app.post("/api/parse-quote-description", async (req: Request, res: Response) => {
    const { description, projectType, localisation } = req.body as {
      description?: unknown;
      projectType?: unknown;
      localisation?: unknown;
    };
    if (typeof description !== "string" || !description.trim()) {
      res.status(400).json({ message: "Le champ description (texte) est requis et ne doit pas être vide." });
      return;
    }
    const trimmed = description.trim();
    const typeLabel =
      typeof projectType === "string" && projectType.trim()
        ? PROJECT_TYPE_LABELS[projectType.trim()] ?? projectType.trim()
        : "Non précisé";
    const locValue =
      typeof localisation === "string" && localisation.trim()
        ? localisation.trim()
        : "France";

    const userMessage = [
      "Tu rédiges ce devis comme un expert en estimation de travaux de " + typeLabel + " avec 20 ans d'expérience.",
      "",
      "TYPE DE PROJET: " + typeLabel,
      "DESCRIPTION DÉTAILLÉE: " + trimmed,
      "LOCALISATION: " + locValue,
      "",
      "INSTRUCTIONS - TRÈS IMPORTANT:",
      "1. ANALYSE tout le projet : utilise le TYPE DE PROJET et la DESCRIPTION pour générer UNIQUEMENT des lignes en lien direct avec ce projet. Adapte les postes au type : Aménagement paysager → terrassement, dallage, terrasse, plantation, gazon, haies, clôture, éclairage extérieur ; Piscine → coque, liner, filtration, terrassement bassin ; Rénovation → peinture, carrelage, plomberie, électricité, démolition/dépose ; Menuiserie → portes, fenêtres, parquet, pose.",
      "2. EXTRAIS les dimensions de la description (surface m², longueurs) et calcule les quantités en conséquence.",
      "3. Minimum 15 lignes. Chaque ligne : description SPÉCIFIQUE au projet, quantité RÉALISTE, unité (m², m³, m, jours, forfait, u, etc.), prix RÉALISTE France 2026 HT.",
      "4. Ne mets JAMAIS de lignes génériques ou hors sujet : uniquement des postes cohérents avec le type et la description.",
      "",
      "Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, au format : { \"lignes\": [ { \"description\": \"string\", \"quantite\": number, \"unite\": \"string\", \"prix_unitaire\": number } ] }",
    ].join("\n");

    const systemInstruction = `Tu es un spécialiste en estimation de travaux (BTP, rénovation, piscines, aménagement paysager, menuiserie). Tu produis un devis RÉELLEMENT REPRÉSENTATIF de ce qu'un spécialiste rédigerait : tout est dérivé de la description du projet, sans template.

Règles strictes :
- Réponds UNIQUEMENT avec un JSON valide. Aucun texte avant ou après.
- Format exact : { "lignes": [ { "description": "string détaillé", "quantite": number, "unite": "m²|m³|kg|m|jours|forfait|u|L|etc.", "prix_unitaire": number } ] }
- Tu lis UNIQUEMENT la description du projet (et le type si fourni). Tu DÉCOMPOSES le travail en étapes et postes nécessaires pour obtenir exactement le résultat décrit.
- Tu CALCULES les quantités (surfaces, longueurs, volumes, jours, etc.) à partir des informations explicites ou implicites dans la description. Chaque ligne doit être justifiable par la description.
- Pas de modèle type template : pas de lignes génériques ou réutilisables. Chaque ligne doit être SPÉCIFIQUE au projet décrit (dimensions, matériaux mentionnés, travaux décrits). Prix unitaire HT réaliste France 2026.`;

    const geminiClient = getGeminiClient();
    if (!geminiClient) {
      res.status(503).json({
        message:
          "Analyse par un spécialiste requiert GEMINI_API_KEY. Ajoutez la clé dans le fichier .env à la racine du projet (créez-en une sur https://aistudio.google.com/app/apikey) puis redémarrez le serveur, ou décochez 'Utiliser l'analyse IA' pour saisir le devis manuellement.",
      });
      return;
    }
    try {
      // Modèles supportés par l'API (v1beta) : gemini-2.5-flash, gemini-2.0-flash (1.5-flash n'existe pas → 404)
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
      let raw = "";
      let lastErr: unknown = null;
      for (const model of modelsToTry) {
        try {
          const response = await geminiClient.models.generateContent({
            model,
            contents: userMessage,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          });
          raw = response.text ?? "";
          if (raw) break;
        } catch (e) {
          lastErr = e;
          const status = e && typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : undefined;
          if (status === 404) continue;
          throw e;
        }
      }
      if (!raw && lastErr) throw lastErr;
      raw = raw || "";
      if (!raw || typeof raw !== "string") {
        res.status(502).json({ message: "Réponse vide de l'IA." });
        return;
      }
      const jsonStr = extractJsonFromResponse(raw);
      type LigneRaw = { description?: string; quantite?: number; unite?: string; prix_unitaire?: number };
      let parsed: { lignes?: LigneRaw[] };
      try {
        parsed = JSON.parse(jsonStr) as typeof parsed;
      } catch {
        res.status(502).json({ message: "Réponse IA invalide (JSON)." });
        return;
      }
      const lignes = Array.isArray(parsed.lignes) ? parsed.lignes : [];
      const items = lignes
        .map((l) => {
          const desc = typeof l.description === "string" ? l.description.trim() : "";
          const qty = typeof l.quantite === "number" && l.quantite >= 0 ? l.quantite : 0;
          const unit = typeof l.unite === "string" ? l.unite.trim() : "";
          const price = typeof l.prix_unitaire === "number" && l.prix_unitaire >= 0 ? l.prix_unitaire : 0;
          const descriptionWithUnit = unit ? `${desc} (${unit})` : desc;
          return {
            description: descriptionWithUnit,
            quantity: qty,
            unitPrice: price,
            subItems: [] as { description: string; quantity: number; unitPrice: number; total: number }[],
          };
        })
        .filter((row) => row.description.length > 0);
      res.status(200).json({ items });
    } catch (err: unknown) {
      const status = err && typeof (err as { status?: number }).status === "number" ? (err as { status: number }).status : undefined;
      const errMessage = err instanceof Error ? err.message : String(err ?? "");
      const errLower = errMessage.toLowerCase();
      const looksLikeInvalidKey =
        status === 403 ||
        status === 401 ||
        errLower.includes("invalid") ||
        errLower.includes("api key") ||
        errLower.includes("permission") ||
        errLower.includes("not enabled");
      const message = looksLikeInvalidKey
        ? "Clé Gemini invalide ou accès refusé. Vérifiez GEMINI_API_KEY sur https://aistudio.google.com/app/apikey."
        : status === 404
          ? "Modèle IA indisponible. Réessayez plus tard ou décochez « Utiliser l'analyse IA »."
          : status === 429
            ? "Quota Gemini dépassé. Réessayez demain ou décochez « Utiliser l'analyse IA » pour saisir le devis manuellement."
            : status === 401 || status === 402 || status === 403
              ? "Clé Gemini invalide ou accès refusé. Vérifiez GEMINI_API_KEY sur https://aistudio.google.com/app/apikey."
              : "L'analyse IA est temporairement indisponible.";
      res.status(503).json({ message });
    }
  });

  app.post("/api/send-quote-email", async (req: Request, res: Response) => {
    const { to, fromEmail, pdfBase64, fileName, htmlContent } = req.body as {
      to?: string;
      fromEmail?: string | null;
      pdfBase64?: string;
      fileName?: string;
      htmlContent?: string | null;
    };

    if (!to || typeof to !== "string" || !to.trim()) {
      res.status(400).json({ message: "Destinataire (to) requis." });
      return;
    }
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      res.status(400).json({ message: "Pièce jointe PDF (pdfBase64) requise." });
      return;
    }

    // En mode test : envoyer tous les mails à l'adresse définie (ex. Resend n'autorise qu'à soi-même sans domaine)
    const toAddress = (process.env.RESEND_TEST_EMAIL || "").trim() || to.trim();
    const attachmentFilename = fileName && String(fileName).trim() ? String(fileName).trim() : "devis.pdf";
    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    // --- Resend en priorité (nécessite domaine vérifié pour envoyer à des prospects) ---
    if (resendApiKey) {
      const unverifiableDomains = [
        "outlook.fr", "outlook.com", "hotmail.fr", "hotmail.com", "live.fr", "live.com",
        "gmail.com", "googlemail.com", "yahoo.fr", "yahoo.com", "orange.fr", "free.fr", "wanadoo.fr",
      ];
      const fromAddress = fromEmail && String(fromEmail).trim() ? String(fromEmail).trim() : "";
      const fromDomain = fromAddress.includes("@") ? fromAddress.split("@")[1]?.toLowerCase() : "";
      const useDefaultSender = !fromAddress || (fromDomain && unverifiableDomains.includes(fromDomain));

      const from = useDefaultSender
        ? (process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev")
        : fromAddress;

      const resend = new Resend(resendApiKey);

      try {
        const buffer = Buffer.from(pdfBase64, "base64");
        const { data, error } = await resend.emails.send({
          from,
          to: toAddress,
          subject: "Votre devis",
          html: (htmlContent && String(htmlContent).trim()) || "<p>Veuillez trouver ci-joint votre devis.</p>",
          attachments: [{ filename: attachmentFilename, content: buffer }],
        });

        if (error) {
          const errMsg = error.message || "";
          if (
            errMsg.includes("only send testing emails") ||
            errMsg.includes("verify a domain") ||
            errMsg.includes("your own email address")
          ) {
            res.status(403).json({
              message:
                "Avec Resend, l'envoi à des prospects nécessite un domaine vérifié. Option gratuite sans domaine : utilisez Brevo. Ajoutez BREVO_API_KEY et SENDER_EMAIL dans le .env, puis vérifiez l'expéditeur sur https://app.brevo.com/senders/list. Voir le README.",
            });
            return;
          }
          res.status(500).json({ message: errMsg || "Erreur lors de l'envoi de l'email." });
          return;
        }
        res.status(200).json({ ok: true, id: data?.id });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email.";
        res.status(500).json({ message });
        return;
      }
    }

    // --- Brevo (300 emails/jour, pas de domaine requis) ---
    if (brevoApiKey) {
      const senderEmail =
        (fromEmail && String(fromEmail).trim()) ||
        process.env.SENDER_EMAIL ||
        process.env.BREVO_FROM ||
        "";
      const senderName = process.env.SENDER_NAME || "Aos Rénov";
      if (!senderEmail) {
        res.status(400).json({
          message:
            "Avec Brevo, définissez SENDER_EMAIL ou BREVO_FROM dans le .env (ou configurez votre email dans le CRM), puis ajoutez et vérifiez cet expéditeur sur https://app.brevo.com/senders/list (code à 6 chiffres envoyé à votre adresse).",
        });
        return;
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: toAddress, name: toAddress.split("@")[0] || "" }],
            subject: "Votre devis",
            htmlContent: (htmlContent && String(htmlContent).trim()) || "<p>Veuillez trouver ci-joint votre devis.</p>",
            attachment: [{ content: pdfBase64, name: attachmentFilename }],
          }),
        });
        const brevoData = (await brevoRes.json()) as { messageId?: string; code?: string; message?: string };
        if (!brevoRes.ok) {
          const msg =
            brevoData.message ||
            (brevoData.code ? `Brevo: ${brevoData.code}` : "Erreur lors de l'envoi de l'email.");
          res.status(brevoRes.status >= 500 ? 502 : 400).json({ message: msg });
          return;
        }
        res.status(200).json({ ok: true, id: brevoData.messageId });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email.";
        res.status(500).json({ message });
        return;
      }
    }

    // --- Aucun service configuré ---
    res.status(503).json({
      message:
        "Aucun service email configuré. Priorité : Resend (domaine vérifié) — ajoutez RESEND_API_KEY, SENDER_EMAIL ou RESEND_FROM dans le .env. Alternative gratuite sans domaine : Brevo — créez un compte sur https://www.brevo.com, récupérez une clé API, ajoutez BREVO_API_KEY et SENDER_EMAIL, puis vérifiez l'expéditeur sur https://app.brevo.com/senders/list.",
    });
  });

  // POST /api/send-followup-email - Envoyer un email de relance (sans pièce jointe)
  app.post("/api/send-followup-email", async (req: Request, res: Response) => {
    const { to, subject, htmlContent, fromEmail } = req.body as {
      to?: string;
      subject?: string;
      htmlContent?: string | null;
      fromEmail?: string | null;
    };

    if (!to || typeof to !== "string" || !to.trim()) {
      res.status(400).json({ message: "Destinataire (to) requis." });
      return;
    }

    const toAddress = (process.env.RESEND_TEST_EMAIL || "").trim() || to.trim();
    const subjectText = subject && String(subject).trim() ? String(subject).trim() : "Relance - Votre devis";
    const html = (htmlContent && String(htmlContent).trim()) ? String(htmlContent).trim() : "<p>Bonjour, je souhaite faire un suivi concernant notre échange précédent.</p>";

    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      const unverifiableDomains = [
        "outlook.fr", "outlook.com", "hotmail.fr", "hotmail.com", "live.fr", "live.com",
        "gmail.com", "googlemail.com", "yahoo.fr", "yahoo.com", "orange.fr", "free.fr", "wanadoo.fr",
      ];
      const fromAddr = fromEmail && String(fromEmail).trim() ? String(fromEmail).trim() : "";
      const fromDomain = fromAddr.includes("@") ? fromAddr.split("@")[1]?.toLowerCase() : "";
      const useDefaultSender = !fromAddr || (fromDomain && unverifiableDomains.includes(fromDomain));
      const from = useDefaultSender
        ? (process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev")
        : fromAddr;

      try {
        const resend = new Resend(resendApiKey);
        const { data, error } = await resend.emails.send({
          from,
          to: toAddress,
          subject: subjectText,
          html,
        });

        if (error) {
          const errMsg = error.message || "";
          if (
            errMsg.includes("only send testing emails") ||
            errMsg.includes("verify a domain") ||
            errMsg.includes("your own email address")
          ) {
            res.status(403).json({
              message:
                "Avec Resend, l'envoi à des prospects nécessite un domaine vérifié. Utilisez RESEND_TEST_EMAIL pour les tests ou Brevo.",
            });
            return;
          }
          res.status(500).json({ message: errMsg || "Erreur lors de l'envoi de l'email." });
          return;
        }
        res.status(200).json({ ok: true, id: data?.id });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email.";
        res.status(500).json({ message });
        return;
      }
    }

    if (brevoApiKey) {
      const senderEmail =
        (fromEmail && String(fromEmail).trim()) ||
        process.env.SENDER_EMAIL ||
        process.env.BREVO_FROM ||
        "";
      const senderName = process.env.SENDER_NAME || "Aos Rénov";
      if (!senderEmail) {
        res.status(400).json({
          message: "SENDER_EMAIL ou BREVO_FROM requis pour Brevo.",
        });
        return;
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: toAddress, name: toAddress.split("@")[0] || "" }],
            subject: subjectText,
            htmlContent: html,
          }),
        });
        const brevoData = (await brevoRes.json()) as { messageId?: string; code?: string; message?: string };
        if (!brevoRes.ok) {
          res.status(brevoRes.status >= 500 ? 502 : 400).json({
            message: brevoData.message || "Erreur lors de l'envoi de l'email.",
          });
          return;
        }
        res.status(200).json({ ok: true, id: brevoData.messageId });
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email.";
        res.status(500).json({ message });
        return;
      }
    }

    res.status(503).json({
      message: "Aucun service email configuré (RESEND_API_KEY ou BREVO_API_KEY).",
    });
  });

  // ===== Routes API Factures =====
  const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://hvnjlxxcxfxvuwlmnwtw.supabase.co";
  // Server must use service_role key so RLS does not block (auth.uid() is null server-side).
  const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();

  function getSupabaseClient() {
    if (!SUPABASE_SERVICE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_KEY is required for the server (factures, envoi email, etc.). Get it from Supabase Dashboard > Settings > API > service_role and add it to .env"
      );
    }
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  // GET /api/invoices - Liste des factures avec filtres
  app.get("/api/invoices", async (req: Request, res: Response) => {
    const { userId, clientId, chantierId, status, year } = req.query as {
      userId?: string;
      clientId?: string;
      chantierId?: string;
      status?: string;
      year?: string;
    };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false });

      if (clientId) query = query.eq("client_id", clientId);
      if (chantierId) query = query.eq("chantier_id", chantierId);
      if (status) query = query.eq("status", status);
      if (year) {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        query = query.gte("invoice_date", yearStart).lte("invoice_date", yearEnd);
      }

      const { data: invoices, error } = await query;

      if (error) {
        res.status(500).json({ message: error.message });
        return;
      }

      // Charger les paiements pour chaque facture
      const invoicesWithPayments = await Promise.all(
        (invoices || []).map(async (invoice: any) => {
          const { data: payments } = await supabase
            .from("payments")
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("payment_date", { ascending: false });

          const paidAmount = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
          return {
            ...invoice,
            payments: payments || [],
            paidAmount,
            remainingAmount: invoice.total_ttc - paidAmount,
          };
        })
      );

      res.json(invoicesWithPayments);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // GET /api/invoices/:id - Détail d'une facture
  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (error || !invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: false });

      const paidAmount = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);

      res.json({
        ...invoice,
        payments: payments || [],
        paidAmount,
        remainingAmount: invoice.total_ttc - paidAmount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // POST /api/invoices - Créer une facture
  app.post("/api/invoices", async (req: Request, res: Response) => {
    const { userId, ...payload } = req.body as {
      userId: string;
      quote_id?: string | null;
      chantier_id?: string | null;
      client_id?: string | null;
      client_name: string;
      client_email?: string | null;
      client_phone?: string | null;
      client_address?: string | null;
      invoice_date: string;
      due_date: string;
      payment_terms: string;
      items: any[];
      subtotal_ht: number;
      tva_amount: number;
      total_ttc: number;
      status?: string;
      notes?: string | null;
    };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Générer le numéro de facture
      const { data: invoiceNumber, error: numError } = await supabase.rpc("generate_invoice_number", {
        p_user_id: userId,
      });

      if (numError || !invoiceNumber) {
        res.status(500).json({ message: "Erreur génération numéro facture: " + (numError?.message || "") });
        return;
      }

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          invoice_number: invoiceNumber,
          quote_id: payload.quote_id ?? null,
          chantier_id: payload.chantier_id ?? null,
          client_id: payload.client_id ?? null,
          client_name: payload.client_name,
          client_email: payload.client_email ?? null,
          client_phone: payload.client_phone ?? null,
          client_address: payload.client_address ?? null,
          invoice_date: payload.invoice_date,
          due_date: payload.due_date,
          payment_terms: payload.payment_terms,
          items: payload.items,
          subtotal_ht: payload.subtotal_ht,
          tva_amount: payload.tva_amount,
          total_ttc: payload.total_ttc,
          status: payload.status || "brouillon",
          notes: payload.notes ?? null,
        })
        .select("*")
        .single();

      if (error || !invoice) {
        res.status(500).json({ message: error?.message || "Erreur création facture" });
        return;
      }

      res.json(invoice);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // PUT /api/invoices/:id - Modifier une facture
  app.put("/api/invoices/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, ...payload } = req.body as {
      userId: string;
      [key: string]: any;
    };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Vérifier que la facture existe et n'est pas payée/annulée
      const { data: existing } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      if (existing.status === "payée" || existing.status === "annulée") {
        res.status(400).json({ message: "Impossible de modifier une facture payée ou annulée" });
        return;
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (payload.chantier_id !== undefined) updateData.chantier_id = payload.chantier_id ?? null;
      if (payload.client_id !== undefined) updateData.client_id = payload.client_id ?? null;
      if (payload.client_name !== undefined) updateData.client_name = payload.client_name;
      if (payload.client_email !== undefined) updateData.client_email = payload.client_email ?? null;
      if (payload.client_phone !== undefined) updateData.client_phone = payload.client_phone ?? null;
      if (payload.client_address !== undefined) updateData.client_address = payload.client_address ?? null;
      if (payload.invoice_date !== undefined) updateData.invoice_date = payload.invoice_date;
      if (payload.due_date !== undefined) updateData.due_date = payload.due_date;
      if (payload.payment_terms !== undefined) updateData.payment_terms = payload.payment_terms;
      if (payload.items !== undefined) updateData.items = payload.items;
      if (payload.subtotal_ht !== undefined) updateData.subtotal_ht = payload.subtotal_ht;
      if (payload.tva_amount !== undefined) updateData.tva_amount = payload.tva_amount;
      if (payload.total_ttc !== undefined) updateData.total_ttc = payload.total_ttc;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.notes !== undefined) updateData.notes = payload.notes ?? null;

      const { data: invoice, error } = await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error || !invoice) {
        res.status(500).json({ message: error?.message || "Erreur modification facture" });
        return;
      }

      res.json(invoice);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // POST /api/invoices/:id/payments - Enregistrer un paiement
  app.post("/api/invoices/:id/payments", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, amount, payment_date, payment_method, reference, notes } = req.body as {
      userId: string;
      amount: number;
      payment_date: string;
      payment_method: string;
      reference?: string | null;
      notes?: string | null;
    };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Vérifier la facture et calculer le montant restant
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      const { data: payments } = await supabase.from("payments").select("*").eq("invoice_id", id);
      const paidAmount = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const remainingAmount = invoice.total_ttc - paidAmount;

      if (amount > remainingAmount) {
        res.status(400).json({ message: `Montant supérieur au montant restant (${remainingAmount.toFixed(2)} €)` });
        return;
      }

      // Insérer le paiement
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          invoice_id: id,
          user_id: userId,
          amount,
          payment_date,
          payment_method,
          reference: reference ?? null,
          notes: notes ?? null,
        })
        .select("*")
        .single();

      if (error || !payment) {
        res.status(500).json({ message: error?.message || "Erreur enregistrement paiement" });
        return;
      }

      // Mettre à jour le statut de la facture
      const newPaidAmount = paidAmount + amount;
      let newStatus = invoice.status;
      if (newPaidAmount >= invoice.total_ttc) {
        newStatus = "payée";
      } else if (newPaidAmount > 0) {
        newStatus = "partiellement_payée";
      }

      if (newStatus !== invoice.status) {
        await supabase.from("invoices").update({ status: newStatus }).eq("id", id);
      }

      res.json(payment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // DELETE /api/invoices/:id/payments/:paymentId - Supprimer un paiement
  app.delete("/api/invoices/:id/payments/:paymentId", async (req: Request, res: Response) => {
    const { id, paymentId } = req.params;
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Supprimer le paiement
      const { error } = await supabase.from("payments").delete().eq("id", paymentId).eq("user_id", userId);

      if (error) {
        res.status(500).json({ message: error.message });
        return;
      }

      // Recalculer le statut de la facture
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
      if (invoice) {
        const { data: payments } = await supabase.from("payments").select("*").eq("invoice_id", id);
        const paidAmount = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
        let newStatus = invoice.status;
        if (paidAmount === 0) {
          newStatus = invoice.status === "envoyée" ? "envoyée" : "brouillon";
        } else if (paidAmount < invoice.total_ttc) {
          newStatus = "partiellement_payée";
        } else {
          newStatus = "payée";
        }

        if (newStatus !== invoice.status) {
          await supabase.from("invoices").update({ status: newStatus }).eq("id", id);
        }
      }

      res.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // POST /api/invoices/:id/send-email - Envoyer facture par email
  app.post("/api/invoices/:id/send-email", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, to, subject, message, pdfBase64 } = req.body as {
      userId: string;
      to?: string;
      subject?: string;
      message?: string;
      pdfBase64?: string;
    };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }
    if (!to || typeof to !== "string" || !to.trim()) {
      res.status(400).json({ message: "Destinataire (to) requis." });
      return;
    }
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      res.status(400).json({ message: "PDF (pdfBase64) requis." });
      return;
    }

    // En mode test : envoyer tous les mails à l'adresse définie (ex. Resend n'autorise qu'à soi-même sans domaine)
    const toAddress = (process.env.RESEND_TEST_EMAIL || "").trim() || to.trim();

    try {
      const supabase = getSupabaseClient();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", userId).single();

      if (!invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      // Utiliser la même logique que pour les devis
      const brevoApiKey = process.env.BREVO_API_KEY;
      const resendApiKey = process.env.RESEND_API_KEY;
      const attachmentFilename = `facture-${invoice.invoice_number}.pdf`;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const buffer = Buffer.from(pdfBase64, "base64");
        const { data, error } = await resend.emails.send({
          from: process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev",
          to: toAddress,
          subject: subject || `Facture ${invoice.invoice_number}`,
          html: message || `<p>Veuillez trouver ci-joint votre facture ${invoice.invoice_number}.</p>`,
          attachments: [{ filename: attachmentFilename, content: buffer }],
        });

        if (error) {
          res.status(500).json({ message: error.message || "Erreur envoi email" });
          return;
        }

        // Mettre à jour le statut si brouillon
        if (invoice.status === "brouillon") {
          await supabase.from("invoices").update({ status: "envoyée" }).eq("id", id);
        }

        res.json({ ok: true, id: data?.id });
        return;
      }

      if (brevoApiKey) {
        const senderEmail = process.env.SENDER_EMAIL || process.env.BREVO_FROM || "";
        const senderName = process.env.SENDER_NAME || "Aos Rénov";
        if (!senderEmail) {
          res.status(400).json({ message: "SENDER_EMAIL requis pour Brevo" });
          return;
        }

        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: toAddress, name: toAddress.split("@")[0] || "" }],
            subject: subject || `Facture ${invoice.invoice_number}`,
            htmlContent: message || `<p>Veuillez trouver ci-joint votre facture ${invoice.invoice_number}.</p>`,
            attachment: [{ content: pdfBase64, name: attachmentFilename }],
          }),
        });

        const brevoData = (await brevoRes.json()) as { messageId?: string; code?: string; message?: string };
        if (!brevoRes.ok) {
          res.status(brevoRes.status >= 500 ? 502 : 400).json({ message: brevoData.message || "Erreur envoi email" });
          return;
        }

        if (invoice.status === "brouillon") {
          await supabase.from("invoices").update({ status: "envoyée" }).eq("id", id);
        }

        res.json({ ok: true, id: brevoData.messageId });
        return;
      }

      res.status(503).json({ message: "Aucun service email configuré" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // GET /api/invoices/:id/pdf - Générer PDF (retourne base64)
  app.get("/api/invoices/:id/pdf", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", userId).single();

      if (!invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      // Récupérer les infos entreprise depuis user_profiles
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_address, company_city, company_phone, company_email, company_siret")
        .eq("id", userId)
        .single();

      // Le PDF sera généré côté client, cette route peut servir de proxy si nécessaire
      // Pour l'instant, on retourne juste les données nécessaires
      res.json({
        invoice,
        companyInfo: profile || {},
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // POST /api/invoices/:id/cancel - Annuler une facture
  app.post("/api/invoices/:id/cancel", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body as { userId: string };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", userId).single();

      if (!invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      if (invoice.status === "payée") {
        res.status(400).json({ message: "Impossible d'annuler une facture payée" });
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .update({
          status: "annulée",
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error || !data) {
        res.status(500).json({ message: error?.message || "Erreur annulation facture" });
        return;
      }

      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  // GET /api/invoices/stats - Statistiques facturation
  app.get("/api/invoices/stats", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (!invoices) {
        res.json({
          totalRevenue: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          overdueAmount: 0,
          invoiceCount: 0,
          paidCount: 0,
          unpaidCount: 0,
        });
        return;
      }

      const today = new Date();
      let totalRevenue = 0;
      let paidAmount = 0;
      let unpaidAmount = 0;
      let overdueAmount = 0;
      let paidCount = 0;
      let unpaidCount = 0;

      for (const invoice of invoices) {
        totalRevenue += invoice.total_ttc;

        const { data: payments } = await supabase.from("payments").select("*").eq("invoice_id", invoice.id);
        const invoicePaidAmount = (payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
        const remainingAmount = invoice.total_ttc - invoicePaidAmount;

        if (invoice.status === "payée") {
          paidAmount += invoice.total_ttc;
          paidCount++;
        } else if (invoice.status === "partiellement_payée") {
          paidAmount += invoicePaidAmount;
          unpaidAmount += remainingAmount;
          unpaidCount++;
        } else if (invoice.status === "envoyée" || invoice.status === "brouillon") {
          unpaidAmount += invoice.total_ttc;
          unpaidCount++;
        }

        const dueDate = new Date(invoice.due_date);
        if (
          dueDate < today &&
          (invoice.status === "envoyée" || invoice.status === "partiellement_payée") &&
          remainingAmount > 0
        ) {
          overdueAmount += remainingAmount;
        }
      }

      res.json({
        totalRevenue,
        paidAmount,
        unpaidAmount,
        overdueAmount,
        invoiceCount: invoices.length,
        paidCount,
        unpaidCount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
