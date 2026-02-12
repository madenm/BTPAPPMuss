/**
 * Debug telemetry: only sends to localhost ingest. No-op in production to avoid CORS/ERR_FAILED.
 */
const INGEST_URL = "http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5";

export function debugIngest(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return;
  fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {});
}
