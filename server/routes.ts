import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";

const __dirnameServer = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_CURSOR_LOG = resolve(__dirnameServer, "..", "..", ".cursor", "debug.log");

function debugLog(payload: Record<string, unknown>) {
  try {
    const dir = join(process.cwd(), ".cursor");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const logPath = join(dir, "debug.log");
    appendFileSync(logPath, JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: "debug-session" }) + "\n");
  } catch {
    /* ignore */
  }
}

function agentLog(payload: Record<string, unknown>) {
  try {
    const logPath = WORKSPACE_CURSOR_LOG;
    const dir = join(logPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ...payload, timestamp: Date.now() }) + "\n";
    appendFileSync(logPath, line);
  } catch {
    /* ignore */
  }
}
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
    // #region agent log
    agentLog({
      location: "routes.ts:generate-visualization:entry",
      message: "generate-visualization called",
      hypothesisId: "H1",
      data: { hasOpenAIClient: !!getOpenAIClient() },
    });
    // #endregion
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
    // #region agent log
    agentLog({
      location: "routes.ts:generate-visualization:image-ready",
      message: "image buffer ready",
      hypothesisId: "H3",
      data: { bufferLength: imageBuffer.length, mime, ext },
    });
    // #endregion
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
          agentLog({
            location: "routes.ts:generate-visualization:before-edit",
            message: "calling openai.images.edit",
            hypothesisId: "H4,H5",
            data: { model: opts.model, promptLen: prompt.length },
          });
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
      // #region agent log
      agentLog({
        location: "routes.ts:generate-visualization:response",
        message: "openai response received",
        hypothesisId: "H2",
        data: {
          hasData: !!response.data,
          dataLength: response.data?.length ?? 0,
          firstHasB64: !!(first && "b64_json" in first),
          firstHasUrl: !!(first && "url" in first),
          firstKeys: first ? Object.keys(first) : [],
        },
      });
      // #endregion
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
      // #region agent log
      agentLog({
        location: "routes.ts:generate-visualization:catch",
        message: "openai error",
        hypothesisId: "H1,H4,H5",
        data: { message, errName, errStatus },
      });
      // #endregion
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

    const userMessage = [
      "Tu rédiges ce devis comme un expert en estimation de travaux de " + typeLabel + " avec 20 ans d'expérience.",
      "",
      "TYPE DE PROJET: " + typeLabel,
      "DESCRIPTION DÉTAILLÉE: " + trimmed,
      "LOCALISATION: " + locValue,
      ...(formattedAnswers ? ["", "RÉPONSES AU QUESTIONNAIRE (optionnel):", formattedAnswers] : []),
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
- Tu lis la description du projet, le type (si fourni) et les RÉPONSES AU QUESTIONNAIRE si présentes. Tu DÉCOMPOSES le travail en étapes et postes nécessaires. Si des réponses au questionnaire sont fournies, tiens-en compte pour affiner les lignes du devis (matériaux, dimensions, complexité, etc.).
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
    // #region agent log
    debugLog({ location: "server/routes.ts:estimate-chantier:entry", message: "POST body", hypothesisId: "H1", data: { hasChantierInfo: !!req.body?.chantierInfo, surface: req.body?.chantierInfo?.surface, metier: req.body?.chantierInfo?.metier, photoAnalysisLength: typeof req.body?.photoAnalysis === "string" ? req.body.photoAnalysis.length : 0, questionnaireKeys: req.body?.questionnaireAnswers ? Object.keys(req.body.questionnaireAnswers).length : 0 } });
    // #endregion
    const { client, chantierInfo, photoAnalysis, questionnaireAnswers } = req.body as {
      client?: { name?: string; email?: string; phone?: string };
      chantierInfo?: { surface?: string | number; materiaux?: string; localisation?: string; delai?: string; metier?: string };
      photoAnalysis?: string;
      questionnaireAnswers?: Record<string, string>;
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

    const userMessage = [
      "Tu es un expert en estimation de chantiers BTP/rénovation en France. À partir des données ci-dessous, tu DOIS produire une estimation COMPLÈTE au format JSON.",
      "",
      "--- DONNÉES DU CHANTIER (utilise-les pour tout calculer) ---",
      "Type de projet: " + typeLabel,
      "Surface: " + surface + " m²",
      "Localisation: " + (localisationStr || "France (non précisée)"),
      "Délai souhaité: " + (delaiStr || "Flexible") + " (impact sur coût si délai court)",
      clientName ? "Client: " + clientName + (clientEmail ? " " + clientEmail : "") + (clientPhone ? " " + clientPhone : "") : "",
      materiauxStr ? "Matériaux / précisions: " + materiauxStr : "",
      photoAnalysisStr ? "Analyse de la photo (état des lieux, accès, complexité): " + photoAnalysisStr : "",
      questionnaireStr ? "Réponses au questionnaire: " + questionnaireStr : "",
      "",
      "--- INSTRUCTIONS OBLIGATOIRES ---",
      "1. Utilise TOUTES les données ci-dessus (photo, questionnaire, localisation, surface, type) pour estimer.",
      "2. La localisation peut influencer coûts (Paris/Île-de-France plus cher, zones rurales différences).",
      "3. Règles: main-d'œuvre 150€/jour/ouvrier, marge 25%, frais généraux 20%, imprévus 15%. Accès difficile = +20-30% délai.",
      "4. Tu DOIS remplir TOUS les champs du JSON ci-dessous. Aucun tableau vide, aucun 0 pour coutTotal/marge/benefice. Minimum 3 matériaux, 3 outils, 3 recommandations.",
      "",
      "Réponds UNIQUEMENT par un objet JSON valide (pas de texte avant ni après), avec exactement les clés suivantes. Utilise des nombres réalistes selon le type et la surface.",
      JSON.stringify({
        tempsRealisation: "ex: \"2 semaines\" ou \"3 semaines (15 jours ouvrables)\"",
        materiaux: [{ nom: "string", quantite: "string", prix: 0 }],
        outils: ["string", "string"],
        nombreOuvriers: 1,
        coutTotal: 0,
        marge: 0,
        benefice: 0,
        repartitionCouts: { transport: 0, mainOeuvre: 0, materiaux: 0, autres: 0 },
        recommandations: ["string", "string", "string"],
      }),
    ].filter(Boolean).join("\n");

    const systemInstruction = `Tu es un expert en estimation de chantiers (BTP, rénovation) en France. Tu produis UNIQUEMENT un JSON valide, sans markdown ni texte autour.

OBLIGATOIRE: le JSON doit contenir exactement:
- tempsRealisation: string (ex "2 semaines", "1 mois")
- materiaux: tableau d'au moins 3 objets avec nom, quantite (string), prix (number)
- outils: tableau d'au moins 3 strings (noms d'outils/équipements)
- nombreOuvriers: number >= 1
- coutTotal: number > 0 (coût total en euros)
- marge: number >= 0
- benefice: number >= 0
- repartitionCouts: objet avec transport, mainOeuvre, materiaux, autres (chacun number >= 0, la somme proche de coutTotal)
- recommandations: tableau d'au moins 3 strings (conseils sécurité, préparation, bonnes pratiques)

Calcule les montants à partir du type de chantier, de la surface, de la localisation et des réponses au questionnaire. Ne renvoie jamais de tableaux vides ni coutTotal à 0.`;

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
      // #region agent log
      debugLog({ location: "server/routes.ts:estimate-chantier:raw", message: "Raw AI response", hypothesisId: "H2", data: { rawLength: raw?.length ?? 0, rawPreview: typeof raw === "string" ? raw.slice(0, 250) : "" } });
      // #endregion
      if (!raw || typeof raw !== "string") {
        res.status(502).json({ message: "Réponse vide de l'IA." });
        return;
      }
      const jsonStr = extractJsonFromResponse(raw);
      // #region agent log
      debugLog({ location: "server/routes.ts:estimate-chantier:jsonStr", message: "Extracted JSON", hypothesisId: "H2", data: { jsonStrLength: jsonStr?.length ?? 0, jsonStrPreview: (jsonStr || "").slice(0, 350) } });
      // #endregion
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
        // #region agent log
        debugLog({ location: "server/routes.ts:estimate-chantier:parseErr", message: "JSON parse failed", hypothesisId: "H3", data: { error: String(parseErr) } });
        // #endregion
        res.status(502).json({ message: "Réponse IA invalide (JSON)." });
        return;
      }
      // #region agent log
      debugLog({ location: "server/routes.ts:estimate-chantier:parsed", message: "Parsed AI response", hypothesisId: "H3", data: { parsedKeys: Object.keys(parsed || {}), materiauxLength: Array.isArray(parsed?.materiaux) ? parsed.materiaux.length : "notArray", coutTotal: parsed?.coutTotal, tempsRealisation: typeof parsed?.tempsRealisation === "string" ? parsed.tempsRealisation : (parsed?.tempsRealisation as { dureeEstimee?: string })?.dureeEstimee } });
      // #endregion
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
      // #region agent log
      debugLog({ location: "server/routes.ts:estimate-chantier:beforeSend", message: "analysisResults before send", hypothesisId: "H4", data: { tempsRealisation: analysisResults.tempsRealisation, materiauxLength: (analysisResults.materiaux as unknown[])?.length, outilsLength: (analysisResults.outils as unknown[])?.length, coutTotal: analysisResults.coutTotal, recommandationsLength: (analysisResults.recommandations as unknown[])?.length } });
      // #endregion
      res.status(200).json(analysisResults);
    } catch (err: unknown) {
      // #region agent log
      debugLog({ location: "server/routes.ts:estimate-chantier:catch", message: "Exception", hypothesisId: "H4", data: { errMessage: err instanceof Error ? err.message : String(err) } });
      // #endregion
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

    // Toujours envoyer au destinataire indiqué (pas de redirection RESEND_TEST_EMAIL)
    const toAddress = to.trim();
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
      const senderName = process.env.SENDER_NAME || "TitanBtp";
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

    // Toujours envoyer au destinataire du prospect (pas de redirection RESEND_TEST_EMAIL) pour que l'UI et l'envoi correspondent
    const toAddress = to.trim();
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
      const senderName = process.env.SENDER_NAME || "TitanBtp";
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

    // Toujours envoyer au destinataire indiqué (pas de redirection RESEND_TEST_EMAIL)
    const toAddress = to.trim();

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
        const fromInvoice = process.env.SENDER_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev";
        const { data, error } = await resend.emails.send({
          from: fromInvoice,
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
        const senderName = process.env.SENDER_NAME || "TitanBtp";
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
