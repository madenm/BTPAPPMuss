import { supabase, isSupabaseTableMissing } from "./supabaseClient";
import type { Chantier } from "@/context/ChantiersContext";

// Types de chantier (alignés sur les types de projet des devis)
export type TypeChantier = "piscine" | "paysage" | "menuiserie" | "renovation" | "plomberie" | "maconnerie" | "terrasse" | "chauffage" | "isolation" | "electricite" | "peinture" | "autre";

// Représentation telle qu'enregistrée dans Supabase
export interface SupabaseChantier {
  id: string;
  user_id: string;
  nom: string;
  client_name: string;
  client_id: string | null;
  date_debut: string;
  date_fin?: string | null;
  duree: string;
  images: string[] | null;
  statut: "planifié" | "en cours" | "terminé";
  notes: string | null;
  type_chantier: string | null;
  notes_avancement?: string | null;
  montant_devis?: number | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  created_at: string;
}

export type NewChantierPayload = {
  nom: string;
  clientId: string;
  clientName: string;
  dateDebut: string;
  dateFin?: string | null;
  duree: string;
  images: string[];
  statut?: "planifié" | "en cours" | "terminé";
  notes?: string | null;
  typeChantier?: TypeChantier | string | null;
  notesAvancement?: string | null;
  montantDevis?: number | null;
};

function mapFromSupabase(row: SupabaseChantier): Chantier {
  return {
    id: row.id,
    nom: row.nom,
    clientId: row.client_id ?? "",
    clientName: row.client_name,
    dateDebut: row.date_debut,
    dateFin: row.date_fin ?? undefined,
    duree: row.duree,
    images: row.images ?? [],
    statut: row.statut,
    notes: row.notes ?? undefined,
    typeChantier: row.type_chantier ?? undefined,
    notesAvancement: row.notes_avancement ?? undefined,
    montantDevis: row.montant_devis ?? undefined,
  };
}

export async function fetchChantiersForUser(userId: string): Promise<Chantier[]> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching chantiers:", error);
    throw error;
  }

  const rows = (data ?? []) as SupabaseChantier[];
  const nonDeleted = rows.filter((row) => row.is_deleted !== true);
  return nonDeleted.map(mapFromSupabase);
}

/** Charge les chantiers assignés à un membre d'équipe (utilisé sans session Supabase). */
export async function fetchChantiersForTeamMember(teamMemberId: string): Promise<Chantier[]> {
  const { data, error } = await supabase.rpc("get_chantiers_for_team_member", {
    p_team_member_id: teamMemberId,
  });

  if (error) {
    console.error("Error fetching chantiers for team member:", error);
    return [];
  }

  const rawArray = Array.isArray(data) ? data : (data == null ? [] : [data]);
  return rawArray.map((row: SupabaseChantier) => mapFromSupabase(row));
}

export async function insertChantier(
  userId: string,
  payload: NewChantierPayload,
): Promise<Chantier> {
  // Validation des champs requis
  if (!payload.nom?.trim()) {
    throw new Error("Le nom du projet est requis");
  }
  if (!payload.dateDebut?.trim()) {
    throw new Error("La date de début est requise");
  }
  if (!payload.duree?.trim()) {
    throw new Error("La durée est requise");
  }
  if (!payload.clientName?.trim()) {
    throw new Error("Le nom du client est requis");
  }

  // Préparer les données d'insertion
  const insertData: Record<string, any> = {
    user_id: userId,
    nom: payload.nom.trim(),
    client_name: payload.clientName.trim(),
    date_debut: payload.dateDebut.trim(),
    duree: payload.duree.trim(),
    images: payload.images || [],
    statut: payload.statut ?? "planifié",
  };

  // Ajouter client_id seulement si c'est un UUID valide
  if (payload.clientId && payload.clientId.trim()) {
    const trimmedClientId = payload.clientId.trim();
    // Vérifier que c'est un UUID valide (format basique)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedClientId)) {
      insertData.client_id = trimmedClientId;
    } else {
      console.warn("Invalid client_id format, setting to null:", trimmedClientId);
      insertData.client_id = null;
    }
  } else {
    insertData.client_id = null;
  }

  // Ajouter les champs optionnels
  if (payload.notes !== undefined) {
    insertData.notes = payload.notes?.trim() || null;
  }
  if (payload.typeChantier !== undefined) {
    insertData.type_chantier = payload.typeChantier?.trim() || null;
  }
  if (payload.notesAvancement !== undefined) {
    insertData.notes_avancement = payload.notesAvancement?.trim() || null;
  }
  if (payload.dateFin !== undefined && payload.dateFin?.trim()) {
    insertData.date_fin = payload.dateFin.trim().slice(0, 10);
  }
  if (payload.montantDevis !== undefined && payload.montantDevis != null && !isNaN(Number(payload.montantDevis))) {
    insertData.montant_devis = Number(payload.montantDevis);
  }

  const { data, error } = await supabase
    .from("chantiers")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    console.error("Error inserting chantier:", error);
    console.error("Insert data:", insertData);
    throw error;
  }

  if (!data) {
    throw new Error("Aucune donnée retournée après l'insertion du projet");
  }

  return mapFromSupabase(data as SupabaseChantier);
}

export async function updateChantierRemote(
  id: string,
  userId: string,
  updates: Partial<Chantier>,
): Promise<Chantier> {
  // Construire l'objet de mise à jour avec uniquement les champs définis
  const updateData: Record<string, any> = {};
  
  if (updates.nom !== undefined) updateData.nom = updates.nom;
  if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
  if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
  if (updates.dateDebut !== undefined) updateData.date_debut = updates.dateDebut;
  if (updates.duree !== undefined) updateData.duree = updates.duree;
  if (updates.images !== undefined) updateData.images = updates.images;
  if (updates.statut !== undefined) updateData.statut = updates.statut;
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes || null;
  }
  if (updates.typeChantier !== undefined) {
    updateData.type_chantier = updates.typeChantier || null;
  }
  if (updates.notesAvancement !== undefined) {
    updateData.notes_avancement = updates.notesAvancement || null;
  }
  if (updates.montantDevis !== undefined) {
    updateData.montant_devis = updates.montantDevis ?? null;
  }
  if (updates.dateFin !== undefined) {
    updateData.date_fin = updates.dateFin?.trim() ? updates.dateFin.trim().slice(0, 10) : null;
  }

  const { data, error } = await supabase
    .from("chantiers")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error updating chantier:", error);
    throw error;
  }

  return mapFromSupabase(data as SupabaseChantier);
}

/** Soft delete: marque le chantier comme supprimé (is_deleted = true, deleted_at = now). */
export async function softDeleteChantier(id: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("chantiers")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("Error soft deleting chantier:", error);
    throw error;
  }
  if (!data || (Array.isArray(data) ? data.length === 0 : !data)) {
    throw new Error('Chantier non trouvé ou suppression non autorisée');
  }
}
