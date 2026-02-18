/**
 * Charge .env avant tout autre module (routes, etc.).
 * Sur Vercel, les variables sont injectées par la plateforme (pas de fichier .env).
 * En local, on charge .env depuis la racine du projet.
 */
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

if (process.env.VERCEL !== "1") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, "..");
  loadEnv({ path: path.join(projectRoot, ".env") });
  const hasGemini = !!(process.env.GEMINI_API_KEY || "").trim();
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || "").trim();
  if (!hasGemini || !hasOpenAI) {
    loadEnv({ path: path.join(process.cwd(), ".env") });
  }
}
