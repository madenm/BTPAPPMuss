/**
 * Charge .env avant tout autre module (routes, etc.).
 * En ESM les imports sont hoisted : en important ce fichier en premier,
 * on garantit que process.env est rempli avant l'évaluation de routes.ts.
 */
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(projectRoot, ".env") });
// Fallback: if keys still missing, try .env from cwd (e.g. when run from workspace root)
const hasGemini = !!(process.env.GEMINI_API_KEY || "").trim();
const hasOpenAI = !!(process.env.OPENAI_API_KEY || "").trim();
if (!hasGemini || !hasOpenAI) {
  loadEnv({ path: path.join(process.cwd(), ".env") });
}
