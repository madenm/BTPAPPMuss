import { supabase, isSupabaseTableMissing } from "./supabaseClient";
import { getPublicUrl, removeFile } from "./supabaseStorage";

export type ChantierDocumentType = "bon_commande" | "doc_fournisseur" | "autre" | "image";

export interface ChantierDocument {
  id: string;
  chantier_id: string;
  user_id: string;
  document_type: ChantierDocumentType;
  file_path: string;
  file_name: string;
  amount_ht: number | null;
  created_at: string;
}

export type NewChantierDocumentPayload = {
  document_type: ChantierDocumentType;
  file_path: string;
  file_name: string;
  amount_ht?: number | null;
};

const DOCUMENT_TYPE_LABELS: Record<ChantierDocumentType, string> = {
  bon_commande: "Bon de commande",
  doc_fournisseur: "Document fournisseur",
  autre: "Autre",
  image: "Image",
};

export function getDocumentTypeLabel(type: ChantierDocumentType): string {
  return DOCUMENT_TYPE_LABELS[type];
}

/** Types de document qui portent un coût pour la rentabilité */
export const COST_DOCUMENT_TYPES: ChantierDocumentType[] = ["bon_commande", "doc_fournisseur"];

export async function fetchChantierDocumentsByChantierId(
  chantierId: string,
  userId: string
): Promise<ChantierDocument[]> {
  const { data, error } = await supabase
    .from("chantier_documents")
    .select("*")
    .eq("chantier_id", chantierId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching chantier documents:", error);
    throw error;
  }

  return (data ?? []) as ChantierDocument[];
}

export async function insertChantierDocument(
  userId: string,
  chantierId: string,
  payload: NewChantierDocumentPayload
): Promise<ChantierDocument> {
  const { data, error } = await supabase
    .from("chantier_documents")
    .insert({
      chantier_id: chantierId,
      user_id: userId,
      document_type: payload.document_type,
      file_path: payload.file_path,
      file_name: payload.file_name,
      amount_ht: payload.amount_ht ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (isSupabaseTableMissing(error)) {
      throw new Error(
        "La table des documents projet n'existe pas encore. Exécutez la migration 'chantier_documents' dans Supabase (SQL Editor)."
      );
    }
    console.error("Error inserting chantier document:", error);
    throw error;
  }

  return data as ChantierDocument;
}

export async function deleteChantierDocument(userId: string, documentId: string): Promise<void> {
  const { data: doc, error: fetchError } = await supabase
    .from("chantier_documents")
    .select("file_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !doc) {
    if (fetchError && isSupabaseTableMissing(fetchError)) return;
    console.error("Error fetching chantier document for delete:", fetchError);
    throw fetchError || new Error("Document not found");
  }

  const { error } = await supabase
    .from("chantier_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) {
    if (isSupabaseTableMissing(error)) return;
    console.error("Error deleting chantier document:", error);
    throw error;
  }

  try {
    await removeFile((doc as ChantierDocument).file_path);
  } catch (e) {
    console.warn("Could not remove file from storage:", e);
  }
}

/** URL publique pour afficher ou télécharger le fichier */
export function getDocumentPublicUrl(doc: ChantierDocument): string {
  return getPublicUrl(doc.file_path);
}
