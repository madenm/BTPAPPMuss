import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useAiUsage } from '@/hooks/useAiUsage';
import { countQuotesCreatedThisMonth } from '@/lib/supabaseQuotes';
import {
  getPlanLimits,
  type PlanId,
  type PlanAction,
  type PlanLimits,
} from '@/config/plans';

export interface QuotaInfo {
  current: number;
  limit: number;
  remaining: number;
  /** Pour affichage "3/5 chantiers" ou "12/15 devis ce mois" */
  label: string;
}

export interface UsePlanReturn {
  plan: PlanId;
  limits: PlanLimits;
  loading: boolean;
  /** Vérifie si l'action est autorisée (quota non atteint ou plan Pro). */
  canDo: (action: PlanAction) => boolean;
  /** Retourne les infos de quota pour affichage (badge, message). */
  getRemainingQuota: (action: PlanAction) => QuotaInfo;
  refetch: () => Promise<void>;
}

function getQuotaLabel(action: PlanAction, current: number, limit: number): string {
  const limitStr = limit === Infinity ? '∞' : String(limit);
  switch (action) {
    case 'chantiers':
      return `${current}/${limitStr} chantiers`;
    case 'quotes':
      return `${current}/${limitStr} devis ce mois`;
    case 'team':
      return limit === 0 ? 'Équipe désactivée' : `${current}/${limitStr} membres`;
    case 'ai':
      return `${current}/${limitStr} IA aujourd'hui`;
    default:
      return `${current}/${limitStr}`;
  }
}

export interface UsePlanOptions {
  /** Nombre actuel de membres d'équipe (pour appliquer la limite Pro à 4) */
  teamMembersCount?: number;
}

export function usePlan(options?: UsePlanOptions): UsePlanReturn {
  const { user, session, loading: authLoading } = useAuth();
  const { profile } = useUserSettings();
  const { chantiers } = useChantiers();
  const aiUsage = useAiUsage(session?.access_token ?? null, !authLoading);
  const teamMembersCount = options?.teamMembersCount ?? 0;

  const plan: PlanId = (profile?.plan === 'pro' ? 'pro' : 'solo') as PlanId;
  const limits = getPlanLimits(plan);

  const [quotesThisMonth, setQuotesThisMonth] = useState<number>(0);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const fetchQuotesCount = useCallback(async () => {
    if (!user?.id) {
      setQuotesThisMonth(0);
      return;
    }
    setQuotesLoading(true);
    try {
      const count = await countQuotesCreatedThisMonth(user.id);
      setQuotesThisMonth(count);
    } catch {
      setQuotesThisMonth(0);
    } finally {
      setQuotesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchQuotesCount();
  }, [fetchQuotesCount]);

  const activeChantiersCount = chantiers.filter((c) => c.statut !== 'terminé').length;

  const canDo = useCallback(
    (action: PlanAction): boolean => {
      switch (action) {
        case 'chantiers':
          return plan === 'pro' || activeChantiersCount < limits.maxChantiers;
        case 'quotes':
          return plan === 'pro' || quotesThisMonth < limits.maxQuotesPerMonth;
        case 'team':
          return limits.maxTeamMembers > 0 && teamMembersCount < limits.maxTeamMembers;
        case 'ai':
          return plan === 'pro' || aiUsage.used < limits.maxAiPerDay;
        default:
          return true;
      }
    },
    [
      plan,
      limits.maxChantiers,
      limits.maxQuotesPerMonth,
      limits.maxTeamMembers,
      limits.maxAiPerDay,
      activeChantiersCount,
      quotesThisMonth,
      aiUsage.used,
      teamMembersCount,
    ]
  );

  const getRemainingQuota = useCallback(
    (action: PlanAction): QuotaInfo => {
      const limitNum = (() => {
        switch (action) {
          case 'chantiers':
            return limits.maxChantiers;
          case 'quotes':
            return limits.maxQuotesPerMonth;
          case 'team':
            return limits.maxTeamMembers;
          case 'ai':
            return limits.maxAiPerDay;
          default:
            return 0;
        }
      })();
      const current = (() => {
        switch (action) {
          case 'chantiers':
            return activeChantiersCount;
          case 'quotes':
            return quotesThisMonth;
          case 'team':
            return teamMembersCount;
          case 'ai':
            return aiUsage.used;
          default:
            return 0;
        }
      })();
      const remaining =
        limitNum === Infinity ? Infinity : Math.max(0, limitNum - current);
      return {
        current,
        limit: limitNum,
        remaining,
        label: getQuotaLabel(action, current, limitNum),
      };
    },
    [
      limits,
      activeChantiersCount,
      quotesThisMonth,
      aiUsage.used,
      teamMembersCount,
    ]
  );

  const loading = authLoading || quotesLoading;

  const refetch = useCallback(async () => {
    await Promise.all([fetchQuotesCount(), aiUsage.refetch()]);
  }, [fetchQuotesCount, aiUsage.refetch]);

  return {
    plan,
    limits,
    loading,
    canDo,
    getRemainingQuota,
    refetch,
  };
}
