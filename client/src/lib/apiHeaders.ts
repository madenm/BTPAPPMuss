/**
 * Headers communs pour les requêtes POST vers l'API (Accept, Content-Type, optionnellement Authorization).
 */
export function getApiPostHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (accessToken && accessToken.trim()) {
    headers["Authorization"] = `Bearer ${accessToken.trim()}`;
  }
  return headers;
}
