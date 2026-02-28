import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export interface QuoteSubItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Unité (ex. Pièce, Forfait, m², m, jour, lot, U). Affichée dans le PDF. */
  unit?: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Unité (ex. Pièce, Forfait, m², m, jour, lot, U). Affichée dans le PDF. */
  unit?: string;
  subItems?: QuoteSubItem[];
}

export interface SupabaseQuote {
  id: string;
  user_id: string;
  contact_id?: string | null;
  chantier_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  project_type: string | null;
  project_description: string | null;
  total_ht: number;
  total_ttc: number;
  status: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé" | "signé";
  validity_days: number | null;
  items: QuoteItem[] | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  quote_pdf_base64?: string | null;
  quote_signature_rect_coords?: unknown | null;
}

export type NewQuotePayload = {
  contact_id?: string | null;
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
  status?: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé" | "signé";
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
    if (isSupabaseTableMissing(error)) return [];
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
    if (isSupabaseTableMissing(error)) return [];
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
    if (!isSupabaseTableMissing(error) && error?.code !== "PGRST116") {
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
  const { data: currentQuote, error: currentError } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("user_id", userId)
    .single();

  if (currentError) {
    console.error("Error fetching quote status:", currentError);
    throw currentError;
  }

  if (currentQuote?.status === "signé") {
    throw new Error("Ce devis est signé et ne peut plus être modifié.");
  }

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
  
  const { data, error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", quoteId)
    .eq("user_id", userId)
    .select("*")
    .single();

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
    contact_id: payload.contact_id ?? null,
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
  status: "brouillon" | "envoyé" | "accepté" | "refusé" | "expiré" | "validé" | "signé",
): Promise<SupabaseQuote> {
  const updatedAt = new Date().toISOString();
  let updateData: Partial<SupabaseQuote> = {
    status,
    updated_at: updatedAt,
  };

  if (status === "accepté" || status === "validé" || status === "signé") {
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

/**
 * Vérifie si un devis a été signé en cherchant une signature dans quote_signatures
 */
export async function hasQuoteBeenSigned(quoteId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("quote_signatures")
      .select("id")
      .eq("quote_id", quoteId)
      .limit(1);

    if (error && !isSupabaseTableMissing(error)) {
      console.error("Error checking quote signature:", error);
    }
    return data && data.length > 0;
  } catch (err) {
    console.error("Error in hasQuoteBeenSigned:", err);
    return false;
  }
}

/**
 * Calcule si la validité d'un devis a dépassé
 */
export function isQuoteValidityExpired(quote: SupabaseQuote): boolean {
  if (!quote.created_at || !quote.validity_days) return false;
  const createdDate = new Date(quote.created_at);
  const expiryDate = new Date(createdDate.getTime() + quote.validity_days * 24 * 60 * 60 * 1000);
  return new Date() > expiryDate;
}

/**
 * Récupère le lien de signature d'un devis
 */
export async function getQuoteSignatureLink(quoteId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("quote_signature_links")
      .select("token")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && !isSupabaseTableMissing(error)) {
      console.error("Error fetching quote signature link:", error);
      return null;
    }

    if (!data?.token) return null;

    // Construire l'URL complète
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/sign-quote/${data.token}`;
  } catch (err) {
    console.error("Error in getQuoteSignatureLink:", err);
    return null;
  }
}

/**
 * Génère un nouveau lien de signature pour un devis côté client.
 * Insère dans quote_signature_links via Supabase (l'utilisateur est authentifié).
 */
export async function generateSignatureLink(quoteId: string, userId: string, expirationDays = 30): Promise<string | null> {
  try {
    const token = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("quote_signature_links")
      .insert({
        quote_id: quoteId,
        token,
        user_id: userId,
        expires_at: expiresAt,
      });

    if (error) {
      console.error("❌ Erreur insertion quote_signature_links:", error);
      return null;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const quoteIdQuery = encodeURIComponent(quoteId);
    return `${origin}/sign-quote/${token}?qid=${quoteIdQuery}`;
  } catch (err) {
    console.error("❌ Erreur generateSignatureLink:", err);
    return null;
  }
}
