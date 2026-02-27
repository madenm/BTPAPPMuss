import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";

import { generateInvoicePdfBuffer } from "./lib/invoicePdfServer";
import { getArtiprixForMetier } from "./lib/artiprixCatalog";

import { Resend } from "resend";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

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

let _openai: OpenAI | null | undefined = undefined;
function getOpenAIClient(): OpenAI | null {
  if (_openai !== undefined) return _openai;
  let key = (process.env.OPENAI_API_KEY || "").trim();
  if (key && (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  _openai = key ? new OpenAI({ apiKey: key }) : null;
  return _openai;
}

const VISUALIZATION_PROJECT_TYPE_LABELS: Record<string, string> = {
  piscine: "Piscine & Spa",
  paysage: "Aménagement paysager",
  menuiserie: "Menuiserie Extérieure",
  terrasse: "Terrasse & Patio",
};
const VISUALIZATION_STYLE_LABELS: Record<string, string> = {
  moderne: "Moderne",
  traditionnel: "Traditionnel",
  tropical: "Tropical",
  mediterraneen: "Méditerranéen",
};

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

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const PROJECT_TYPE_LABELS: Record<string, string> = {
    piscine: "Piscine & Spa",
    paysage: "Aménagement paysager",
    menuiserie: "Menuiserie Sur-Mesure",
    renovation: "Rénovation",
    autre: "Autre",
  };

  const TYPE_CHANTIER_LABELS: Record<string, string> = {
    piscine: "Piscine & Spa",
    paysage: "Aménagement Paysager",
    menuiserie: "Menuiserie Sur-Mesure",
    renovation: "Rénovation",
    plomberie: "Plomberie",
    maconnerie: "Maçonnerie",
    terrasse: "Terrasse & Patio",
    chauffage: "Chauffage & Climatisation",
    isolation: "Isolation de la charpente",
    electricite: "Électricité",
    peinture: "Peinture & Revêtements",
    autre: "Autre",
  };

  app.get("/api/ai-status", (_req: Request, res: Response) => {
    res.json({
      available: !!getGeminiClient(),
      visualizationAvailable: !!getOpenAIClient(),
    });
  });

  app.post("/api/generate-visualization", async (req: Request, res: Response) => {
    const { imageBase64, imageUrl: imageUrlFromClient, mimeType, projectType, style } = req.body as {
      imageBase64?: string;
      imageUrl?: string;
      mimeType?: string;
      projectType?: string;
      style?: string;
    };
    if (typeof projectType !== "string" || !projectType.trim()) {
      res.status(400).json({ message: "projectType (string) est requis." });
      return;
    }
    if (typeof style !== "string" || !style.trim()) {
      res.status(400).json({ message: "style (string) est requis." });
      return;
    }
    let imageBuffer: Buffer;
    let mime = (typeof mimeType === "string" && mimeType.trim()) ? mimeType.trim() : "image/jpeg";
    if (typeof imageUrlFromClient === "string" && imageUrlFromClient.startsWith("http")) {
      try {
        const imgRes = await fetch(imageUrlFromClient);
        if (!imgRes.ok) {
          res.status(400).json({ message: "Impossible de charger l'image depuis l'URL fournie." });
          return;
        }
        const buf = await imgRes.arrayBuffer();
        imageBuffer = Buffer.from(buf);
        const contentType = imgRes.headers.get("content-type");
        if (contentType?.includes("png")) mime = "image/png";
        else if (contentType?.includes("webp")) mime = "image/webp";
      } catch {
        res.status(400).json({ message: "Impossible de charger l'image depuis l'URL fournie." });
        return;
      }
    } else if (typeof imageBase64 === "string" && imageBase64.trim()) {
      imageBuffer = Buffer.from(imageBase64.trim(), "base64");
    } else {
      res.status(400).json({ message: "imageBase64 ou imageUrl (URL publique) est requis." });
      return;
    }
    const openai = getOpenAIClient();
    if (!openai) {
      res.json({
        imageUrl: `data:${mime};base64,${imageBuffer.toString("base64")}`,
      });
      return;
    }
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const typeLabel = VISUALIZATION_PROJECT_TYPE_LABELS[projectType.trim()] ?? projectType.trim();
    const styleLabel = VISUALIZATION_STYLE_LABELS[style.trim()] ?? style.trim();
    const prompt = `Transforme ce lieu en projet ${typeLabel} avec un style ${styleLabel}. Montre le rendu final réaliste après travaux, en gardant la même perspective et le même cadrage.`;
    try {
      const file = await toFile(imageBuffer, `image.${ext}`, { type: mime });
      let response: Awaited<ReturnType<typeof openai.images.edit>> | null = null;
      const modelsToTry: Array<{ model: "dall-e-2" | "gpt-image-1-mini"; size: "1024x1024" | "auto"; response_format?: "b64_json" }> = [
        { model: "dall-e-2", size: "1024x1024", response_format: "b64_json" },
        { model: "gpt-image-1-mini", size: "auto" },
      ];
      let lastErr: unknown = null;
      for (const opts of modelsToTry) {
        try {
          const fileForCall = await toFile(imageBuffer, `image.${ext}`, { type: mime });
          response = await openai.images.edit({
            image: fileForCall,
            prompt,
            model: opts.model,
            size: opts.size,
            ...(opts.response_format ? { response_format: opts.response_format } : {}),
          });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          continue;
        }
      }
      if (!response) throw lastErr ?? new Error("Aucun modèle OpenAI disponible.");
      const first = response.data?.[0];
      const b64 = first && "b64_json" in first ? (first as { b64_json?: string }).b64_json : (first && "url" in first ? undefined : undefined);
      const url = first && "url" in first ? (first as { url?: string }).url : undefined;
      if (b64 && typeof b64 === "string") {
        res.json({ imageUrl: `data:image/png;base64,${b64}` });
        return;
      }
      if (url && typeof url === "string") {
        res.json({ imageUrl: url });
        return;
      }
      res.status(502).json({ message: "Le serveur OpenAI n'a pas renvoyé d'image. Réessayez." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : "";
      const errStatus = err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : undefined;
      const isRateLimit = /rate limit|quota|429/i.test(message);
      const isBillingLimit = errStatus === 400 && /billing|limit has been reached|credits/i.test(message);
      const is403 = errStatus === 403 || /forbidden|403/i.test(message);
      const isAuth = /api_key|401|403|invalid/i.test(message);
      const userMessage = isBillingLimit
        ? "Limite de facturation OpenAI atteinte. Rechargez des crédits sur platform.openai.com (Billing) ou réessayez plus tard."
        : is403
          ? "OpenAI a refusé l'accès (403). Vérifiez que votre clé a accès à l'API Images et que votre compte a des crédits (platform.openai.com)."
          : isAuth
            ? "Clé OpenAI invalide ou expirée. Vérifiez OPENAI_API_KEY dans .env."
            : isRateLimit
              ? "Quota OpenAI dépassé. Réessayez plus tard."
              : "La génération de l'image a échoué. Réessayez.";
      res.status(502).json({ message: userMessage });
    }
  });

  app.post("/api/parse-quote-description", async (req: Request, res: Response) => {
    const { description, projectType, localisation, questionnaireAnswers } = req.body as {
      description?: unknown;
      projectType?: unknown;
      localisation?: unknown;
      questionnaireAnswers?: Record<string, string>;
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

    const formattedAnswers =
      questionnaireAnswers &&
      typeof questionnaireAnswers === "object" &&
      Object.keys(questionnaireAnswers).length > 0
        ? Object.entries(questionnaireAnswers)
            .filter(([, v]) => v != null && String(v).trim() !== "")
            .map(([k, v]) => `${k}: ${String(v).trim()}`)
            .join("\n")
        : "";

    let userTariffsBlock = "";
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hvnjlxxcxfxvuwlmnwtw.supabase.co";
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
    if (token && supabaseServiceKey) {
      try {
        const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user: authUser } } = await supabaseServer.auth.getUser(token);
        if (authUser?.id) {
          const { data: tariffs } = await supabaseServer
            .from("user_tariffs")
            .select("label, category, unit, price_ht")
            .eq("user_id", authUser.id);
          if (Array.isArray(tariffs) && tariffs.length > 0) {
            const lines = (tariffs as { label?: string; category?: string; unit?: string; price_ht?: number }[])
              .map((t) => `- ${t.label ?? ""} | ${t.category ?? ""} | ${t.unit ?? "u"} | ${Number(t.price_ht ?? 0)} € HT`)
              .join("\n");
            userTariffsBlock = [
              "",
              "--- LISTE DES TARIFS DE L'UTILISATEUR (à utiliser en priorité pour les prix unitaires) ---",
              lines,
              "",
              "Pour chaque ligne du devis, si un tarif correspond (même libellé ou très proche), utilise le prix HT indiqué. Sinon utilise un prix réaliste France 2026 HT.",
            ].join("\n");
          }
        }
      } catch {
        // ignore: continue without user tariffs
      }
    }

    // Référence Artiprix Gros Œuvre / Second Œuvre 2026 — prix indicatifs fourniture + pose HT (€) pour caler les devis réalistes
    const ARTIPRIX_REF = `
PRIX INDICATIFS ARTIPRIX 2026 (fourniture + pose HT) — à utiliser pour des devis réalistes type artisan :
- Gros œuvre : Terrasse béton ~80–85 €/m² | Trottoir béton désactivé 1,20 m ~170 €/ml | Semelle isolée 1 m³ ~300 €/U | Ouverture + linteau porte 215×90 ~765 €/U | Plancher poutrelles entrevous ~130–160 €/m² | Garage 15 m² ~5600 €/U | Massif béton 1×1×0,5 m ~196 €/U | Chaînage 150×200 mm ~36 €/ml.
- Charpente : Rénovation charpente + couverture 45 m² ~10000 €/U | Charpente toiture 103 m² ~8400 €/U | Charpente industrielle 139 m² ~9900 €/U | Redressement + calage charpente ~85 €/m².
- Couverture : Ardoises naturelles Espagne m² ~130–160 €/m² | Tôle galvanisée nervurée m² ~35–48 €/m² | Faîtière simple ~23 €/ml | Closoir ~20–32 €/ml.
- Menuiserie ext. : Révision fenêtre 1 vantail ~34 €/U | Porte-fenêtre bois 215×80 ~830 €/U | Fenêtre bois 2 vantaux 135×100 ~710 €/U | Châssis bois fixe ~350–570 €/U | Remplacement vitrage fenêtre toit ~110–355 €/U.
- Façade : Ravalement complet m² ~46–59 €/m² | Enduit finition taloché m² ~20–28 €/m² | Enduit finition feutré m² ~21–28 €/m² | ITE PSE + ravalement ~165–207 €/m² | Révision menuiseries (dégondage, réglage) ~25–68 €/U.
- Cloisons / plafonds : Contre-cloison 1 plaque BA 13 m² ~36–45 €/m² | Plafond BA 13 m² ~28–52 €/m² | Réfection plafond BA 13 m² ~36 €/m².
- Carrelage : Pose carrelage 30×30 m² ~47–60 €/m² | Pose 80×80 m² ~43–56 €/m² | Faïence douche ~320 €/U | Rénovation carrelage (pose seule) ~95–125 €/m².
- Peinture : Peinture mate/satin phase aqueuse m² ~43–62 €/m² | Enduit finition m² ~20–49 €/m² | Travaux complets ravalement peinture m² ~45–59 €/m².
Unité : m² = mètre carré, ml = mètre linéaire, U = unité, forf = forfait, jour = journée (main d’œuvre ~350–450 € HT/jour).`;

    const userMessage = [
      "Tu rédiges un devis SIMPLE et LISIBLE comme un artisan du bâtiment (pas un catalogue technique).",
      "",
      "TYPE DE PROJET: " + typeLabel,
      "DESCRIPTION: " + trimmed,
      "LOCALISATION: " + locValue,
      ...(formattedAnswers ? ["", "RÉPONSES AU QUESTIONNAIRE:", formattedAnswers] : []),
      "",
      "CONSIGNES:",
      "1. Style ARTISAN : 8 à 18 lignes selon l’ampleur du projet. Libellés COURTS et CLAIRS (ex. « Terrasse béton 30 m² », « Peinture murale mate 45 m² », « Ouverture porte 215×90 »). Pas de phrases longues ni de détails techniques superflus.",
      "2. Quantités : extraire les dimensions de la description (surfaces, longueurs) et les utiliser pour les quantités. Unités : m², ml, U, forfait, jour.",
      "3. Prix : utiliser les FOURCHETTES ARTIPRIX 2026 ci-dessous (prix HT fourniture + pose). Si une liste de TARIFS UTILISATEUR est fournie, les utiliser en priorité pour les lignes correspondantes ; sinon s’aligner sur Artiprix.",
      "4. Uniquement des postes en lien direct avec le projet décrit. Aucune ligne générique ou hors sujet.",
      "5. Utilise les RÉPONSES AU QUESTIONNAIRE pour choisir les postes et les libellés (pièces, type de travaux, matériaux).",
      "",
      "Exemples de libellés type artisan (à imiter) : Terrasse béton 30 m² | Peinture mate 45 m² | Carrelage 20 m² | Ouverture porte 215×90 | Fenêtre 2 vantaux 135×100 | Ravalement façade 80 m² | Main d'œuvre 5 jours.",
      "À éviter : phrases longues, sous-détail technique inutile, lignes Étude, Coordination, Frais de dossier (sauf si explicitement demandé).",
      ARTIPRIX_REF,
      ...(userTariffsBlock ? [userTariffsBlock] : []),
      "",
      "Réponds UNIQUEMENT par un JSON valide, sans texte avant ou après : { \"lignes\": [ { \"description\": \"string\", \"quantite\": number, \"unite\": \"string\", \"prix_unitaire\": number } ] }",
    ].join("\n");

    const systemInstruction = `Tu es un artisan en estimation de travaux (BTP, rénovation, menuiserie, couverture, façade, carrelage, peinture). Tu produis un devis SIMPLE, comme on en voit en vrai : peu de lignes, libellés courts, prix réalistes France 2026 (référence Artiprix Gros Œuvre / Second Œuvre).

Règles :
- Réponds UNIQUEMENT par un JSON valide. Aucun texte avant ou après.
- Format : { "lignes": [ { "description": "libellé court", "quantite": number, "unite": "m²|ml|U|forfait|jour", "prix_unitaire": number } ] }
- Devis ARTISAN : 8 à 18 lignes max, descriptions courtes (ex. "Terrasse béton 30 m²", "Peinture mate 45 m²"). Pas de décomposition excessive ni de jargon inutile.
- Quantités : si la description ou le questionnaire donne des dimensions (surfaces, longueurs), les utiliser pour les quantités (m², ml). Sinon utiliser une quantité raisonnable (1 U, 1 forfait, ou surface/journée estimée) avec un libellé court.
- Prix unitaire HT : utiliser les fourchettes Artiprix 2026 fournies dans le message ; si des tarifs utilisateur sont donnés, les prioriser pour les lignes correspondantes.
- Chaque ligne doit correspondre à un poste réel du projet décrit. Pas de lignes type "honoraires", "frais de dossier", "étude" ou "coordination" (sauf si explicitement demandé).`;

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

  app.post("/api/analyze-estimation-photo", async (req: Request, res: Response) => {
    const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      res.status(400).json({ message: "imageBase64 (string) est requis." });
      return;
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    const mime = typeof mimeType === "string" && mimeType.trim() ? mimeType.trim() : "image/jpeg";
    const geminiClient = getGeminiClient();
    if (!geminiClient) {
      res.status(503).json({
        message:
          "Analyse photo IA indisponible. Configurez GEMINI_API_KEY dans .env (https://aistudio.google.com/app/apikey) puis redémarrez le serveur.",
      });
      return;
    }
    const prompt =
      "Vous êtes un expert en construction/rénovation français avec 20 ans d'expérience.\n\n" +
      "ANALYSE DE PHOTO DE CHANTIER:\n\n" +
      "Décrivez précisément cette zone selon les critères suivants:\n\n" +
      "1. **Description de l'état actuel** (50-100 mots):\n" +
      "   - État général (bon/moyen/mauvais)\n" +
      "   - Matériaux identifiables\n" +
      "   - Dimensions apparentes\n" +
      "   - Obstacles visibles\n" +
      "   - Accès (facile/moyen/difficile)\n\n" +
      "2. **Type de projet probable** (une réponse parmi): Piscine & Spa, Rénovation, Plomberie, Électricité, Peinture & Revêtements, Maçonnerie, Terrasse & Patio, Menuiserie Sur-Mesure, Autre\n\n" +
      "3. **Surface estimée** (en m²): Basée sur repères visibles (portes, fenêtres, etc.). Donnez un nombre ou une fourchette.\n\n" +
      "4. **Points d'attention** (complexité): Accès difficile? Hauteur importante? Matériaux spéciaux? Risques identifiables?\n\n" +
      "RÉPONDEZ EN JSON VALIDE, sans texte avant ou après:\n" +
      JSON.stringify({
        descriptionZone: "string (description précise avec état, matériaux, dimensions, accès)",
        suggestions: {
          typeProjet: "string (ex: Rénovation)",
          typeProjetConfiance: 0.85,
          surfaceEstimee: "string (ex: 25)",
          etatGeneral: "bon | moyen | mauvais",
          complexite: "simple | moyen | complexe",
          acces: "facile | moyen | difficile",
          pointsAttention: ["string", "string"],
        },
      });
    try {
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
      let raw = "";
      let lastErr: unknown = null;
      for (const model of modelsToTry) {
        try {
          const response = await geminiClient.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mime,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            config: {
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
      type AnalyzeSuggestionsRaw = {
        typeProjet?: string | null;
        typeProjetConfiance?: number | null;
        surfaceEstimee?: string | null;
        etatGeneral?: string | null;
        complexite?: string | null;
        acces?: string | null;
        pointsAttention?: unknown;
      };
      type AnalyzeRaw = {
        descriptionZone?: string;
        suggestions?: AnalyzeSuggestionsRaw;
      };
      let parsed: AnalyzeRaw;
      try {
        parsed = JSON.parse(jsonStr) as AnalyzeRaw;
      } catch {
        res.status(502).json({ message: "Réponse IA invalide (JSON)." });
        return;
      }
      const descriptionZone =
        typeof parsed.descriptionZone === "string" && parsed.descriptionZone.trim()
          ? parsed.descriptionZone.trim()
          : "Zone non décrite.";
      const sug = parsed.suggestions && typeof parsed.suggestions === "object" ? parsed.suggestions : undefined;
      const pointsArr = Array.isArray(sug?.pointsAttention)
        ? (sug.pointsAttention as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 10)
        : undefined;
      const suggestions = sug
        ? {
            typeProjet: typeof sug.typeProjet === "string" ? sug.typeProjet.trim() || undefined : undefined,
            typeProjetConfiance: typeof sug.typeProjetConfiance === "number" && sug.typeProjetConfiance >= 0 && sug.typeProjetConfiance <= 1 ? sug.typeProjetConfiance : undefined,
            surfaceEstimee: typeof sug.surfaceEstimee === "string" ? sug.surfaceEstimee.trim() || undefined : undefined,
            etatGeneral: typeof sug.etatGeneral === "string" ? sug.etatGeneral.trim() || undefined : undefined,
            complexite: typeof sug.complexite === "string" ? sug.complexite.trim() || undefined : undefined,
            acces: typeof sug.acces === "string" ? sug.acces.trim() || undefined : undefined,
            pointsAttention: pointsArr && pointsArr.length > 0 ? pointsArr : undefined,
          }
        : undefined;
      res.status(200).json({ descriptionZone, suggestions });
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
        ? "Clé Gemini invalide ou accès refusé. Vérifiez GEMINI_API_KEY."
        : status === 404
          ? "Modèle IA indisponible. Réessayez plus tard."
          : status === 429
            ? "Quota Gemini dépassé. Réessayez plus tard."
            : "L'analyse photo IA est temporairement indisponible.";
      res.status(503).json({ message });
    }
  });

  app.post("/api/estimate-chantier", async (req: Request, res: Response) => {
    const { client, chantierInfo, photoAnalysis, questionnaireAnswers, userTariffs: userTariffsStr } = req.body as {
      client?: { name?: string; email?: string; phone?: string };
      chantierInfo?: { surface?: string | number; materiaux?: string; localisation?: string; delai?: string; metier?: string };
      photoAnalysis?: string;
      questionnaireAnswers?: Record<string, string>;
      userTariffs?: string;
    };
    const surface = chantierInfo?.surface != null ? String(chantierInfo.surface).trim() : "";
    const metier = typeof chantierInfo?.metier === "string" ? chantierInfo.metier.trim() : "";
    if (!surface || !metier) {
      res.status(400).json({ message: "Surface et type de chantier sont requis." });
      return;
    }
    const typeLabel = TYPE_CHANTIER_LABELS[metier] ?? metier;
    const materiauxStr = typeof chantierInfo?.materiaux === "string" ? chantierInfo.materiaux.trim() : "";
    const localisationStr = typeof chantierInfo?.localisation === "string" ? chantierInfo.localisation.trim() : "";
    const delaiStr = typeof chantierInfo?.delai === "string" ? chantierInfo.delai.trim() : "";
    const clientName = typeof client?.name === "string" ? client.name.trim() : "";
    const clientEmail = typeof client?.email === "string" ? client.email.trim() : "";
    const clientPhone = typeof client?.phone === "string" ? client.phone.trim() : "";
    const photoAnalysisStr = typeof photoAnalysis === "string" ? photoAnalysis.trim() : "";
    const questionnaireObj =
      questionnaireAnswers && typeof questionnaireAnswers === "object" && !Array.isArray(questionnaireAnswers)
        ? questionnaireAnswers
        : {};
    const questionnaireEntries = Object.entries(questionnaireObj)
      .filter(([, v]) => typeof v === "string" && v.trim() !== "")
      .map(([k, v]) => k + ": " + (v as string).trim());
    const questionnaireStr =
      questionnaireEntries.length > 0
        ? "RÉPONSES AU QUESTIONNAIRE (détail du projet): " + questionnaireEntries.join(", ")
        : "";

    const tariffsStr = typeof userTariffsStr === "string" ? userTariffsStr.trim() : "";
    const artiprixStr = getArtiprixForMetier(metier);

    const userMessage = [
      "Tu es un expert en estimation de chantiers BTP/rénovation en France. À partir des données ci-dessous, tu DOIS produire une estimation COMPLÈTE au format JSON.",
      "",
      "--- DONNÉES DU CHANTIER ---",
      "Type de projet: " + typeLabel,
      "Surface: " + surface + " m²",
      "Localisation: " + (localisationStr || "France (non précisée)"),
      "Délai souhaité: " + (delaiStr || "Flexible"),
      clientName ? "Client: " + clientName + (clientEmail ? " " + clientEmail : "") + (clientPhone ? " " + clientPhone : "") : "",
      materiauxStr ? "Matériaux / précisions: " + materiauxStr : "",
      photoAnalysisStr ? "Analyse de la photo (état des lieux, accès, complexité): " + photoAnalysisStr : "",
      questionnaireStr ? "Réponses au questionnaire: " + questionnaireStr : "",
      tariffsStr ? "TARIFS DE L'ARTISAN (utilise ces prix en PRIORITÉ quand les matériaux correspondent): " + tariffsStr : "",
      artiprixStr ? "BARÈME ARTIPRIX (prix de référence du marché français, MO+fournitures, à utiliser quand pas de tarif artisan):\n" + artiprixStr : "",
      "",
      "--- INSTRUCTIONS ---",
      "1. Utilise TOUTES les données ci-dessus pour estimer.",
      "2. Priorité des prix: 1) tarifs artisan, 2) barème Artiprix (référence marché), 3) estimation marché. Cite la référence Artiprix quand utilisée.",
      "3. Localisation: Paris/IDF = +10-15%. Accès difficile = +20-30% délai.",
      "4. Règles par défaut: main-d'œuvre 150€/jour/ouvrier, marge 25%, frais généraux 20%, imprévus 15%.",
      "5. Fournis une FOURCHETTE de prix (basse = conditions optimales, haute = imprévus/complexité).",
      "6. Minimum 3 matériaux, 3 outils, 3 recommandations. Aucun tableau vide, aucun 0 pour coutTotal.",
      "",
      "JSON OBLIGATOIRE (pas de texte avant/après):",
      JSON.stringify({
        tempsRealisation: "string",
        materiaux: [{ nom: "string", quantite: "string", prix: 0, prixUnitaire: 0 }],
        outils: ["string"],
        nombreOuvriers: 1,
        coutTotal: 0,
        marge: 0,
        benefice: 0,
        repartitionCouts: { transport: 0, mainOeuvre: 0, materiaux: 0, autres: 0 },
        recommandations: ["string"],
        couts: { materiaux: 0, mainOeuvre: 0, imprevu: 0, fraisGeneraux: 0, margeBrute: 0, prixTTC: 0, fourchetteBasse: 0, fourchetteHaute: 0 },
        confiance: 0.8,
        confiance_explication: "string",
        hypotheses: ["string"],
      }),
    ].filter(Boolean).join("\n");

    const systemInstruction = `Tu es un expert en estimation de chantiers (BTP, rénovation) en France. Tu produis UNIQUEMENT un JSON valide, sans markdown ni texte autour.

CHAMPS OBLIGATOIRES:
- tempsRealisation: string (ex "2 semaines")
- materiaux: tableau ≥3 objets {nom, quantite (string), prix (number), prixUnitaire (number)}
- outils: tableau ≥3 strings
- nombreOuvriers: number ≥1
- coutTotal: number >0
- marge, benefice: number ≥0
- repartitionCouts: {transport, mainOeuvre, materiaux, autres} (numbers, somme ≈ coutTotal)
- recommandations: tableau ≥3 strings
- couts: {materiaux, mainOeuvre, imprevu, fraisGeneraux, margeBrute, prixTTC, fourchetteBasse, fourchetteHaute}
  fourchetteBasse = estimation optimiste (-15%), fourchetteHaute = pessimiste (+20%)
- confiance: number 0-1 (fiabilité de l'estimation)
- confiance_explication: string courte
- hypotheses: tableau de strings (hypothèses utilisées)

Priorité des prix: 1) tarifs de l'artisan, 2) barème Artiprix, 3) prix du marché estimés. Ne renvoie jamais de tableaux vides ni coutTotal à 0.`;

    const geminiClient = getGeminiClient();
    if (!geminiClient) {
      res.status(503).json({
        message:
          "Estimation IA indisponible. Configurez GEMINI_API_KEY dans .env (https://aistudio.google.com/app/apikey) puis redémarrez le serveur.",
      });
      return;
    }
    try {
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
      type MatRaw = { nom?: string; quantite?: string; prix?: number; prixUnitaire?: number; notes?: string };
      type RepRaw = { transport?: number; mainOeuvre?: number; materiaux?: number; autres?: number };
      type OutilLouer = { nom?: string; duree?: string; coutLocation?: number };
      type TempsRaw = string | { dureeEstimee?: string; decomposition?: { preparation?: string; travauxPrincipaux?: string; finitions?: string; imprevu?: string } };
      type OutilsRaw = string[] | { aLouer?: OutilLouer[]; fourniParArtisan?: string[]; estimationLocationTotal?: number };
      type CoutsRaw = { materiaux?: number; mainOeuvre?: number; transportLivraison?: number; locationEquipements?: number; sousTotal?: number; imprevu?: number; coutDeBase?: number; fraisGeneraux?: number; margeBrute?: number; prixTTC?: number };
      type EstimateRaw = {
        tempsRealisation?: TempsRaw;
        materiaux?: MatRaw[];
        outils?: OutilsRaw;
        nombreOuvriers?: number;
        equipe?: { composition?: string; joursPresence?: number; productivite?: string };
        coutTotal?: number;
        marge?: number;
        benefice?: number;
        couts?: CoutsRaw;
        repartitionCouts?: RepRaw;
        recommandations?: string[];
        hypotheses?: string[];
        confiance?: number;
        confiance_explication?: string;
      };
      let parsed: EstimateRaw;
      try {
        parsed = JSON.parse(jsonStr) as EstimateRaw;
      } catch (parseErr) {
        res.status(502).json({ message: "Réponse IA invalide (JSON)." });
        return;
      }
      const tempsRaw = parsed.tempsRealisation;
      let tempsRealisation = "Non estimé";
      let tempsRealisationDecomposition: { preparation?: string; travauxPrincipaux?: string; finitions?: string; imprevu?: string } | undefined;
      if (typeof tempsRaw === "string" && tempsRaw.trim()) {
        tempsRealisation = tempsRaw.trim();
      } else if (tempsRaw && typeof tempsRaw === "object" && typeof (tempsRaw as { dureeEstimee?: string }).dureeEstimee === "string") {
        const tr = tempsRaw as { dureeEstimee: string; decomposition?: { preparation?: string; travauxPrincipaux?: string; finitions?: string; imprevu?: string } };
        tempsRealisation = tr.dureeEstimee.trim();
        if (tr.decomposition && typeof tr.decomposition === "object") tempsRealisationDecomposition = tr.decomposition;
      }
      const materiaux = Array.isArray(parsed.materiaux)
        ? parsed.materiaux.map((m) => ({
            nom: typeof m.nom === "string" ? m.nom.trim() : "Matériau",
            quantite: typeof m.quantite === "string" ? m.quantite.trim() : "1",
            prix: typeof m.prix === "number" && m.prix >= 0 ? m.prix : (typeof m.prixUnitaire === "number" ? m.prixUnitaire : 0),
            prixUnitaire: typeof m.prixUnitaire === "number" && m.prixUnitaire >= 0 ? m.prixUnitaire : undefined,
            notes: typeof m.notes === "string" ? m.notes.trim() || undefined : undefined,
          }))
        : [];
      const rep = parsed.repartitionCouts ?? {};
      const repartitionCouts = {
        transport: Math.round(Number(rep.transport) || 0),
        mainOeuvre: Math.round(Number(rep.mainOeuvre) || 0),
        materiaux: Math.round(Number(rep.materiaux) || 0),
        autres: Math.round(Number(rep.autres) || 0),
      };
      const coutsObj = parsed.couts && typeof parsed.couts === "object" ? parsed.couts : undefined;
      const coutTotal = Math.round(Number(parsed.coutTotal) ?? Number(coutsObj?.coutDeBase) ?? Number(coutsObj?.prixTTC) ?? 0);
      let outils: string[] = [];
      let outilsaLouer: { nom: string; duree?: string; coutLocation?: number }[] | undefined;
      let outilsFournis: string[] | undefined;
      let estimationLocationTotal: number | undefined;
      const out = parsed.outils;
      if (Array.isArray(out)) {
        outils = out.filter((o): o is string => typeof o === "string").slice(0, 15);
      } else if (out && typeof out === "object") {
        const aLouer = Array.isArray((out as { aLouer?: OutilLouer[] }).aLouer) ? (out as { aLouer: OutilLouer[] }).aLouer : [];
        const fournis = Array.isArray((out as { fourniParArtisan?: string[] }).fourniParArtisan) ? (out as { fourniParArtisan: string[] }).fourniParArtisan : [];
        outilsaLouer = aLouer.map((x) => ({ nom: typeof x.nom === "string" ? x.nom : "Équipement", duree: typeof x.duree === "string" ? x.duree : undefined, coutLocation: typeof x.coutLocation === "number" ? x.coutLocation : undefined }));
        outilsFournis = fournis.filter((s): s is string => typeof s === "string").slice(0, 20);
        estimationLocationTotal = typeof (out as { estimationLocationTotal?: number }).estimationLocationTotal === "number" ? (out as { estimationLocationTotal: number }).estimationLocationTotal : undefined;
        outils = [...outilsaLouer.map((o) => o.nom), ...outilsFournis];
      }
      const equipe = parsed.equipe && typeof parsed.equipe === "object" ? parsed.equipe : undefined;
      const hypotheses = Array.isArray(parsed.hypotheses) ? parsed.hypotheses.filter((h): h is string => typeof h === "string").slice(0, 15) : undefined;
      const confiance = typeof parsed.confiance === "number" && parsed.confiance >= 0 && parsed.confiance <= 1 ? parsed.confiance : undefined;
      const confiance_explication = typeof parsed.confiance_explication === "string" ? parsed.confiance_explication.trim() || undefined : undefined;
      let finalMateriaux = materiaux;
      let finalOutils = outils;
      let finalRecommandations = Array.isArray(parsed.recommandations) ? parsed.recommandations.filter((r): r is string => typeof r === "string").slice(0, 10) : [];
      let finalTemps = tempsRealisation;
      let finalCoutTotal = coutTotal;
      let finalMarge = Math.round(Number(parsed.marge) || 0);
      let finalBenefice = Math.round(Number(parsed.benefice) || 0);
      let finalRepartition = repartitionCouts;
      const surfaceNum = Math.max(1, Math.min(1000, Math.round(Number(surface) || 20)));
      if (finalMateriaux.length === 0) {
        finalMateriaux = [
          { nom: "Matériaux principaux (à détailler selon devis)", quantite: "lot", prix: Math.round(surfaceNum * 25), prixUnitaire: undefined, notes: undefined },
          { nom: "Fournitures et consommables", quantite: "lot", prix: Math.round(surfaceNum * 8), prixUnitaire: undefined, notes: undefined },
          { nom: "Équipements de protection", quantite: "lot", prix: Math.round(80 + surfaceNum * 2), prixUnitaire: undefined, notes: undefined },
        ];
      }
      if (finalOutils.length === 0) {
        finalOutils = ["Échelle ou échafaudage", "Niveau à bulle", "Perceuse / visseuse", "Outillage à main", "EPI (gants, lunettes, masque)"];
      }
      if (finalRecommandations.length === 0) {
        finalRecommandations = [
          "Prévoir une marge d'imprévus d'environ 15% sur le délai et le budget.",
          "Vérifier les accès et le stockage des matériaux sur le chantier.",
          "Sécuriser la zone de travail et informer les occupants des nuisances.",
        ];
      }
      if (!finalTemps || finalTemps === "Non estimé") {
        const jours = Math.max(3, Math.min(60, Math.round(surfaceNum * 1.2)));
        finalTemps = jours <= 5 ? "environ " + jours + " jours" : "environ " + Math.ceil(jours / 5) + " semaines";
      }
      if (finalCoutTotal <= 0) {
        const base = surfaceNum * (metier === "piscine" ? 400 : metier === "renovation" ? 120 : metier === "peinture" ? 45 : 80);
        finalCoutTotal = Math.round(base * (localisationStr && /paris|île-de-france|idf|75|92|93|94|78|91|77/i.test(localisationStr) ? 1.15 : 1));
        finalMarge = Math.round(finalCoutTotal * 0.25);
        finalBenefice = Math.round(finalMarge * 0.7);
        finalRepartition = {
          transport: Math.round(finalCoutTotal * 0.05),
          mainOeuvre: Math.round(finalCoutTotal * 0.45),
          materiaux: Math.round(finalCoutTotal * 0.35),
          autres: Math.round(finalCoutTotal * 0.15),
        };
      }
      const analysisResults: Record<string, unknown> = {
        tempsRealisation: finalTemps,
        materiaux: finalMateriaux,
        outils: finalOutils,
        nombreOuvriers: Math.max(1, Math.round(Number(parsed.nombreOuvriers) || 1)),
        coutTotal: finalCoutTotal,
        marge: finalMarge,
        benefice: finalBenefice,
        repartitionCouts: finalRepartition,
        recommandations: finalRecommandations,
      };
      if (tempsRealisationDecomposition) analysisResults.tempsRealisationDecomposition = tempsRealisationDecomposition;
      if (outilsaLouer?.length) analysisResults.outilsaLouer = outilsaLouer;
      if (outilsFournis?.length) analysisResults.outilsFournis = outilsFournis;
      if (estimationLocationTotal != null) analysisResults.estimationLocationTotal = estimationLocationTotal;
      if (equipe) analysisResults.equipe = equipe;
      if (coutsObj) analysisResults.couts = coutsObj;
      if (hypotheses?.length) analysisResults.hypotheses = hypotheses;
      if (confiance != null) analysisResults.confiance = confiance;
      if (confiance_explication) analysisResults.confiance_explication = confiance_explication;
      res.status(200).json(analysisResults);
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
          ? "Modèle IA indisponible. Réessayez plus tard."
          : status === 429
            ? "Quota Gemini dépassé. Réessayez plus tard."
            : status === 401 || status === 402 || status === 403
              ? "Clé Gemini invalide ou accès refusé. Vérifiez GEMINI_API_KEY sur https://aistudio.google.com/app/apikey."
              : "L'estimation IA est temporairement indisponible.";
      res.status(503).json({ message });
    }
  });

  app.post("/api/send-quote-email", async (req: Request, res: Response) => {
    const { to, fromEmail, replyTo, pdfBase64, fileName, htmlContent } = req.body as {
      to?: string;
      fromEmail?: string | null;
      replyTo?: string | null;
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

    // Toujours envoyer au destinataire indiqué (pas de redirection RESEND_TEST_EMAIL)
    const toAddress = to.trim();
    const attachmentFilename = fileName && String(fileName).trim() ? String(fileName).trim() : "devis.pdf";
    const resendApiKey = process.env.RESEND_API_KEY;

    // --- Resend ---
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
        const replyToAddr = replyTo && String(replyTo).trim() ? String(replyTo).trim() : undefined;
        const { data, error } = await resend.emails.send({
          from,
          to: toAddress,
          ...(replyToAddr ? { replyTo: replyToAddr } : {}),
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
                "Avec Resend, l'envoi à des prospects nécessite un domaine vérifié. Ajoutez RESEND_API_KEY, SENDER_EMAIL ou RESEND_FROM dans le .env. Voir le README.",
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

    res.status(503).json({
      message: "Aucun service email configuré. Ajoutez RESEND_API_KEY, SENDER_EMAIL ou RESEND_FROM dans le .env. Voir le README.",
    });
  });

  // POST /api/send-followup-email - Envoyer un email de relance (sans pièce jointe)
  app.post("/api/send-followup-email", async (req: Request, res: Response) => {
    const { to, subject, htmlContent, fromEmail, replyTo } = req.body as {
      to?: string;
      subject?: string;
      htmlContent?: string | null;
      fromEmail?: string | null;
      replyTo?: string | null;
    };

    if (!to || typeof to !== "string" || !to.trim()) {
      res.status(400).json({ message: "Destinataire (to) requis." });
      return;
    }

    // Envoyer au vrai email du contact
    const toAddress = to.trim();
    const subjectText = subject && String(subject).trim() ? String(subject).trim() : "Relance - Votre devis";
    const html = (htmlContent && String(htmlContent).trim()) ? String(htmlContent).trim() : "<p>Bonjour, je souhaite faire un suivi concernant notre échange précédent.</p>";

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
        const replyToAddr = replyTo && String(replyTo).trim() ? String(replyTo).trim() : undefined;
        const { data, error } = await resend.emails.send({
          from,
          to: toAddress,
          ...(replyToAddr ? { replyTo: replyToAddr } : {}),
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
                "Avec Resend, l'envoi à des prospects nécessite un domaine vérifié. Utilisez RESEND_TEST_EMAIL pour les tests.",
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

    res.status(503).json({
      message: "Aucun service email configuré. Ajoutez RESEND_API_KEY dans le .env.",
    });
  });

  // POST /api/generate-quote-signature-link - Générer un lien de signature unique
  app.post("/api/generate-quote-signature-link", async (req: Request, res: Response) => {
    const { quoteId, expirationDays } = req.body as {
      quoteId?: string;
      expirationDays?: number;
    };

    console.log("🔗 [generate-quote-signature-link] Requête reçue - quoteId:", quoteId, "expirationDays:", expirationDays)

    if (!quoteId || typeof quoteId !== "string") {
      console.error("❌ [generate-quote-signature-link] quoteId manquant ou invalide")
      res.status(400).json({ message: "quoteId requis." });
      return;
    }

    try {
      // Récupérer le userId du token Authorization
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      
      const supabase = getSupabaseClient();
      let userId: string | null = null;
      
      if (token) {
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        userId = authUser?.id || null;
        console.log("👤 [generate-quote-signature-link] userId:", userId)
      }

      // Générer un token unique
      const signatureToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + (expirationDays || 30) * 24 * 60 * 60 * 1000).toISOString();

      console.log("🔐 [generate-quote-signature-link] Token généré:", signatureToken)

      // Insérer dans quote_signature_links
      const { error: insertError } = await supabase
        .from("quote_signature_links")
        .insert({
          quote_id: quoteId,
          token: signatureToken,
          expires_at: expiresAt,
          user_id: userId,
        });

      if (insertError) {
        console.error("❌ [generate-quote-signature-link] Erreur insertion:", insertError);
        res.status(500).json({ message: "Erreur lors de la génération du lien de signature." });
        return;
      }

      const origin = process.env.VITE_APP_URL || "http://localhost:5000";
      const signatureLink = `${origin}/sign-quote/${signatureToken}`;

      console.log("✅ [generate-quote-signature-link] Lien créé:", signatureLink)

      res.status(200).json({
        ok: true,
        signatureToken,
        signatureLink,
        expiresAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la génération du lien de signature.";
      console.error("❌ [generate-quote-signature-link] Exception:", err);
      res.status(500).json({ message });
    }
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

  // POST /api/invoice-reminders - Send overdue invoice reminder email to the artisan
  app.post("/api/invoice-reminders", async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ message: "userId requis." });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, company_email, company_name, company_phone")
        .eq("id", userId)
        .single();

      let userEmail = profile?.company_email;
      if (!userEmail) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(userId);
          userEmail = authUser?.user?.email;
        } catch { /* admin API may not be available */ }
      }

      if (!userEmail) {
        res.status(400).json({ message: "Aucun email configuré pour votre compte. Ajoutez votre email dans les Paramètres." });
        return;
      }

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, client_email, total_ttc, due_date, status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", ["envoyée", "partiellement_payée"]);

      const now = new Date();
      const overdueInvoices = (invoices ?? []).filter((inv: any) => new Date(inv.due_date) < now);

      if (overdueInvoices.length === 0) {
        res.json({ ok: true, sent: 0, message: "Aucune facture en retard." });
        return;
      }

      const userName = profile?.full_name || "Utilisateur";
      const lines = overdueInvoices.map((inv: any) => {
        const daysLate = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(inv.total_ttc ?? 0);
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${inv.invoice_number}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${inv.client_name || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${amount}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${new Date(inv.due_date).toLocaleDateString("fr-FR")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#dc2626;font-weight:600;">${daysLate}j</td>
        </tr>`;
      });

      const totalOverdue = overdueInvoices.reduce((s: number, inv: any) => s + (inv.total_ttc ?? 0), 0);
      const totalFormatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalOverdue);

      const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#1e293b;">Rappel : ${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard</h2>
          <p style="color:#475569;">Bonjour ${userName},</p>
          <p style="color:#475569;">Voici vos factures en retard de paiement :</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;">Facture</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;">Client</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;">Montant</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;">Échéance</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;">Retard</th>
              </tr>
            </thead>
            <tbody>${lines.join("")}</tbody>
          </table>
          <p style="color:#1e293b;font-weight:600;font-size:15px;">Total à encaisser : ${totalFormatted}</p>
          <p style="color:#475569;font-size:13px;margin-top:24px;">Pensez à relancer vos clients ou à enregistrer les paiements reçus dans TitanBTP.</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px;">— TitanBTP</p>
        </div>`;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        res.status(503).json({ message: "Aucun service email configuré." });
        return;
      }

      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev";

      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: userEmail,
        subject: `Rappel : ${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard (${totalFormatted})`,
        html: htmlContent,
      });

      if (sendError) {
        res.status(500).json({ message: sendError.message || "Erreur lors de l'envoi." });
        return;
      }

      res.json({ ok: true, sent: 1, overdueCount: overdueInvoices.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      console.error("[invoice-reminders]", err);
      res.status(500).json({ message });
    }
  });

  // POST /api/public-client-form - Formulaire client public (lien partagé, sans auth)
  app.post("/api/public-client-form", async (req: Request, res: Response) => {
    const body = req.body as {
      token?: unknown;
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      street_address?: unknown;
      postal_code?: unknown;
      city?: unknown;
    };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const street_address = typeof body.street_address === "string" ? body.street_address.trim() || undefined : undefined;
    const postal_code = typeof body.postal_code === "string" ? body.postal_code.trim() || undefined : undefined;
    const city = typeof body.city === "string" ? body.city.trim() || undefined : undefined;

    if (!token) {
      res.status(400).json({ message: "Lien invalide (token manquant)." });
      return;
    }
    if (!name) {
      res.status(400).json({ message: "Le nom est requis." });
      return;
    }
    if (!email) {
      res.status(400).json({ message: "L'email est requis." });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Format d'email invalide." });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: linkRow, error: linkError } = await supabase
        .from("client_form_links")
        .select("user_id")
        .eq("token", token)
        .maybeSingle();

      if (linkError) {
        res.status(500).json({ message: "Erreur lors de la vérification du lien." });
        return;
      }
      if (!linkRow?.user_id) {
        res.status(404).json({ message: "Lien invalide ou expiré." });
        return;
      }

      const { data: client, error: insertError } = await supabase
        .from("clients")
        .insert({
          user_id: linkRow.user_id,
          name,
          email,
          phone: phone ?? null,
          street_address: street_address ?? null,
          postal_code: postal_code ?? null,
          city: city ?? null,
        })
        .select("id")
        .single();

      if (insertError) {
        const msg = insertError.message || "Impossible de créer la fiche client.";
        res.status(400).json({ message: msg });
        return;
      }

      res.status(201).json({ id: client?.id, message: "Votre fiche a bien été enregistrée." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

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
  app.get("/api/invoices/:id/send-email", (_req: Request, res: Response) => {
    res.status(405).json({ message: "Use POST to send the invoice by email." });
  });
  app.post("/api/invoices/:id/send-email", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, to, subject, message, pdfBase64, replyTo } = req.body as {
      userId: string;
      to?: string;
      subject?: string;
      message?: string;
      pdfBase64?: string;
      replyTo?: string | null;
    };

    const userIdVal = typeof userId === "string" ? userId.trim() : userId;
    if (!userIdVal) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", userIdVal).single();

      if (!invoice) {
        res.status(404).json({ message: "Facture non trouvée" });
        return;
      }

      const toAddress =
        (typeof to === "string" && to.trim()) ? to.trim()
        : (invoice.client_email && String(invoice.client_email).trim()) ? String(invoice.client_email).trim()
        : "";
      if (!toAddress) {
        res.status(400).json({ message: "Destinataire (to) requis. Indiquez un email dans le body ou sur la facture (client_email)." });
        return;
      }

      let pdfBuffer: Buffer;
      if (pdfBase64 && typeof pdfBase64 === "string") {
        pdfBuffer = Buffer.from(pdfBase64, "base64");
      } else {
        try {
          const { data: profile } = await supabase.from("user_profiles").select("full_name, company_address, company_city_postal, company_phone, company_email, company_siret").eq("id", userIdVal).single();
          pdfBuffer = await generateInvoicePdfBuffer(invoice, profile ?? null);
        } catch (pdfErr: unknown) {
          const pdfMsg = pdfErr instanceof Error ? pdfErr.message : "Erreur génération PDF";
          console.error("[send-email] generateInvoicePdfBuffer:", pdfErr);
          res.status(500).json({ message: `Génération du PDF: ${pdfMsg}` });
          return;
        }
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      const attachmentFilename = `facture-${invoice.invoice_number ?? "facture"}.pdf`;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const fromInvoice = process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev";
        const replyToAddr = replyTo && String(replyTo).trim() ? String(replyTo).trim() : undefined;
        const { data, error } = await resend.emails.send({
          from: fromInvoice,
          to: toAddress,
          ...(replyToAddr ? { replyTo: replyToAddr } : {}),
          subject: subject || `Facture ${invoice.invoice_number}`,
          html: message || `<p>Veuillez trouver ci-joint votre facture ${invoice.invoice_number}.</p>`,
          attachments: [{ filename: attachmentFilename, content: pdfBuffer.toString("base64") }],
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

      res.status(503).json({ message: "Aucun service email configuré. Ajoutez RESEND_API_KEY dans le .env." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      console.error("[send-email]", err);
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

  // ===== Routes Admin (création de comptes réservée à l'admin) =====
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();

  async function requireAdmin(req: Request, res: Response): Promise<{ email: string } | null> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ message: "Non authentifié." });
      return null;
    }
    if (!ADMIN_EMAIL) {
      res.status(503).json({ message: "ADMIN_EMAIL non configuré. Ajoutez ADMIN_EMAIL dans le .env (email de l'admin)." });
      return null;
    }
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user?.email) {
        res.status(401).json({ message: "Session invalide." });
        return null;
      }
      if (user.email.toLowerCase() !== ADMIN_EMAIL) {
        res.status(403).json({ message: "Accès réservé à l'administrateur." });
        return null;
      }
      return { email: user.email };
    } catch {
      res.status(401).json({ message: "Session invalide." });
      return null;
    }
  }

  app.get("/api/admin/check", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true });
  });

  app.post("/api/admin/create-user", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = req.body as { email?: string; full_name?: string; password?: string };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!email) {
      res.status(400).json({ message: "L'email est requis." });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Format d'email invalide." });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ message: "Le mot de passe est requis (minimum 6 caractères)." });
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      });
      if (error) {
        if (error.message?.includes("already") || error.message?.includes("exists")) {
          res.status(400).json({ message: "Un compte existe déjà pour cet email." });
          return;
        }
        res.status(400).json({ message: error.message || "Impossible de créer le compte." });
        return;
      }
      res.json({ ok: true, message: "Compte créé. L'utilisateur peut se connecter avec cet email et le mot de passe défini." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur serveur";
      res.status(500).json({ message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
