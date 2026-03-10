/**
 * Quota journalier d'utilisation IA par utilisateur.
 * Utilisé par les routes parse-quote-description, estimate-chantier, analyze-estimation-photo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const AI_DAILY_LIMIT = Math.max(1, Math.min(100, parseInt(process.env.AI_DAILY_LIMIT_PER_USER || "10", 10) || 10));

/** Date du jour en Europe/Paris (YYYY-MM-DD) pour cohérence avec la BDD */
function todayParis(): string {
  const now = new Date();
  return now.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export function getDailyLimit(): number {
  return AI_DAILY_LIMIT;
}

export type AiUsageResult = {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
};

export async function getAiUsage(supabase: SupabaseClient, userId: string): Promise<AiUsageResult> {
  const date = todayParis();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("usage_count")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .maybeSingle();

  if (error) {
    console.error("[ai-usage] getAiUsage error:", error);
    return { used: 0, limit: AI_DAILY_LIMIT, remaining: AI_DAILY_LIMIT, allowed: true };
  }
  const used = typeof data?.usage_count === "number" && data.usage_count >= 0 ? data.usage_count : 0;
  const remaining = Math.max(0, AI_DAILY_LIMIT - used);
  return {
    used,
    limit: AI_DAILY_LIMIT,
    remaining,
    allowed: used < AI_DAILY_LIMIT,
  };
}

export async function incrementAiUsage(supabase: SupabaseClient, userId: string): Promise<void> {
  const date = todayParis();
  const { data: row } = await supabase
    .from("ai_usage")
    .select("usage_count")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .maybeSingle();
  const cur = (row as { usage_count?: number } | null)?.usage_count ?? 0;
  const { error } = await supabase
    .from("ai_usage")
    .upsert(
      { user_id: userId, usage_date: date, usage_count: cur + 1 },
      { onConflict: "user_id,usage_date" }
    );
  if (error) console.error("[ai-usage] incrementAiUsage error:", error);
}
