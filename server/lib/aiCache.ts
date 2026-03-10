/**
 * Cache des réponses IA (devis, estimation, analyse photo) pour éviter des appels Gemini redondants.
 * TTL 7 jours.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function stableHash(payload: unknown): string {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(str).digest("hex");
}

export type CacheType = "devis" | "estimation" | "photo";

export function getCacheKey(type: CacheType, payload: unknown): string {
  return `${type}:${stableHash(payload)}`;
}

export async function getCached<T>(
  supabase: SupabaseClient,
  key: string,
  type: CacheType
): Promise<T | null> {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("ai_response_cache")
    .select("result, created_at")
    .eq("cache_key", key)
    .eq("response_type", type)
    .gt("created_at", cutoff)
    .maybeSingle();

  if (error || !data) return null;
  return data.result as T;
}

export async function setCached(
  supabase: SupabaseClient,
  key: string,
  type: CacheType,
  result: unknown
): Promise<void> {
  await supabase.from("ai_response_cache").upsert(
    { cache_key: key, response_type: type, result: result as object },
    { onConflict: "cache_key,response_type" }
  );
}
