import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export type TariffCategory = "matériau" | "service" | "main-d'œuvre" | "location" | "sous-traitance" | "transport" | "équipement" | "fourniture" | "autre";

export interface UserTariff {
  id: string;
  user_id: string;
  label: string;
  category: TariffCategory;
  unit: string;
  price_ht: number;
  created_at: string;
  updated_at: string;
}

export type NewUserTariffPayload = {
  label: string;
  category: TariffCategory;
  unit: string;
  price_ht: number;
};

export type UpdateUserTariffPayload = Partial<NewUserTariffPayload>;

export async function fetchTariffs(userId: string): Promise<UserTariff[]> {
  const { data, error } = await supabase
    .from("user_tariffs")
    .select("*")
    .eq("user_id", userId)
    .order("label", { ascending: true });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching tariffs:", error);
    throw error;
  }

  return (data ?? []) as UserTariff[];
}

export async function insertTariff(
  userId: string,
  payload: NewUserTariffPayload
): Promise<UserTariff> {
  const { data, error } = await supabase
    .from("user_tariffs")
    .insert({
      user_id: userId,
      label: payload.label.trim(),
      category: payload.category,
      unit: payload.unit.trim() || "u",
      price_ht: Number(payload.price_ht) >= 0 ? Number(payload.price_ht) : 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting tariff:", error);
    throw error;
  }

  return data as UserTariff;
}

export async function insertTariffsBatch(
  userId: string,
  payloads: NewUserTariffPayload[]
): Promise<{ inserted: number; errors: number }> {
  if (payloads.length === 0) return { inserted: 0, errors: 0 };
  const now = new Date().toISOString();
  const rows = payloads.map((p) => ({
    user_id: userId,
    label: p.label.trim(),
    category: p.category,
    unit: p.unit.trim() || "u",
    price_ht: Number(p.price_ht) >= 0 ? Number(p.price_ht) : 0,
    updated_at: now,
  }));
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("user_tariffs")
      .insert(chunk)
      .select();
    if (error) {
      console.error("Batch insert error:", error);
      errors += chunk.length;
    } else {
      inserted += data?.length ?? 0;
    }
  }
  return { inserted, errors };
}

export async function updateTariff(
  id: string,
  userId: string,
  payload: UpdateUserTariffPayload
): Promise<UserTariff> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.label !== undefined) updates.label = payload.label.trim();
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.unit !== undefined) updates.unit = payload.unit.trim() || "u";
  if (payload.price_ht !== undefined)
    updates.price_ht = Number(payload.price_ht) >= 0 ? Number(payload.price_ht) : 0;

  const { data, error } = await supabase
    .from("user_tariffs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating tariff:", error);
    throw error;
  }

  return data as UserTariff;
}

export async function deleteTariff(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_tariffs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting tariff:", error);
    throw error;
  }
}
