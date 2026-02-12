import { supabase } from './supabaseClient';

export interface PlanningNote {
  id: string;
  user_id: string;
  note_date: string; // YYYY-MM-DD
  content: string;
  created_at: string;
  updated_at: string;
}

/** Get current user id (owner when team member, else auth user). */
async function getEffectiveUserId(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.__AOS_TEAM_EFFECTIVE_USER_ID__) {
    return window.__AOS_TEAM_EFFECTIVE_USER_ID__;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Fetch planning notes for a date range (e.g. month). */
export async function fetchPlanningNotesForRange(
  startDate: string,
  endDate: string
): Promise<PlanningNote[]> {
  const userId = await getEffectiveUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('planning_notes')
    .select('*')
    .eq('user_id', userId)
    .gte('note_date', startDate)
    .lte('note_date', endDate)
    .order('note_date', { ascending: true });

  if (error) {
    console.error('Error fetching planning notes:', error);
    return [];
  }
  return (data ?? []) as PlanningNote[];
}

/** Get note for a single day (if any). */
export async function fetchPlanningNoteForDate(
  noteDate: string
): Promise<PlanningNote | null> {
  const userId = await getEffectiveUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('planning_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('note_date', noteDate)
    .maybeSingle();

  if (error) {
    console.error('Error fetching planning note:', error);
    return null;
  }
  return data as PlanningNote | null;
}

/** Upsert note for a day (one row per day, content = full text). */
export async function upsertPlanningNote(
  noteDate: string,
  content: string
): Promise<PlanningNote | null> {
  const userId = await getEffectiveUserId();
  if (!userId) return null;

  const payload = {
    user_id: userId,
    note_date: noteDate,
    content: content.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('planning_notes')
    .upsert(payload, {
      onConflict: 'user_id,note_date',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting planning note:', error);
    return null;
  }
  return data as PlanningNote;
}

/** Delete note for a day. */
export async function deletePlanningNote(noteDate: string): Promise<boolean> {
  const userId = await getEffectiveUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('planning_notes')
    .delete()
    .eq('user_id', userId)
    .eq('note_date', noteDate);

  if (error) {
    console.error('Error deleting planning note:', error);
    return false;
  }
  return true;
}
