import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Check, User, DollarSign, Users, FileText, Pencil, ChevronDown } from 'lucide-react';
import type { Chantier } from '@/context/ChantiersContext';
import type { TeamMember } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  parseLocalDate,
  calculateEndDate,
  monthNames,
  TYPE_CHANTIER_ICONS,
} from '@/lib/planningUtils';

export interface PlanningListViewProps {
  chantiers: Chantier[];
  currentDate: Date;
  onEditChantier: (chantier: Chantier) => void;
  onStatusChange: (chantier: Chantier, newStatut: 'planifié' | 'en cours' | 'terminé') => void;
  assignmentsByChantierId: Record<string, TeamMember[]>;
  updatingChantierId: string | null;
  canCreateChantier?: boolean;
}

function filterChantiersInMonth(chantiers: Chantier[], year: number, month: number): Chantier[] {
  return chantiers.filter((chantier) => {
    const startDate = parseLocalDate(chantier.dateDebut);
    const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
    return (
      (startDate.getMonth() === month && startDate.getFullYear() === year) ||
      (endDate.getMonth() === month && endDate.getFullYear() === year) ||
      (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1))
    );
  });
}

function getDaysDiff(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function formatDateRange(dateDebut: string, duree: string): { label: string; days: number } {
  const start = parseLocalDate(dateDebut);
  const end = calculateEndDate(dateDebut, duree);
  const days = getDaysDiff(start, end);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  const startStr = start.toLocaleDateString('fr-FR', opts);
  const endStr = end.toLocaleDateString('fr-FR', opts);
  const label = `${startStr} - ${endStr} (${days} jour${days > 1 ? 's' : ''})`;
  return { label, days };
}

function getStatusBadgeClasses(statut: Chantier['statut']): string {
  switch (statut) {
    case 'planifié':
      return 'bg-blue-500/20 text-blue-300 border border-blue-400/30';
    case 'en cours':
      return 'bg-amber-500/20 text-amber-300 border border-amber-400/30';
    case 'terminé':
      return 'bg-green-500/20 text-green-300 border border-green-400/30';
    default:
      return 'bg-white/10 text-white/80 border border-white/20';
  }
}

function getStatusIcon(statut: Chantier['statut']): string {
  switch (statut) {
    case 'planifié':
      return '⏳';
    case 'en cours':
      return '🔄';
    case 'terminé':
      return '✅';
    default:
      return '';
  }
}

export function PlanningListView({
  chantiers,
  currentDate,
  onEditChantier,
  onStatusChange,
  assignmentsByChantierId,
  updatingChantierId,
  canCreateChantier = true,
}: PlanningListViewProps) {
  const [, setLocation] = useLocation();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = monthNames[month];

  const chantiersInMonth = filterChantiersInMonth(chantiers, year, month);
  const sortedChantiers = [...chantiersInMonth].sort(
    (a, b) => parseLocalDate(a.dateDebut).getTime() - parseLocalDate(b.dateDebut).getTime()
  );

  return (
    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white min-w-0 overflow-hidden">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg break-words">
          CHANTIERS DE {monthLabel.toUpperCase()} {year} ({sortedChantiers.length} chantier{sortedChantiers.length !== 1 ? 's' : ''})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 min-w-0">
        {sortedChantiers.length === 0 ? (
          <div className="text-center py-12 text-white/70">
            <p className="mb-4">Aucun chantier en {monthLabel} {year}.</p>
            {canCreateChantier && (
              <Button
                variant="outline"
                onClick={() => setLocation('/dashboard/projects?openDialog=true')}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Créer un chantier
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedChantiers.map((chantier) => {
              const { label: dateRangeLabel } = formatDateRange(chantier.dateDebut, chantier.duree);
              const members = assignmentsByChantierId[chantier.id] ?? [];
              const isUpdating = updatingChantierId === chantier.id;
              const icon = (chantier.typeChantier && TYPE_CHANTIER_ICONS[chantier.typeChantier]) || '📋';
              const notesPreview = chantier.notes?.slice(0, 80);
              const notesTruncated = chantier.notes && chantier.notes.length > 80;

              return (
                <div
                  key={chantier.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 sm:p-6 hover:bg-white/10 transition-colors min-w-0 overflow-hidden"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-semibold text-white break-words">
                          <span className="mr-2" aria-hidden>{icon}</span>
                          {chantier.nom}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border shrink-0 ${getStatusBadgeClasses(chantier.statut)}`}
                        >
                          <span aria-hidden>{getStatusIcon(chantier.statut)}</span>
                          {chantier.statut}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 text-sm text-white/70 min-w-0">
                        <div className="flex items-start gap-2 min-w-0">
                          <Calendar className="h-4 w-4 shrink-0 text-white/50 mt-0.5" />
                          <span className="break-words">{dateRangeLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-4 w-4 shrink-0 text-white/50" />
                          <span className="truncate">Client : {chantier.clientName}</span>
                        </div>
                        {typeof chantier.montantDevis === 'number' && chantier.montantDevis > 0 && (
                          <div className="flex items-center gap-2 min-w-0">
                            <DollarSign className="h-4 w-4 shrink-0 text-white/50" />
                            <span className="break-all">
                              Montant :{' '}
                              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(chantier.montantDevis)} TTC
                            </span>
                          </div>
                        )}
                        {members.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Users className="h-4 w-4 shrink-0 text-white/50" />
                            <div className="flex flex-wrap gap-2 min-w-0">
                              {members.map((m) => (
                                <span
                                  key={m.id}
                                  className="bg-white/10 text-white/90 px-2 py-1 rounded text-sm break-words border border-white/10"
                                >
                                  {m.name} - {m.role || 'Membre'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {chantier.notes && (
                          <div className="flex items-start gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-white/50 mt-0.5" />
                            <p className="text-white/70 line-clamp-2 min-w-0 break-words">
                              {notesPreview}
                              {notesTruncated ? '…' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row shrink-0 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditChantier(chantier)}
                        className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto justify-center"
                      >
                        <Pencil className="h-4 w-4 mr-2 shrink-0" />
                        <span className="truncate">Modifier le chantier</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!isUpdating}
                            className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto justify-center"
                          >
                            <ChevronDown className="h-4 w-4 mr-2 shrink-0" />
                            <span className="truncate">Changer statut</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-lg">
                          <DropdownMenuItem onSelect={() => onStatusChange(chantier, 'planifié')} className="focus:bg-white/10 focus:text-white text-white">
                            {chantier.statut === 'planifié' && <Check className="mr-2 h-4 w-4" />}
                            Planifié
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onStatusChange(chantier, 'en cours')} className="focus:bg-white/10 focus:text-white text-white">
                            {chantier.statut === 'en cours' && <Check className="mr-2 h-4 w-4" />}
                            En cours
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onStatusChange(chantier, 'terminé')} className="focus:bg-white/10 focus:text-white text-white">
                            {chantier.statut === 'terminé' && <Check className="mr-2 h-4 w-4" />}
                            Terminé
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
