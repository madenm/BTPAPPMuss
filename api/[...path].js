/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * Uses required catch-all [...path] for reliable routing on Vercel.
 * Loads app from dist/index.js (path from process.cwd() for correct resolution in serverless).
 */
import path from "path";
import { pathToFileURL } from "url";

let appCache = null;

async function getApp() {
  if (!appCache) {
    const distPath = path.join(process.cwd(), "dist", "index.js");
    const mod = await import(pathToFileURL(distPath).href);
    appCache = await mod.default;
  }
  return appCache;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (err) {
    console.error("[API] getApp failed:", err);
    res.status(500).setHeader("Content-Type", "application/json").end(JSON.stringify({ message: "Server failed to load" }));
    return;
  }
  const rawUrl = req.url || "";
  let pathForExpress = rawUrl;
  if (rawUrl.includes("://")) {
    try {
      const u = new URL(rawUrl);
      pathForExpress = u.pathname + (u.search || "");
    } catch {
      pathForExpress = rawUrl.startsWith("/api") ? rawUrl : "/api" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl);
    }
  } else if (!pathForExpress.startsWith("/api")) {
    pathForExpress = "/api" + (pathForExpress.startsWith("/") ? pathForExpress : "/" + pathForExpress);
  }
  const method = (req.method || "GET").toUpperCase();
  let pathnameOnly = pathForExpress.split("?")[0];
  const q = pathForExpress.indexOf("?");
  const query = q >= 0 ? pathForExpress.slice(q) : "";
  if (pathnameOnly.length > 1 && pathnameOnly.endsWith("/")) {
    pathnameOnly = pathnameOnly.slice(0, -1);
    pathForExpress = pathnameOnly + query;
  }

  let parsedBody = undefined;
  const contentType = (req.headers && (req.headers["content-type"] || req.headers["Content-Type"])) || "";
  if ((method === "POST" || method === "PUT" || method === "PATCH") && contentType.includes("application/json")) {
    try {
      const raw = await readBody(req);
      const str = raw.length ? raw.toString("utf8") : "{}";
      parsedBody = str ? JSON.parse(str) : {};
    } catch {
      parsedBody = {};
    }
  }

  // Patch req properties without breaking inherited getters (like req.ip)
  req.url = pathForExpress;
  req.method = method;
  req.path = pathnameOnly;
  req.originalUrl = pathForExpress;
  if (parsedBody !== undefined) {
    req.body = parsedBody;
  }

  return new Promise((resolve, reject) => {
    res.on("finish", () => resolve(undefined));
    res.on("error", reject);
    app(req, res, (err) => {
      if (err) reject(err);
    });
  });
}

export const config = { api: { bodyParser: false } };
