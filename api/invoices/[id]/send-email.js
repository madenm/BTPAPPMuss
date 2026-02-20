/**
 * Vercel serverless handler for POST /api/invoices/:id/send-email.
 * Forwards to the Express app so this path is always handled (avoids catch-all 404).
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
    console.error("[API] send-email getApp failed:", err);
    res.status(500).setHeader("Content-Type", "application/json").end(JSON.stringify({ message: "Server failed to load" }));
    return;
  }
  const rawUrl = req.url || "";
  let pathForExpress = rawUrl.includes("://") ? (() => {
    try {
      const u = new URL(rawUrl);
      return u.pathname + (u.search || "");
    } catch {
      return "/api/invoices/" + (req.query?.id || "") + "/send-email";
    }
  })() : (rawUrl.startsWith("/api") ? rawUrl : "/api" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl));
  if (!pathForExpress.includes("/send-email") && req.query?.id) {
    pathForExpress = "/api/invoices/" + req.query.id + "/send-email";
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

  const descriptor = {
    url: { value: pathForExpress, writable: true },
    method: { value: method, writable: true },
    path: { value: pathnameOnly, writable: true },
    originalUrl: { value: pathForExpress, writable: true },
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
