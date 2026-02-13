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
  const pathnameOnly = pathForExpress.split("?")[0];

  const wrappedReq = Object.create(req, {
    url: { value: pathForExpress, writable: false },
    method: { value: method, writable: false },
    path: { value: pathnameOnly, writable: false },
    originalUrl: { value: pathForExpress, writable: false },
  });

  return new Promise((resolve, reject) => {
    app(wrappedReq, res, (err) => (err ? reject(err) : resolve(undefined)));
  });
}

export const config = { api: { bodyParser: false } };
