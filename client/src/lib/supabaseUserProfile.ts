import { supabase } from "./supabaseClient";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  company_address?: string | null;
  company_city_postal?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_siret?: string | null;
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

export async function updateUserProfile(
  userId: string,
  payload: {
    logo_url?: string | null;
    theme_color?: string | null;
    company_address?: string | null;
    company_city_postal?: string | null;
    company_phone?: string | null;
    company_email?: string | null;
    company_siret?: string | null;
  }
): Promise<UserProfile> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.logo_url !== undefined) updatePayload.logo_url = payload.logo_url;
  if (payload.theme_color !== undefined) updatePayload.theme_color = payload.theme_color;
  if (payload.company_address !== undefined) updatePayload.company_address = payload.company_address;
  if (payload.company_city_postal !== undefined) updatePayload.company_city_postal = payload.company_city_postal;
  if (payload.company_phone !== undefined) updatePayload.company_phone = payload.company_phone;
  if (payload.company_email !== undefined) updatePayload.company_email = payload.company_email;
  if (payload.company_siret !== undefined) updatePayload.company_siret = payload.company_siret;

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
        "Des colonnes du profil sont absentes. Exécutez les scripts SQL supabase-user-settings.sql et supabase_user_profiles_company.sql dans le SQL Editor de Supabase."
      );
    }
    throw error;
  }
  return data as UserProfile;
}
