/**
 * ESM wrapper for the Express app
 * Allows the Vercel handler to load and cache the app properly
 */

let appInstance = null;
let loadingPromise = null;

export async function loadApp() {
  if (appInstance) {
    return appInstance;
  }
  
  if (loadingPromise) {
    return loadingPromise;
  }
  
  loadingPromise = (async () => {
    try {
      console.log("[API] Loading app from dist/index.js");
      // Dynamically import the ESM module
      const { default: appPromise } = await import("../dist/index.js");
      console.log("[API] App promise imported, awaiting...");
      // Resolve the promise to get the Express app
      appInstance = await appPromise;
      console.log("[API] App loaded successfully");
      return appInstance;
    } catch (error) {
      console.error("[API] Failed to load app:", error);
      loadingPromise = null; // Reset on error so we can retry
      throw error;
    }
  })();
  
  return loadingPromise;
}
