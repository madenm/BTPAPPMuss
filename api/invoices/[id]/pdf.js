/**
 * Vercel serverless: GET /api/invoices/:id/pdf → Express (évite 404 si le catch-all ne matche pas).
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

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (err) {
    console.error("[API] invoice pdf getApp failed:", err);
    res.status(500).setHeader("Content-Type", "application/json").end(JSON.stringify({ message: "Server failed to load" }));
    return;
  }
  const id = req.query?.id || "";
  const pathForExpress = "/api/invoices/" + encodeURIComponent(String(id)) + "/pdf";
  const method = (req.method || "GET").toUpperCase();
  const descriptor = {
    url: { value: pathForExpress, writable: true },
    method: { value: method, writable: true },
    path: { value: pathForExpress, writable: true },
    originalUrl: { value: pathForExpress, writable: true },
    headers: { value: { ...req.headers }, writable: true },
  };
  const wrappedReq = Object.create(req, descriptor);

  return new Promise((resolve, reject) => {
    res.on("finish", () => resolve(undefined));
    res.on("error", reject);
    app(wrappedReq, res, (err) => {
      if (err) reject(err);
    });
  });
}

export const config = { api: { bodyParser: false } };
