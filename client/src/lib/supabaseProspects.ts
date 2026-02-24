import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export interface Prospect {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  stage: string;
  createdAt: string;
  linkedQuoteId?: string;
  linkedInvoiceId?: string;
  lastActionAt?: string;
  lastActionType?: string;
}

export interface SupabaseProspectRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  stage: string;
  created_at: string;
  linked_quote_id: string | null;
  linked_invoice_id: string | null;
  last_action_at: string | null;
  last_action_type: string | null;
}

export type NewProspectPayload = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
};

export type ProspectUpdatePayload = {
  stage?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  linked_quote_id?: string | null;
  linked_invoice_id?: string | null;
  last_action_at?: string;
  last_action_type?: string;
};

export type ProspectStage =
  | 'all'
  | 'quote'
  | 'quote_followup1'
  | 'quote_followup2'
  | 'invoice'
  | 'invoice_followup1'
  | 'invoice_followup2'
  | 'won'
  | 'lost';

export const STAGE_LABELS: Record<ProspectStage, string> = {
  all: 'Nouveau prospect',
  quote: 'Devis envoyé',
  quote_followup1: 'Relance devis 1',
  quote_followup2: 'Relance devis 2',
  invoice: 'Facture envoyée',
  invoice_followup1: 'Relance facture 1',
  invoice_followup2: 'Relance facture 2',
  won: 'Gagné',
  lost: 'Perdu',
};

function mapFromSupabase(row: SupabaseProspectRow): Prospect {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
    stage: row.stage,
    createdAt: row.created_at,
    linkedQuoteId: row.linked_quote_id ?? undefined,
    linkedInvoiceId: row.linked_invoice_id ?? undefined,
    lastActionAt: row.last_action_at ?? undefined,
    lastActionType: row.last_action_type ?? undefined,
  };
}

export async function fetchProspectsForUser(userId: string): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching prospects:", error);
    throw error;
  }

  return (data ?? []).map((row) => mapFromSupabase(row as SupabaseProspectRow));
}

export async function insertProspect(
  userId: string,
  payload: NewProspectPayload
): Promise<Prospect> {
  const { data, error } = await supabase
    .from("prospects")
    .insert({
      user_id: userId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      company: payload.company ?? null,
      notes: payload.notes ?? null,
      stage: "all",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting prospect:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseProspectRow);
}

export async function updateProspect(
  userId: string,
  id: string,
  updates: ProspectUpdatePayload
): Promise<Prospect> {
  const updateData: Record<string, unknown> = {};
  if (updates.stage !== undefined) updateData.stage = updates.stage;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.phone !== undefined) updateData.phone = updates.phone ?? null;
  if (updates.company !== undefined) updateData.company = updates.company ?? null;
  if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;
  if (updates.linked_quote_id !== undefined) updateData.linked_quote_id = updates.linked_quote_id;
  if (updates.linked_invoice_id !== undefined) updateData.linked_invoice_id = updates.linked_invoice_id;
  if (updates.last_action_at !== undefined) updateData.last_action_at = updates.last_action_at;
  if (updates.last_action_type !== undefined) updateData.last_action_type = updates.last_action_type;

  const { data, error } = await supabase
    .from("prospects")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error updating prospect:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseProspectRow);
}

export async function deleteProspect(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("prospects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting prospect:", error);
    throw error;
  }
}
