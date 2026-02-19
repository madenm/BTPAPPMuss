/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * The app is built to dist/index.js and exports a Promise<Express>.
 * We wrap req with url, method, path, originalUrl so Express routing matches correctly.
 */
let appCache = null;

async function getApp() {
  if (!appCache) {
    const mod = await import("../dist/index.js");
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

  // writable: true pour que Express puisse modifier url/path/originalUrl en interne (routing)
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
