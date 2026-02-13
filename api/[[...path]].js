/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * The app is built to dist/index.js and exports a Promise<Express>.
 * On modifie req en place (url, method) pour que le routeur Express matche correctement.
 */
let appCache = null;

async function getApp() {
  if (!appCache) {
    const mod = await import("../dist/index.js");
    appCache = await mod.default;
  }
  return appCache;
}

export default async function handler(req, res) {
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
  try {
    req.url = pathForExpress;
    req.method = method;
    if (req.originalUrl === undefined) req.originalUrl = pathForExpress;
  } catch (_) {
    // fallback si req est en lecture seule : wrapper
    req = Object.create(req, {
      url: { value: pathForExpress, writable: false },
      method: { value: method, writable: false },
    });
  }
  return new Promise((resolve, reject) => {
    app(req, res, (err) => (err ? reject(err) : resolve(undefined)));
  });
}
