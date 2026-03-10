import { useState, useCallback, useEffect } from 'react';

export interface AiUsageState {
  used: number;
  limit: number;
  remaining: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultState: AiUsageState = {
  used: 0,
  limit: 10,
  remaining: 10,
  loading: true,
  error: null,
  refetch: async () => {},
};

export function useAiUsage(accessToken: string | null | undefined): AiUsageState {
  const [state, setState] = useState<AiUsageState>(defaultState);

  const refetch = useCallback(async () => {
    if (!accessToken?.trim()) {
      setState((s) => ({ ...s, used: 0, limit: 10, remaining: 10, loading: false, error: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/ai-usage', {
        headers: { Authorization: `Bearer ${accessToken.trim()}`, Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          used: data?.used ?? 0,
          limit: data?.limit ?? 10,
          remaining: data?.remaining ?? 0,
          error: typeof data?.message === 'string' ? data.message : 'Impossible de charger le quota IA.',
        }));
        return;
      }
      const used = typeof data.used === 'number' ? data.used : 0;
      const limit = typeof data.limit === 'number' ? data.limit : 10;
      const remaining = typeof data.remaining === 'number' ? data.remaining : Math.max(0, limit - used);
      setState({
        used,
        limit,
        remaining,
        loading: false,
        error: null,
      });
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: 'Erreur réseau',
      }));
    }
  }, [accessToken]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
