import { supabase } from "./supabaseClient";

export type EmailProvider = "gmail" | "outlook";

export interface EmailConnection {
  provider: EmailProvider;
  fromEmail: string | null;
  updatedAt: string;
}

interface SupabaseEmailConnectionRow {
  user_id: string;
  provider: string;
  from_email: string | null;
  updated_at: string;
}

function mapFromSupabase(row: SupabaseEmailConnectionRow): EmailConnection {
  return {
    provider: row.provider as EmailProvider,
    fromEmail: row.from_email ?? null,
    updatedAt: row.updated_at,
  };
}

export async function getEmailConnection(userId: string): Promise<EmailConnection | null> {
  const { data, error } = await supabase
    .from("user_email_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching email connection:", error);
    throw error;
  }

  return data ? mapFromSupabase(data as SupabaseEmailConnectionRow) : null;
}

export async function setEmailConnection(
  userId: string,
  payload: { provider: EmailProvider; fromEmail?: string | null }
): Promise<EmailConnection> {
  const { data, error } = await supabase
    .from("user_email_connections")
    .upsert(
      {
        user_id: userId,
        provider: payload.provider,
        from_email: payload.fromEmail?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error saving email connection:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseEmailConnectionRow);
}

export async function disconnectEmail(userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_email_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error disconnecting email:", error);
    throw error;
  }
}
