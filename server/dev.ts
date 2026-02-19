/**
 * Point d'entrée développement uniquement.
 * Charge Vite (et donc Rollup) ici pour ne jamais les inclure dans le bundle production (dist/index.js).
 * Évite l'erreur @rollup/rollup-linux-x64-gnu sur Vercel.
 */
import "./env";
import { createApp } from "./index";
import { log } from "./static";

async function main() {
  const { app, server } = await createApp();
  const { setupVite } = await import("./vite");
  await setupVite(app, server);

  const port = parseInt(process.env.PORT || "5000", 10);
  const finalPort = isNaN(port) || port <= 0 ? 5000 : port;
  const listenOptions: any = { port: finalPort, host: process.platform === "win32" ? "127.0.0.1" : "0.0.0.0" };
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
}

main().catch((err) => {
  console.error("\n[server] Erreur au démarrage:", err?.message || err);
  process.exit(1);
});
