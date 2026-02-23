// Parse "YYYY-MM-DD" (ou ISO avec time) en date locale pour éviter le décalage UTC
export function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Fonction pour parser la durée et calculer la date de fin
export function calculateEndDate(dateDebut: string, duree: string): Date {
  const startDate = parseLocalDate(dateDebut);
  const dureeLower = duree.toLowerCase().trim();

  let daysToAdd = 0;

  if (dureeLower.includes('semaine') || dureeLower.includes('sem')) {
    const weeks = parseInt(dureeLower.match(/\d+/)?.[0] || '1');
    daysToAdd = weeks * 7;
  } else if (dureeLower.includes('mois')) {
    const months = parseInt(dureeLower.match(/\d+/)?.[0] || '1');
    daysToAdd = months * 30; // Approximation
  } else if (dureeLower.includes('jour') || dureeLower.includes('j')) {
    const days = parseInt(dureeLower.match(/\d+/)?.[0] || '1');
    daysToAdd = days;
  } else {
    const days = parseInt(dureeLower.match(/\d+/)?.[0] || '1');
    daysToAdd = days;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysToAdd);
  return endDate;
}

/** Calcule une durée lisible (ex: "2 semaines") à partir de la date de début et de fin. */
export function formatDurationFromDates(dateDebut: string, dateFin: string): string {
  const start = parseLocalDate(dateDebut.slice(0, 10));
  const end = parseLocalDate(dateFin.slice(0, 10));
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return '1 jour';
  if (days === 1) return '1 jour';
  if (days < 7) return `${days} jours`;
  if (days === 7) return '1 semaine';
  if (days % 7 === 0 && days <= 84) return `${days / 7} semaines`;
  if (days < 30) return `${days} jours`;
  if (days <= 31) return '1 mois';
  if (days <= 62) return '2 mois';
  if (days % 30 < 15) return `${Math.round(days / 30)} mois`;
  return `${days} jours`;
}

export interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  /** Cellule vide de fin de grille (pas de jour du mois suivant) */
  isPlaceholder?: boolean;
}

// Fonction pour obtenir les jours du mois (uniquement le mois en cours, jusqu'à 31 jours)
export function getDaysInMonth(year: number, month: number): DayInfo[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: DayInfo[] = [];

  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
      isToday: false,
    });
  }

  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
    });
  }

  // Compléter la dernière ligne (multiple de 7) par des cellules vides, sans jours du mois suivant
  const remainder = days.length % 7;
  const padCount = remainder === 0 ? 0 : 7 - remainder;
  for (let i = 0; i < padCount; i++) {
    days.push({
      date: new Date(year, month + 1, 0),
      isCurrentMonth: false,
      isToday: false,
      isPlaceholder: true,
    });
  }

  return days;
}

export const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const TYPE_CHANTIER_LABELS: Record<string, string> = {
  piscine: 'Piscine & Spa',
  paysage: 'Aménagement Paysager',
  menuiserie: 'Menuiserie Sur-Mesure',
  renovation: 'Rénovation',
  plomberie: 'Plomberie',
  maconnerie: 'Maçonnerie',
  terrasse: 'Terrasse & Patio',
  chauffage: 'Chauffage & Climatisation',
  isolation: 'Isolation de la charpente',
  electricite: 'Électricité',
  peinture: 'Peinture & Revêtements',
  autre: 'Autre',
};

/** Format date en YYYY-MM-DD pour les notes du planning */
export function toNoteDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format court pour affichage : "4 fév" ou "4-7 fév" (debut-fin) */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Retourne le nombre de jours entre dateDebut et la fin calculée */
export function getChantierDurationDays(dateDebut: string, duree: string): number {
  const start = parseLocalDate(dateDebut);
  const end = calculateEndDate(dateDebut, duree);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export const TYPE_CHANTIER_ICONS: Record<string, string> = {
  renovation: '🏠',
  piscine: '🏊',
  menuiserie: '🪟',
  paysage: '🌳',
  plomberie: '🚿',
  maconnerie: '🧱',
  electricite: '⚡',
  peinture: '🎨',
  chauffage: '☀️',
  isolation: '🧊',
  terrasse: '🪵',
  autre: '📋',
};
