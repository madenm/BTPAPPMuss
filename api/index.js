/**
 * CommonJS wrapper for the ESM Express app
 * Allows Vercel to load and cache the app properly
 */

let appInstance = null;
let appPromise = null;

async function initializeApp() {
  if (appPromise) return appPromise;
  
  appPromise = (async () => {
    try {
      // Dynamically import the ESM module
      const appModule = await import("../dist/index.js");
      // Get the default export (which is appPromise)
      const app = await appModule.default;
      appInstance = app;
      return app;
    } catch (error) {
      console.error("[API Index] Failed to initialize app:", error);
      throw error;
    }
  })();
  
  return appPromise;
}

module.exports = { initializeApp };
