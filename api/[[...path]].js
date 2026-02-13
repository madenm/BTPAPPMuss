/**
 * Vercel serverless handler: forward all /api/* requests to the Express app.
 * The app is built to dist/index.js and exports a Promise<Express>.
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
  const pathForExpress = rawUrl.startsWith("/api") ? rawUrl : "/api" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl);
  const wrappedReq = Object.create(req, { url: { value: pathForExpress, writable: false } });
  return new Promise((resolve, reject) => {
    app(wrappedReq, res, (err) => (err ? reject(err) : resolve(undefined)));
  });
}
