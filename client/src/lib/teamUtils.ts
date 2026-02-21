import type { TeamMember } from '@/lib/supabase';
import { formatDateShort } from './planningUtils';
import { parseLocalDate, calculateEndDate } from './planningUtils';

/** Permissions par défaut selon le rôle */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Partial<TeamMember>> = {
  'Chef de projet': {
    can_view_dashboard: true,
    can_view_planning: true,
    can_manage_planning: true,
    can_manage_chantiers: true,
    can_view_all_chantiers: true,
    can_access_crm: false,
    can_create_quotes: false,
    can_manage_invoices: false,
    can_manage_team: false,
    can_manage_clients: false,
    can_use_estimation: false,
    can_use_ai_visualization: false,
  },
  Ouvrier: {
    can_view_dashboard: true,
    can_view_planning: true,
    can_manage_planning: false,
    can_manage_chantiers: false,
    can_view_all_chantiers: false,
    can_access_crm: false,
    can_create_quotes: false,
    can_manage_invoices: false,
    can_manage_team: false,
    can_manage_clients: false,
    can_use_estimation: false,
    can_use_ai_visualization: false,
  },
  Commercial: {
    can_view_dashboard: true,
    can_view_planning: false,
    can_manage_planning: false,
    can_manage_chantiers: false,
    can_view_all_chantiers: false,
    can_access_crm: true,
    can_create_quotes: true,
    can_manage_invoices: true,
    can_manage_team: false,
    can_manage_clients: false,
    can_use_estimation: false,
    can_use_ai_visualization: false,
  },
  Assistant: {
    can_view_dashboard: true,
    can_view_planning: true,
    can_manage_planning: false,
    can_manage_chantiers: false,
    can_view_all_chantiers: true,
    can_access_crm: true,
    can_create_quotes: true,
    can_manage_invoices: false,
    can_manage_team: false,
    can_manage_clients: true,
    can_use_estimation: false,
    can_use_ai_visualization: false,
  },
  Autre: {
    can_view_dashboard: true,
    can_view_planning: false,
    can_manage_planning: false,
    can_manage_chantiers: false,
    can_view_all_chantiers: false,
    can_access_crm: false,
    can_create_quotes: false,
    can_manage_invoices: false,
    can_manage_team: false,
    can_manage_clients: false,
    can_use_estimation: false,
    can_use_ai_visualization: false,
  },
};

/** Génère un code aléatoire 8 caractères */
export function generateRandomCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/** Icône par rôle */
export const ROLE_ICONS: Record<string, string> = {
  'Chef de projet': '👨‍💼',
  Ouvrier: '🔧',
  Commercial: '📞',
  Assistant: '📋',
  Autre: '👤',
};

/** Retourne les initiales du nom (ex: "Marc Dupont" → "MD") */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Format plage de dates chantier pour popover (ex: "4-7 fév") */
export function formatChantierDateRange(dateDebut: string, duree: string): string {
  const start = parseLocalDate(dateDebut);
  const end = calculateEndDate(dateDebut, duree);
  const startStr = formatDateShort(start);
  const endStr = formatDateShort(end);
  return startStr === endStr ? startStr : `${formatDateShort(start)} - ${endStr}`;
}
