import { supabase } from "./supabaseClient";

export interface QuoteSubItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  subItems?: QuoteSubItem[];
}

export interface SupabaseQuote {
  id: string;
  user_id: string;
  chantier_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  project_type: string | null;
  project_description: string | null;
  total_ht: number;
  total_ttc: number;
  status: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé";
  validity_days: number | null;
  items: QuoteItem[] | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
}

export type NewQuotePayload = {
  chantier_id?: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  project_type: string;
  project_description: string;
  total_ht: number;
  total_ttc: number;
  validity_days: number;
  items: QuoteItem[];
  status?: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé";
};

/**
 * Calcule le numéro d'affichage d'un devis (ex. 2026-001) en fonction du rang
 * parmi les devis de l'année, triés par date de création.
 */
export function getQuoteDisplayNumber(quotes: SupabaseQuote[], quoteId: string): string {
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote?.created_at) return "";
  const year = new Date(quote.created_at).getFullYear();
  const sameYear = quotes.filter((q) => new Date(q.created_at).getFullYear() === year);
  sameYear.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const index = sameYear.findIndex((q) => q.id === quoteId);
  if (index === -1) return "";
  const rank = index + 1;
  return `${year}-${String(rank).padStart(3, "0")}`;
}

export async function fetchQuotesForUser(
  userId: string,
  status?: string,
): Promise<SupabaseQuote[]> {
  let query = supabase
    .from("quotes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching quotes:", error);
    throw error;
  }

  return (data ?? []) as SupabaseQuote[];
}

export async function fetchQuotesByChantierId(
  chantierId: string,
): Promise<SupabaseQuote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quotes by chantier:", error);
    throw error;
  }

  return (data ?? []) as SupabaseQuote[];
}

export async function fetchQuoteById(
  userId: string,
  quoteId: string,
): Promise<SupabaseQuote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    if (error?.code !== "PGRST116") {
      console.error("Error fetching quote by id:", error);
    }
    return null;
  }

  return data as SupabaseQuote;
}

export async function updateQuote(
  userId: string,
  quoteId: string,
  payload: NewQuotePayload,
): Promise<SupabaseQuote> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'supabaseQuotes.ts:updateQuote:entry', message: 'updateQuote called', data: { quoteId, status: payload.status, hasStatus: !!payload.status }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,C' }) }).catch(() => {});
  // #endregion
  const updateData: any = {
    chantier_id: payload.chantier_id ?? null,
    client_name: payload.client_name,
    client_email: payload.client_email,
    client_phone: payload.client_phone,
    client_address: payload.client_address,
    project_type: payload.project_type,
    project_description: payload.project_description,
    total_ht: payload.total_ht,
    total_ttc: payload.total_ttc,
    validity_days: payload.validity_days,
    items: payload.items,
    updated_at: new Date().toISOString(),
  };
  
  // Ne mettre à jour le statut que s'il est explicitement fourni
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'supabaseQuotes.ts:updateQuote:before-update', message: 'Before Supabase update', data: { updateDataStatus: updateData.status, hasStatus: 'status' in updateData }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,C' }) }).catch(() => {});
  // #endregion
  const { data, error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", quoteId)
    .eq("user_id", userId)
    .select("*")
    .single();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'supabaseQuotes.ts:updateQuote:after-update', message: 'After Supabase update', data: { error: error?.message, returnedStatus: data?.status }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,C' }) }).catch(() => {});
  // #endregion

  if (error || !data) {
    console.error("Error updating quote:", error);
    throw error;
  }

  return data as SupabaseQuote;
}

export async function insertQuote(
  userId: string,
  payload: NewQuotePayload,
): Promise<SupabaseQuote> {
  const insertData: any = {
    user_id: userId,
    chantier_id: payload.chantier_id ?? null,
    client_name: payload.client_name,
    client_email: payload.client_email,
    client_phone: payload.client_phone,
    client_address: payload.client_address,
    project_type: payload.project_type,
    project_description: payload.project_description,
    total_ht: payload.total_ht,
    total_ttc: payload.total_ttc,
    validity_days: payload.validity_days,
    items: payload.items,
  };
  
  // Ne définir le statut que s'il est explicitement fourni
  if (payload.status !== undefined) {
    insertData.status = payload.status;
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert(insertData)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting quote:", error);
    throw error;
  }

  return data as SupabaseQuote;
}

export async function updateQuoteStatus(
  id: string,
  userId: string,
  status: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé",
): Promise<SupabaseQuote> {
  const updatedAt = new Date().toISOString();
  let updateData: Partial<SupabaseQuote> = {
    status,
    updated_at: updatedAt,
  };

  if (status === "accepté" || status === "validé") {
    updateData.accepted_at = updatedAt;
  }

  let result = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (result.error && (result.error.message?.includes("accepted_at") || result.error.code === "42703")) {
    updateData = { status, updated_at: updatedAt };
    result = await supabase
      .from("quotes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
  }

  if (result.error || !result.data) {
    const err = result.error;
    console.error("Error updating quote status:", err);
    const code = (err as { code?: string } | null)?.code;
    const msg = err?.message ?? "";
    if (
      code === "23514" ||
      msg.includes("check constraint") ||
      msg.includes("violates check") ||
      msg.includes("quotes_status_check")
    ) {
      throw new Error(
        "Le statut « validé » n'est pas encore autorisé en base. Exécutez le script SQL supabase_quotes_status_valide.sql dans l'éditeur SQL Supabase (Dashboard > SQL Editor), puis réessayez."
      );
    }
    throw err;
  }

  return result.data as SupabaseQuote;
}

export async function countQuotesByStatus(
  userId: string,
  statuses: string[],
): Promise<number> {
  const { count, error } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", statuses);

  if (error) {
    console.error("Error counting quotes:", error);
    throw error;
  }

  return count ?? 0;
}

export async function deleteQuote(
  userId: string,
  quoteId: string,
): Promise<void> {
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting quote:", error);
    throw error;
  }
}
