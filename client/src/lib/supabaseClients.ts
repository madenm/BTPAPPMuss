import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export interface Client {
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
  relanceCount?: number;
  lastEmailSentAt?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
}

export interface SupabaseClientRow {
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
  relance_count: number | null;
  last_email_sent_at: string | null;
  updated_at: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
}

export type NewClientPayload = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
};

export type UpdateClientPayload = {
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
  relance_count?: number;
  last_email_sent_at?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
};

export type ClientStage =
  | 'all'
  | 'quote'
  | 'quote_followup1'
  | 'quote_followup2'
  | 'won'
  | 'lost';

export const STAGE_LABELS: Record<ClientStage, string> = {
  all: 'Nouveau client',
  quote: 'Devis envoyé',
  quote_followup1: 'Relance devis 1',
  quote_followup2: 'Relance devis 2',
  won: 'Gagné',
  lost: 'Perdu',
};

function mapFromSupabase(row: SupabaseClientRow): Client {
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
    relanceCount: row.relance_count ?? undefined,
    lastEmailSentAt: row.last_email_sent_at ?? undefined,
    street_address: row.street_address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
  };
}

export async function fetchClientsForUser(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching clients:", error);
    throw error;
  }

  return (data ?? []).map((row) => mapFromSupabase(row as SupabaseClientRow));
}

export async function findClientByEmail(
  userId: string,
  email: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("email", email)
    .eq("is_deleted", false)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error finding client by email:", error);
    return null;
  }

  return data ? mapFromSupabase(data as SupabaseClientRow) : null;
}

export async function findClientByName(
  userId: string,
  name: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .eq("is_deleted", false)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error finding client by name:", error);
    return null;
  }

  return data ? mapFromSupabase(data as SupabaseClientRow) : null;
}

export async function getClientById(
  userId: string,
  id: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error getting client by id:", error);
    return null;
  }

  return data ? mapFromSupabase(data as SupabaseClientRow) : null;
}

export async function insertClient(
  userId: string,
  payload: NewClientPayload
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      company: payload.company ?? null,
      notes: payload.notes ?? null,
      stage: "all",
      street_address: payload.street_address ?? null,
      postal_code: payload.postal_code ?? null,
      city: payload.city ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting client:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseClientRow);
}

export async function updateClient(
  userId: string,
  id: string,
  updates: UpdateClientPayload
): Promise<Client> {
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
  if (updates.relance_count !== undefined) updateData.relance_count = updates.relance_count;
  if (updates.last_email_sent_at !== undefined) updateData.last_email_sent_at = updates.last_email_sent_at;
  if (updates.street_address !== undefined) updateData.street_address = updates.street_address ?? null;
  if (updates.postal_code !== undefined) updateData.postal_code = updates.postal_code ?? null;
  if (updates.city !== undefined) updateData.city = updates.city ?? null;

  const { data, error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error updating client:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseClientRow);
}

export async function deleteClient(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
}

export async function softDeleteClient(userId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error soft deleting client:", error);
    throw error;
  }
}

/** Crée un lien partageable pour le formulaire client public. Retourne le token et l'URL complète. */
export async function createClientFormLink(userId: string): Promise<{ token: string; link: string }> {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("client_form_links")
    .insert({ token, user_id: userId })
    .select("token")
    .single();

  if (error || !data) {
    console.error("Error creating client form link:", error);
    throw error;
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/client-form/${data.token}` : "";
  return { token: data.token, link };
}

// Backward compatibility aliases
export type Prospect = Client;
export type SupabaseProspectRow = SupabaseClientRow;
export type NewProspectPayload = NewClientPayload;
export type ProspectUpdatePayload = UpdateClientPayload;
export type ProspectStage = ClientStage;

export const fetchProspectsForUser = fetchClientsForUser;
export const findProspectByEmail = findClientByEmail;
export const findProspectByName = findClientByName;
export const getProspectById = getClientById;
export const insertProspect = insertClient;
export const updateProspect = updateClient;
export const deleteProspect = deleteClient;

