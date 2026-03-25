/**
 * Vercel serverless: POST /api/invoices/pdf → Express (brouillon / prévisualisation PDF).
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
    console.error("[API] invoice pdf POST getApp failed:", err);
    res.status(500).setHeader("Content-Type", "application/json").end(JSON.stringify({ message: "Server failed to load" }));
    return;
  }
  const pathForExpress = "/api/invoices/pdf";
  const method = (req.method || "POST").toUpperCase();
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

  const forwardedHeaders = { ...req.headers };
  const descriptor = {
    url: { value: pathForExpress, writable: true },
    method: { value: method, writable: true },
    path: { value: pathForExpress, writable: true },
    originalUrl: { value: pathForExpress, writable: true },
    headers: { value: forwardedHeaders, writable: true },
  };
  if (parsedBody !== undefined) {
    descriptor.body = { value: parsedBody, writable: true };
  }
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
