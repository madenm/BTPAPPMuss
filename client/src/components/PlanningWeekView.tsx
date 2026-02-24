import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Check, Pencil, StickyNote, AlertTriangle, Plus, FileText } from 'lucide-react';
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
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  parseLocalDate,
  calculateEndDate,
  toNoteDateKey,
  TYPE_CHANTIER_ICONS,
} from '@/lib/planningUtils';

export interface PlanningWeekViewProps {
  currentDate: Date;
  chantiers: Chantier[];
  assignmentsByChantierId: Record<string, TeamMember[]>;
  updatingChantierId: string | null;
  onEditChantier: (chantier: Chantier) => void;
  onStatusChange: (chantier: Chantier, newStatut: 'planifié' | 'en cours' | 'terminé') => void;
  notesByDate?: Record<string, string>;
  onSaveNote?: (noteDate: string, content: string) => void | Promise<void>;
}

const STATUT_COLORS = {
  'planifié': { border: 'border-l-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-300' },
  'en cours': { border: 'border-l-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-300' },
  'terminé': { border: 'border-l-green-400', bg: 'bg-green-500/10', text: 'text-green-300' },
} as const;

const MAX_VISIBLE_CARDS = 5;

function isChantierEnRetard(c: Chantier): boolean {
  if (c.statut === 'terminé') return false;
  const endDate = calculateEndDate(c.dateDebut, c.duree);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const result: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    result.push(dd);
  }
  return result;
}

function getChantiersForDay(chantiers: Chantier[], date: Date): Chantier[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  return chantiers.filter((c) => {
    const start = parseLocalDate(c.dateDebut);
    const end = calculateEndDate(c.dateDebut, c.duree);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return dayStart >= start && dayStart <= end;
  });
}

export function PlanningWeekView({
  currentDate,
  chantiers,
  assignmentsByChantierId,
  updatingChantierId,
  onEditChantier,
  onStatusChange,
  notesByDate = {},
  onSaveNote,
}: PlanningWeekViewProps) {
  const [noteDialogDate, setNoteDialogDate] = useState<string | null>(null);
  const [noteDialogLabel, setNoteDialogLabel] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const todayStr = new Date().toDateString();

  const openNoteDialog = useCallback((dateKey: string, dayLabel: string) => {
    setNoteDialogDate(dateKey);
    setNoteDialogLabel(dayLabel);
    setDraftNote(notesByDate[dateKey] ?? '');
  }, [notesByDate]);

  const closeNoteDialog = useCallback(() => {
    setNoteDialogDate(null);
    setDraftNote('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (onSaveNote && noteDialogDate) {
      await onSaveNote(noteDialogDate, draftNote.trim());
    }
    closeNoteDialog();
  }, [onSaveNote, noteDialogDate, draftNote, closeNoteDialog]);

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white shadow-none min-w-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {weekDays.map((day) => {
              const dateKey = toNoteDateKey(day);
              const isToday = day.toDateString() === todayStr;
              const dayChantiers = getChantiersForDay(chantiers, day);
              const hasNote = !!(notesByDate[dateKey]?.trim());
              const dayLabel = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

              const visibleChantiers = dayChantiers.slice(0, MAX_VISIBLE_CARDS);
              const hiddenCount = dayChantiers.length - MAX_VISIBLE_CARDS;

              return (
                <div key={dateKey} className={`flex flex-col min-h-[180px] ${isToday ? 'bg-violet-500/5' : ''}`}>
                  {/* Day header — clean */}
                  <div className={`px-3 py-2 border-b border-white/10 flex items-center justify-between ${isToday ? 'bg-violet-500/10' : 'bg-white/5'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isToday ? 'text-violet-300' : 'text-white'}`}>
                        {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </span>
                      <span className={`text-lg font-bold tabular-nums ${isToday ? 'text-violet-200' : 'text-white'}`}>
                        {day.getDate()}
                      </span>
                      {isToday && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                    </div>
                    <span className="text-[10px] text-white/40 tabular-nums">{dayChantiers.length || ''}</span>
                  </div>

                  {/* Note indicator — compact, with tooltip for preview */}
                  {hasNote && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => openNoteDialog(dateKey, dayLabel)}
                          className="px-2 py-1 bg-amber-500/10 border-b border-amber-400/20 text-left hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 w-full"
                        >
                          <StickyNote className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-amber-300 truncate font-medium">Note du jour</span>
                          <Pencil className="h-2.5 w-2.5 text-amber-400/60 shrink-0 ml-auto" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[280px] bg-black/95 border-amber-400/30 text-white p-3">
                        <p className="text-xs whitespace-pre-wrap">{notesByDate[dateKey]}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Chantier cards — compact: icon + name only */}
                  <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                    {dayChantiers.length === 0 ? (
                      <p className="text-[11px] text-white/25 text-center pt-6">—</p>
                    ) : (
                      <>
                        {visibleChantiers.map((c) => {
                          const style = STATUT_COLORS[c.statut] ?? STATUT_COLORS['planifié'];
                          const icon = (c.typeChantier && TYPE_CHANTIER_ICONS[c.typeChantier]) || '📋';
                          const isUpdating = updatingChantierId === c.id;
                          const isLate = isChantierEnRetard(c);
                          const members = assignmentsByChantierId[c.id] ?? [];

                          return (
                            <DropdownMenu key={c.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className={`w-full rounded px-2 py-1 cursor-pointer transition-all duration-150 border-l-2 ${
                                        isLate ? 'border-l-red-500 bg-red-500/10' : style.border + ' ' + style.bg
                                      } hover:bg-white/10 ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-sm leading-none shrink-0" aria-hidden>{icon}</span>
                                        <span className="text-[11px] font-medium text-white truncate">{c.nom}</span>
                                        {isLate && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 ml-auto" />}
                                      </div>
                                    </div>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="bg-black/95 border-white/10 text-white p-2 max-w-[220px]">
                                  <p className="text-xs font-medium">{c.nom}</p>
                                  <p className="text-[11px] text-white/60">{c.clientName}</p>
                                  {members.length > 0 && (
                                    <p className="text-[11px] text-white/50 mt-0.5">Équipe : {members.map((m) => m.name).join(', ')}</p>
                                  )}
                                  {isLate && <p className="text-[11px] text-red-400 mt-0.5">⚠ En retard</p>}
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="start" className="bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-lg w-48">
                                <DropdownMenuItem onSelect={() => onStatusChange(c, 'planifié')} className="focus:bg-white/10 focus:text-white text-white text-xs">
                                  {c.statut === 'planifié' && <Check className="mr-2 h-3 w-3" />}
                                  ⏳ Planifié
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onStatusChange(c, 'en cours')} className="focus:bg-white/10 focus:text-white text-white text-xs">
                                  {c.statut === 'en cours' && <Check className="mr-2 h-3 w-3" />}
                                  🔄 En cours
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onStatusChange(c, 'terminé')} className="focus:bg-white/10 focus:text-white text-white text-xs">
                                  {c.statut === 'terminé' && <Check className="mr-2 h-3 w-3" />}
                                  ✅ Terminé
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem onSelect={() => onEditChantier(c)} className="focus:bg-white/10 focus:text-white text-white text-xs">
                                  <Pencil className="mr-2 h-3 w-3" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => window.open(`/dashboard/quotes?filterProject=${c.id}`, '_self')} className="focus:bg-white/10 focus:text-white text-white text-xs">
                                  <FileText className="mr-2 h-3 w-3" />
                                  Voir les devis
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })}
                        {hiddenCount > 0 && (
                          <p className="text-[10px] text-white/50 text-center pt-0.5">+{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Add note zone — always visible at bottom */}
                  {onSaveNote && !hasNote && (
                    <button
                      type="button"
                      onClick={() => openNoteDialog(dateKey, dayLabel)}
                      className="px-2 py-1.5 border-t border-white/5 text-[11px] text-white/30 hover:text-amber-300 hover:bg-amber-500/5 transition-colors flex items-center gap-1 w-full"
                    >
                      <Plus className="h-3 w-3" />
                      Ajouter une note
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Note editing dialog — full-size, comfortable */}
      <Dialog open={!!noteDialogDate} onOpenChange={(open) => { if (!open) closeNoteDialog(); }}>
        <DialogContent className="bg-gray-900 border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <StickyNote className="h-5 w-5 text-amber-400" />
              Note — {noteDialogLabel}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Intervenants, rappels, détails de réunion, consignes..."
            className="min-h-[160px] text-sm resize-y bg-black/30 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400/50"
            rows={6}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={closeNoteDialog} className="text-white/60 hover:text-white hover:bg-white/10">
              Annuler
            </Button>
            <Button onClick={handleSaveNote} className="bg-amber-500/80 hover:bg-amber-500 text-white border-0">
              <Check className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
