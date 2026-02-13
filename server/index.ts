import "./env";
import path from "path";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// #region agent log - middleware to see if any POST to generate-visualization reaches Express
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/generate-visualization") {
    console.log("[DEBUG] POST /api/generate-visualization reached Express");
    try {
      const logDir = join(process.cwd(), ".cursor");
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      appendFileSync(join(logDir, "debug.log"), JSON.stringify({ location: "index.ts:api-middleware", message: "POST generate-visualization reached Express", data: { path: req.path }, timestamp: Date.now(), hypothesisId: "H1", runId: "run2" }) + "\n");
    } catch (e) {
      console.log("[DEBUG] Failed to write debug.log:", e);
    }
  }
  next();
});
// #endregion
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

  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return { app, server };
}

const initPromise = createApp().catch((err: any) => {
  console.error("\n[server] Erreur au démarrage:", err?.message || err);
  process.exit(1);
  throw err;
});

const appPromise = initPromise.then(({ app }) => app);

if (process.env.VERCEL !== "1") {
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
