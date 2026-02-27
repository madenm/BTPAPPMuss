import "./env";
import path from "path";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, serveStatic } from "./static";

const app = express();
// Limite augmentée pour accepter les PDF en base64 (envoi facture/devis par email)
// Skip body parsing when body already set (e.g. by Vercel handler) so we don't overwrite or double-consume
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
    return next();
  }
  return express.json({ limit: "50mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null) return next();
  return express.urlencoded({ extended: false, limit: "50mb" })(req, res, next);
});

// CORS : prévol OPTIONS + en-têtes sur réponses /api (Vercel / cross-origin)
app.use((req: Request, res: Response, next) => {
  if (!req.path.startsWith("/api")) return next();
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// CSP en dev pour autoriser unsafe-eval (dépendances) ; en prod géré par vercel.json
if (process.env.VERCEL !== "1") {
  const csp =
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self';";
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", csp);
    next();
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function createApp() {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  const isVercel = process.env.VERCEL === "1";
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

  if (isVercel) {
    // Sur Vercel : uniquement les routes API (pas de static, pas de Vite).
    app.use((_req: Request, res: Response) => {
      res.status(404).json({ message: "Not Found" });
    });
  } else if (!isDev) {
    serveStatic(app);
  }
  // En dev, Vite est ajouté par server/dev.ts (évite d'inclure Rollup dans le bundle prod)

  return { app, server };
}

export { createApp };

const initPromise = createApp().catch((err: any) => {
  console.error("\n[server] Erreur au démarrage:", err?.message || err);
  process.exit(1);
  throw err;
});

const appPromise = initPromise.then(({ app }) => app);

// En prod seulement (dev utilise server/dev.ts qui fait le listen après setupVite)
if (process.env.VERCEL !== "1" && process.env.NETLIFY !== "1" && process.env.NODE_ENV === "production") {
  initPromise.then(({ server }) => {
    const port = parseInt(process.env.PORT || "5000", 10);
    const finalPort = isNaN(port) || port <= 0 ? 5000 : port;
    const listenOptions: any = { port: finalPort, host: "0.0.0.0" };
    if (process.platform === "linux") listenOptions.reusePort = true;
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") log(`Port ${finalPort} is already in use`, "server");
      else log(`server listen error: ${err?.code || err?.message}`, "server");
      process.exit(1);
    });
    server.listen(listenOptions, () => {
      log(`serving on http://127.0.0.1:${finalPort}`);
      console.log("\n  >> Ouvrez votre navigateur à l'adresse : http://127.0.0.1:" + finalPort + "\n");
    });
  });
}

export default appPromise;
