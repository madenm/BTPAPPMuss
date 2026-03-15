/**
 * Configuration des plans Solo / Pro pour TitanBtp.
 * Utilisé par usePlan() pour les limites et vérifications.
 */

export type PlanId = 'solo' | 'pro';

export interface PlanLimits {
  /** Chantiers actifs maximum (statut !== terminé) */
  maxChantiers: number;
  /** Devis créés par mois maximum */
  maxQuotesPerMonth: number;
  /** Nombre max de membres d'équipe (Solo: 4, Pro: illimité; 0 = désactivé) */
  maxTeamMembers: number;
  /** Utilisations IA par jour */
  maxAiPerDay: number;
  /** Libellé support */
  supportLabel: string;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  solo: {
    maxChantiers: 5,
    maxQuotesPerMonth: 15,
    maxTeamMembers: 4,
    maxAiPerDay: 5,
    supportLabel: 'Support standard',
  },
  pro: {
    maxChantiers: Infinity,
    maxQuotesPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxAiPerDay: Infinity,
    supportLabel: 'Support prioritaire',
  },
};

/** Actions soumises aux quotas / limites du plan */
export type PlanAction = 'chantiers' | 'quotes' | 'team' | 'ai';

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.solo;
}
