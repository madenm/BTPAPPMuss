import { supabase } from "./supabaseClient";

export interface Prospect {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  stage: string;
  createdAt: string;
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
  };
}

export async function fetchProspectsForUser(userId: string): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching prospects:", error);
    throw error;
  }

  return (data ?? []).map(mapFromSupabase);
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
