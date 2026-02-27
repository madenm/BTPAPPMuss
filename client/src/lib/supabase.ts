import { supabase } from './supabaseClient';

// Supabase client configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hvnjlxxcxfxvuwlmnwtw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bmpseHhjeGZ4dnV3bG1ud3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzA3ODIsImV4cCI6MjA3OTU0Njc4Mn0.SmL4eqGq8XLfbLOolxGdafLhS6eeTgYGGn1w9gcrWdU';

const TEAM_MEMBERS_TABLE_MISSING_KEY = 'aos_team_members_table_missing';

/** En mode membre d'équipe, l'ID du propriétaire (pour charger les données à sa place). Défini par TeamDashboard. */
declare global {
  interface Window {
    __AOS_TEAM_EFFECTIVE_USER_ID__?: string | null;
  }
}

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.__AOS_TEAM_EFFECTIVE_USER_ID__) {
    return window.__AOS_TEAM_EFFECTIVE_USER_ID__;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  status: 'actif' | 'inactif';
  login_code: string;
  user_id: string | null;
  // Permissions complètes pour toutes les fonctionnalités
  can_view_dashboard?: boolean;
  can_use_estimation?: boolean;
  can_view_all_chantiers?: boolean;
  can_manage_chantiers?: boolean;
  can_view_planning?: boolean;
  can_manage_planning?: boolean;
  can_access_crm?: boolean;
  can_create_quotes?: boolean;
  can_manage_invoices?: boolean;
  can_use_ai_visualization?: boolean;
  can_manage_team?: boolean;
  can_manage_clients?: boolean;
  created_at: string;
  updated_at: string;
}

function isTeamMembersTableMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === 'PGRST205' ||
    (typeof e.message === 'string' &&
      e.message.includes('team_members') &&
      (e.message.includes('schema cache') || e.message.includes('not find')))
  );
}

/** Récupère tous les membres (actifs + inactifs) pour la page Gestion équipe */
export async function fetchAllTeamMembers(): Promise<TeamMember[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (typeof window !== 'undefined') sessionStorage.removeItem(TEAM_MEMBERS_TABLE_MISSING_KEY);

    return data || [];
  } catch (error: unknown) {
    if (isTeamMembersTableMissing(error)) {
      const alreadyWarned = typeof window !== 'undefined' && sessionStorage.getItem(TEAM_MEMBERS_TABLE_MISSING_KEY) === '1';
      if (typeof window !== 'undefined') sessionStorage.setItem(TEAM_MEMBERS_TABLE_MISSING_KEY, '1');
      if (!alreadyWarned) {
        console.warn(
          "Table 'team_members' introuvable. Exécutez le script SQL 'supabase-team-and-assignments.sql' dans le SQL Editor de votre projet Supabase pour activer la gestion d'équipe."
        );
      }
      return [];
    }
    console.error('Error fetching team members:', error);
    return [];
  }
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'actif')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (typeof window !== 'undefined') sessionStorage.removeItem(TEAM_MEMBERS_TABLE_MISSING_KEY);
    
    return data || [];
  } catch (error: unknown) {
    if (isTeamMembersTableMissing(error)) {
      const alreadyWarned = typeof window !== 'undefined' && sessionStorage.getItem(TEAM_MEMBERS_TABLE_MISSING_KEY) === '1';
      if (typeof window !== 'undefined') sessionStorage.setItem(TEAM_MEMBERS_TABLE_MISSING_KEY, '1');
      if (!alreadyWarned) {
        console.warn(
          "Table 'team_members' introuvable. Exécutez le script SQL 'supabase-team-and-assignments.sql' dans le SQL Editor de votre projet Supabase pour activer la gestion d'équipe."
        );
      }
      return [];
    }
    console.error('Error fetching team members:', error);
    return [];
  }
}

export async function createTeamMember(member: Omit<TeamMember, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<TeamMember | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // Generate a random 6-digit code if not provided
    const loginCode = member.login_code || Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        ...member,
        login_code: loginCode,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating team member:', error);
    return null;
  }
}

export async function updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const updatePayload = { ...updates, updated_at: new Date().toISOString() };
    
    const { data, error } = await supabase
      .from('team_members')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating team member:', error);
    return null;
  }
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Error deleting team member:', error);
    return false;
  }
}

export async function verifyTeamMemberCode(code: string, invitationToken?: string): Promise<TeamMember | null> {
  try {
    // Si un token d'invitation est fourni, utiliser la RPC (fonction SECURITY DEFINER) pour éviter la RLS
    if (invitationToken) {
      const { data, error } = await supabase.rpc('verify_invite_code', {
        invite_token: invitationToken,
        login_code: code,
      });

      if (error || data == null) return null;
      return data as TeamMember;
    } else {
      // Sinon, vérification normale avec auth
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('login_code', code)
        .eq('status', 'actif')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;
      return data;
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    return null;
  }
}

/** Normalise les permissions d'un membre (toujours des booléens). */
function normalizeMemberPermissions(m: Record<string, unknown>): TeamMember {
  const b = (v: unknown) => v === true || v === 'true';
  return {
    ...m,
    can_view_dashboard: b(m.can_view_dashboard),
    can_use_estimation: b(m.can_use_estimation),
    can_view_all_chantiers: b(m.can_view_all_chantiers),
    can_manage_chantiers: b(m.can_manage_chantiers),
    can_view_planning: b(m.can_view_planning),
    can_manage_planning: b(m.can_manage_planning),
    can_access_crm: b(m.can_access_crm),
    can_create_quotes: b(m.can_create_quotes),
    can_manage_invoices: b(m.can_manage_invoices),
    can_use_ai_visualization: b(m.can_use_ai_visualization),
    can_manage_team: b(m.can_manage_team),
    can_manage_clients: b(m.can_manage_clients),
  } as TeamMember;
}

/**
 * Rafraîchit les données du membre (dont les permissions) depuis la base.
 * Utiliser au chargement du dashboard pour avoir les dernières permissions.
 */
export async function refreshTeamMember(memberId: string, loginCode: string): Promise<TeamMember | null> {
  try {
    const { data, error } = await supabase.rpc('get_team_member_refresh', {
      p_member_id: memberId,
      p_login_code: loginCode,
    });
    if (error || data == null) return null;
    return normalizeMemberPermissions(data as Record<string, unknown>);
  } catch (error) {
    console.error('Error refreshing team member:', error);
    return null;
  }
}

// Admin code functions
export interface AdminCode {
  id: string;
  code: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function verifyAdminCode(code: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('admin_codes')
      .select('*')
      .eq('code', code)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error verifying admin code:', error);
    return false;
  }
}

export async function getAdminCode(): Promise<AdminCode | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('admin_codes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error('Error getting admin code:', error);
    return null;
  }
}

// Team Invitation functions
export interface TeamInvitation {
  id: string;
  user_id: string;
  team_member_id: string | null;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
  updated_at: string;
}

// Générer un token unique pour l'invitation
function generateInvitationToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

/** Récupère la dernière invitation pour un membre (pour réutiliser le même lien). */
async function getLatestInvitationByTeamMember(teamMemberId: string): Promise<TeamInvitation | null> {
  const list = await fetchTeamInvitationsByMember(teamMemberId);
  return list.length > 0 ? list[0] : null;
}

// Créer une invitation pour un membre d'équipe (réutilise le même lien si une invitation existe déjà)
export async function createTeamInvitation(
  teamMemberId: string,
  email: string
): Promise<{ invitation: TeamInvitation | null; inviteLink: string | null }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const existing = await getLatestInvitationByTeamMember(teamMemberId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

    if (existing) {
      // Réutiliser le même lien : mettre à jour expiration et remettre used=false pour que le lien reste valide à chaque connexion
      const { error } = await supabase
        .from('team_invitations')
        .update({
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
          used: false,
        })
        .eq('id', existing.id);

      if (error) throw error;

      const inviteLink = `${window.location.origin}/invite/${existing.token}`;
      return { invitation: { ...existing, expires_at: expiresAt.toISOString(), used: false }, inviteLink };
    }

    const token = generateInvitationToken();
    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        user_id: userId,
        team_member_id: teamMemberId,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const inviteLink = `${window.location.origin}/invite/${token}`;
    return { invitation: data, inviteLink };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return { invitation: null, inviteLink: null };
  }
}

/** Récupère l'historique des invitations pour un membre */
export async function fetchTeamInvitationsByMember(teamMemberId: string): Promise<TeamInvitation[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('Error fetching invitations by member:', error);
    return [];
  }
}

// Vérifier et récupérer une invitation par token
export async function getInvitationByToken(
  token: string
): Promise<TeamInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (error || !data) return null;

    // Vérifier si l'invitation a expiré
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting invitation:', error);
    return null;
  }
}

// Marquer une invitation comme utilisée
export async function markInvitationAsUsed(token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .update({
        used: true,
        updated_at: new Date().toISOString(),
      })
      .eq('token', token);

    return !error;
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    return false;
  }
}

export async function updateAdminCode(newCode: string): Promise<AdminCode | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    // First, get the existing admin code
    const existing = await getAdminCode();
    
    if (existing) {
      // Update existing code
      const { data, error } = await supabase
        .from('admin_codes')
        .update({
          code: newCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new admin code
      const { data, error } = await supabase
        .from('admin_codes')
        .insert({
          code: newCode,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error updating admin code:', error);
    return null;
  }
}

// Chantier assignments (affectation chantier <-> membre d'équipe)

/** Récupère les affectations pour plusieurs membres en une requête. Retourne Map<memberId, chantierIds[]> */
export async function fetchChantierAssignmentsMap(teamMemberIds: string[]): Promise<Record<string, string[]>> {
  if (teamMemberIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('chantier_assignments')
      .select('team_member_id, chantier_id')
      .in('team_member_id', teamMemberIds);

    if (error) throw error;
    const map: Record<string, string[]> = {};
    for (const id of teamMemberIds) map[id] = [];
    for (const row of (data ?? []) as { team_member_id: string; chantier_id: string }[]) {
      if (!map[row.team_member_id]) map[row.team_member_id] = [];
      map[row.team_member_id].push(row.chantier_id);
    }
    return map;
  } catch (error) {
    console.error('Error fetching chantier assignments map:', error);
    return {};
  }
}

export async function fetchChantierAssignmentsByTeamMember(teamMemberId: string): Promise<string[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('chantier_assignments')
      .select('chantier_id')
      .eq('team_member_id', teamMemberId);

    if (error) throw error;
    return (data ?? []).map((row: { chantier_id: string }) => row.chantier_id);
  } catch (error) {
    console.error('Error fetching chantier assignments by team member:', error);
    return [];
  }
}

export async function fetchChantierAssignmentsByChantier(chantierId: string): Promise<TeamMember[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data: assignments, error: assignError } = await supabase
      .from('chantier_assignments')
      .select('team_member_id')
      .eq('chantier_id', chantierId);

    if (assignError || !assignments?.length) return [];

    const ids = assignments.map((a: { team_member_id: string }) => a.team_member_id);
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .in('id', ids)
      .eq('user_id', userId);

    if (membersError) throw membersError;
    return members ?? [];
  } catch (error) {
    console.error('Error fetching chantier assignments by chantier:', error);
    return [];
  }
}

export async function addChantierAssignment(chantierId: string, teamMemberId: string): Promise<void> {
  try {
    await getCurrentUserId();
    const { error } = await supabase
      .from('chantier_assignments')
      .upsert(
        { chantier_id: chantierId, team_member_id: teamMemberId },
        { onConflict: ['chantier_id', 'team_member_id'] }
      );
    if (error) throw error;
  } catch (error) {
    console.error('Error adding chantier assignment:', error);
    throw error;
  }
}

export async function removeChantierAssignment(chantierId: string, teamMemberId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chantier_assignments')
      .delete()
      .eq('chantier_id', chantierId)
      .eq('team_member_id', teamMemberId);
    if (error) throw error;
  } catch (error) {
    console.error('Error removing chantier assignment:', error);
    throw error;
  }
}

export async function setChantierAssignmentsForMember(teamMemberId: string, chantierIds: string[]): Promise<void> {
  try {
    const current = await fetchChantierAssignmentsByTeamMember(teamMemberId);
    const toAdd = chantierIds.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !chantierIds.includes(id));

    for (const chantierId of toRemove) {
      await removeChantierAssignment(chantierId, teamMemberId);
    }
    for (const chantierId of toAdd) {
      await addChantierAssignment(chantierId, teamMemberId);
    }
  } catch (error) {
    console.error('Error setting chantier assignments for member:', error);
    throw error;
  }
}

