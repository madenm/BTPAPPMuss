/**
 * Quota journalier d'utilisation IA par utilisateur.
 * Limite selon le plan : Solo = 5/jour, Pro = illimité.
 * Utilisé par les routes parse-quote-description, estimate-chantier, analyze-estimation-photo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const AI_DAILY_LIMIT_FALLBACK = Math.max(1, Math.min(100, parseInt(process.env.AI_DAILY_LIMIT_PER_USER || "10", 10) || 10));

/** Limites IA par plan (alignées avec client/src/config/plans.ts) */
const AI_LIMIT_BY_PLAN: Record<string, number> = {
  solo: 5,
  pro: 999999,
};

/** Date du jour en Europe/Paris (YYYY-MM-DD) pour cohérence avec la BDD */
function todayParis(): string {
  const now = new Date();
  return now.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

/** Récupère le plan utilisateur (solo/pro) depuis user_profiles. */
export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<"solo" | "pro"> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return "solo";
  const plan = (data as { plan?: string } | null)?.plan;
  return plan === "pro" ? "pro" : "solo";
}

function getLimitForPlan(plan: "solo" | "pro"): number {
  return AI_LIMIT_BY_PLAN[plan] ?? AI_LIMIT_BY_PLAN.solo;
}

export function getDailyLimit(): number {
  return AI_DAILY_LIMIT_FALLBACK;
}

export type AiUsageResult = {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
};

export async function getAiUsage(supabase: SupabaseClient, userId: string, plan?: "solo" | "pro" | null): Promise<AiUsageResult> {
  const effectivePlan = plan ?? (await getUserPlan(supabase, userId));
  const limit = getLimitForPlan(effectivePlan);

  const date = todayParis();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("usage_count")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .maybeSingle();

  if (error) {
    console.error("[ai-usage] getAiUsage error:", error);
    return { used: 0, limit, remaining: limit, allowed: true };
  }
  const used = typeof data?.usage_count === "number" && data.usage_count >= 0 ? data.usage_count : 0;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    allowed: used < limit,
  };
}

export async function incrementAiUsage(supabase: SupabaseClient, userId: string): Promise<{ allowed: boolean }> {
  const plan = await getUserPlan(supabase, userId);
  const limit = getLimitForPlan(plan);
  const date = todayParis();
  const { data: row } = await supabase
    .from("ai_usage")
    .select("usage_count")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .maybeSingle();
  const cur = (row as { usage_count?: number } | null)?.usage_count ?? 0;
  if (cur >= limit) {
    return { allowed: false };
  }
  const { error } = await supabase
    .from("ai_usage")
    .upsert(
      { user_id: userId, usage_date: date, usage_count: cur + 1 },
      { onConflict: "user_id,usage_date" }
    );
  if (error) console.error("[ai-usage] incrementAiUsage error:", error);
  return { allowed: true };
}
