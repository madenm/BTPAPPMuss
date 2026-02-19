import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
  created_at?: string;
}

export interface SupabaseClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
}

export type NewClientPayload = {
  name: string;
  email: string;
  phone?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
};

export type UpdateClientPayload = Partial<NewClientPayload>;

function mapFromSupabase(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string) ?? "",
    street_address: (row.street_address as string) || undefined,
    postal_code: (row.postal_code as string) || undefined,
    city: (row.city as string) || undefined,
    created_at: (row.created_at as string) || undefined,
  };
}

export async function fetchClientsForUser(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching clients:", error);
    throw error;
  }

  return (data ?? []).map(mapFromSupabase);
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

  return mapFromSupabase(data);
}

export async function updateClient(
  userId: string,
  clientId: string,
  payload: UpdateClientPayload
): Promise<Client> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.email !== undefined) updates.email = payload.email;
  if (payload.phone !== undefined) updates.phone = payload.phone;
  if (payload.street_address !== undefined) updates.street_address = payload.street_address;
  if (payload.postal_code !== undefined) updates.postal_code = payload.postal_code;
  if (payload.city !== undefined) updates.city = payload.city;

  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", clientId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error updating client:", error);
    throw error;
  }

  return mapFromSupabase(data);
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
