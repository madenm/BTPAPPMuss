/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * The app is built to dist/index.js and exports a Promise<Express>.
 * We wrap req with url, method, path, originalUrl so Express routing matches correctly.
 */
const { initializeApp } = require("./index.js");

let appCache = null;

async function getApp() {
  if (!appCache) {
    try {
      appCache = await initializeApp();
    } catch (error) {
      console.error("[API Handler] Failed to load app:", error);
      throw error;
    }
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
    } catch {
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
    app(wrappedReq, res, (err) => (err ? reject(err) : resolve(undefined)));
  });
}

module.exports = handler;

const config = { api: { bodyParser: false } };
module.exports.config = config;
