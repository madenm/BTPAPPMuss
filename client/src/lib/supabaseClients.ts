import { supabase } from "./supabaseClient";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface SupabaseClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export type NewClientPayload = {
  name: string;
  email: string;
  phone?: string;
};

function mapFromSupabase(row: SupabaseClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
  };
}

export async function fetchClientsForUser(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
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
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting client:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseClientRow);
}
