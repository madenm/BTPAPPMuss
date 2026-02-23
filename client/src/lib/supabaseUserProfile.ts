import { supabase } from "./supabaseClient";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_city_postal?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_siret?: string | null;
  company_tva_number?: string | null;
  company_rcs?: string | null;
  company_ape?: string | null;
  company_capital?: string | null;
  insurance_name?: string | null;
  insurance_policy?: string | null;
  qualifications?: string | null;
  default_tva_rate?: string | null;
  default_validity_days?: string | null;
  default_conditions?: string | null;
  invoice_mentions?: string | null;
  quote_prefix?: string | null;
  invoice_prefix?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
  return data as UserProfile | null;
}

export class UserProfileUpdateError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = "UserProfileUpdateError";
  }
}

export type UserProfilePayload = Partial<Omit<UserProfile, 'id' | 'email' | 'created_at' | 'updated_at'>>;

export async function updateUserProfile(
  userId: string,
  payload: UserProfilePayload
): Promise<UserProfile> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const keys: (keyof UserProfilePayload)[] = [
    'full_name', 'logo_url', 'theme_color',
    'company_name', 'company_address', 'company_city_postal',
    'company_phone', 'company_email', 'company_siret',
    'company_tva_number', 'company_rcs', 'company_ape', 'company_capital',
    'insurance_name', 'insurance_policy', 'qualifications',
    'default_tva_rate', 'default_validity_days', 'default_conditions',
    'invoice_mentions', 'quote_prefix', 'invoice_prefix',
  ];
  for (const k of keys) {
    if (payload[k] !== undefined) updatePayload[k] = payload[k];
  }

  const existing = await supabase.from("user_profiles").select("id").eq("id", userId).maybeSingle();

  if (!existing.data) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    if (!authUser?.email) {
      throw new UserProfileUpdateError(
        "Profil introuvable. Reconnectez-vous puis réessayez."
      );
    }
    const { error: insertError } = await supabase.from("user_profiles").insert({
      id: userId,
      email: authUser.email,
      full_name: (authUser.user_metadata?.full_name as string) ?? "",
    });
    if (insertError) {
      console.error("Error ensuring user profile:", insertError);
      throw insertError;
    }
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating user profile:", error);
    const msg = error.message ?? "";
    const isMissingColumn =
      (error as { code?: string }).code === "42703" ||
      msg.includes("column") && msg.toLowerCase().includes("does not exist") ||
      /undefined_column|logo_url|theme_color|company_address|company_city_postal|company_phone|company_email|company_siret/i.test(msg);
    if (isMissingColumn || msg.includes("400")) {
      throw new UserProfileUpdateError(
        "Des colonnes du profil sont absentes. Exécutez le script SQL supabase/migrations/user_profiles_settings_columns.sql dans le SQL Editor de Supabase."
      );
    }
    throw error;
  }
  return data as UserProfile;
}
