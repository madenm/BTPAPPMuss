/**
 * Headers communs pour les requêtes POST vers l'API (Accept, Content-Type, optionnellement Authorization).
 */
export function getApiPostHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  const token = accessToken?.trim();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
