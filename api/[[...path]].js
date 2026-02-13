/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * CommonJS wrapper that loads the ESM app and handles requests.
 */
const { loadApp } = require("./index.js");

let appCache = null;

async function getApp() {
  if (!appCache) {
    appCache = await loadApp();
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

async function handler(req, res) {
  try {
    const app = await getApp();
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
    const pathnameOnly = pathForExpress.split("?")[0];

    let parsedBody = undefined;
    const contentType = (req.headers && (req.headers["content-type"] || req.headers["Content-Type"])) || "";
    
    if ((method === "POST" || method === "PUT" || method === "PATCH") && contentType.includes("application/json")) {
      try {
        const raw = await readBody(req);
        const str = raw.length ? raw.toString("utf8") : "{}";
        parsedBody = str ? JSON.parse(str) : {};
      } catch (err) {
        console.error("[API] Body parse error:", err);
        parsedBody = {};
      }
    }

    const descriptor = {
      url: { value: pathForExpress, writable: false },
      method: { value: method, writable: false },
      path: { value: pathnameOnly, writable: false },
      originalUrl: { value: pathForExpress, writable: false },
    };
    
    if (parsedBody !== undefined) {
      descriptor.body = { value: parsedBody, writable: false };
    }
    
    const wrappedReq = Object.create(req, descriptor);

    return new Promise((resolve, reject) => {
      res.on("finish", () => resolve(undefined));
      res.on("error", (err) => reject(err));
      app(wrappedReq, res, (err) => {
        if (err) {
          console.error("[API] Express error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message });
          }
          reject(err);
        }
      });
    });
  } catch (error) {
    console.error("[API Handler] Fatal error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
