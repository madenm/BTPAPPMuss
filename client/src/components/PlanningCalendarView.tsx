import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Pencil, StickyNote, X } from 'lucide-react';
import type { Chantier } from '@/context/ChantiersContext';
import type { TeamMember } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  dayNames,
  type DayInfo,
  TYPE_CHANTIER_ICONS,
  toNoteDateKey,
} from '@/lib/planningUtils';

export interface PlanningCalendarViewProps {
  days: DayInfo[];
  getChantiersForDay: (date: Date) => Chantier[];
  assignmentsByChantierId: Record<string, TeamMember[]>;
  updatingChantierId: string | null;
  onEditChantier: (chantier: Chantier) => void;
  onStatusChange: (chantier: Chantier, newStatut: 'planifié' | 'en cours' | 'terminé') => void;
  notesByDate?: Record<string, string>;
  onSaveNote?: (noteDate: string, content: string) => void | Promise<void>;
}

// Badge styles cohérents avec le thème sombre du site
const STATUT_STYLES = {
  planifié: { bg: 'bg-blue-500/20', text: 'text-blue-300', emoji: '⏳', label: 'Planifié' },
  'en cours': { bg: 'bg-amber-500/20', text: 'text-amber-300', emoji: '🔄', label: 'En cours' },
  terminé: { bg: 'bg-green-500/20', text: 'text-green-300', emoji: '✅', label: 'Terminé' },
} as const;

function getStatutStyle(statut: Chantier['statut']) {
  return STATUT_STYLES[statut] ?? STATUT_STYLES.planifié;
}

/** Compact chantier block for calendar cell (icon, name, client, badge only) */
function ChantierBlockCompact({
  chantier,
  isUpdating,
  onEditChantier,
  onStatusChange,
  onCloseDayPopover,
}: {
  chantier: Chantier;
  isUpdating: boolean;
  onEditChantier: (c: Chantier) => void;
  onStatusChange: (c: Chantier, s: 'planifié' | 'en cours' | 'terminé') => void;
  onCloseDayPopover?: () => void;
}) {
  const icon = (chantier.typeChantier && TYPE_CHANTIER_ICONS[chantier.typeChantier]) || '📋';
  const style = getStatutStyle(chantier.statut);

  const handleStatusChange = (s: 'planifié' | 'en cours' | 'terminé') => {
    onStatusChange(chantier, s);
    onCloseDayPopover?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
          }}
          className={
            'w-full rounded-lg p-2 cursor-pointer transition-all duration-200 border border-white/10 ' +
            style.bg +
            ' hover:bg-white/10 ' +
            (isUpdating ? 'opacity-60 pointer-events-none' : '')
          }
        >
          <div className="flex items-start gap-2">
            <span className="text-xl leading-none shrink-0" aria-hidden>
              {icon}
            </span>
            <div className="min-w-0 flex-1 w-full">
              <div className="font-medium text-sm text-white truncate">{chantier.nom}</div>
              <div className="font-normal text-xs text-white/60 truncate">{chantier.clientName}</div>
              <div className="mt-1 w-full min-w-0">
                <span
                  className={
                    'inline-flex items-center gap-1 w-full px-2 py-0.5 rounded text-xs font-medium ' + style.bg + ' ' + style.text
                  }
                >
                  {style.emoji} {style.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-lg">
        <DropdownMenuItem onSelect={() => handleStatusChange('planifié')} className="focus:bg-white/10 focus:text-white text-white">
          {chantier.statut === 'planifié' ? <Check className="mr-2 h-4 w-4" /> : null}
          Planifié
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleStatusChange('en cours')} className="focus:bg-white/10 focus:text-white text-white">
          {chantier.statut === 'en cours' ? <Check className="mr-2 h-4 w-4" /> : null}
          En cours
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleStatusChange('terminé')} className="focus:bg-white/10 focus:text-white text-white">
          {chantier.statut === 'terminé' ? <Check className="mr-2 h-4 w-4" /> : null}
          Terminé
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onSelect={() => { onEditChantier(chantier); onCloseDayPopover?.(); }} className="focus:bg-white/10 focus:text-white text-white">
          <Pencil className="mr-2 h-4 w-4" />
          Modifier le chantier
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Chantier block for day popover modal (with explicit buttons) */
function ChantierBlockModal({
  chantier,
  isUpdating,
  onEditChantier,
  onStatusChange,
  onClosePopover,
}: {
  chantier: Chantier;
  isUpdating: boolean;
  onEditChantier: (c: Chantier) => void;
  onStatusChange: (c: Chantier, s: 'planifié' | 'en cours' | 'terminé') => void;
  onClosePopover: () => void;
}) {
  const icon = (chantier.typeChantier && TYPE_CHANTIER_ICONS[chantier.typeChantier]) || '📋';
  const style = getStatutStyle(chantier.statut);

  return (
    <div
      className={
        'rounded-lg p-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-200 ' +
        (isUpdating ? 'opacity-60 pointer-events-none' : '')
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-white">{chantier.nom}</div>
          <div className="font-normal text-xs text-white/60 mt-0.5">{chantier.clientName}</div>
          <span className={'inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium ' + style.bg + ' ' + style.text}>
            {style.emoji} {style.label}
          </span>
          <div className="flex gap-2 mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-1.5 rounded text-white font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Changer statut
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-black/90 backdrop-blur-xl border border-white/10 text-white">
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'planifié'); onClosePopover(); }} className="text-white focus:bg-white/10">
                  {chantier.statut === 'planifié' ? <Check className="mr-2 h-4 w-4" /> : null}
                  Planifié
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'en cours'); onClosePopover(); }} className="text-white focus:bg-white/10">
                  {chantier.statut === 'en cours' ? <Check className="mr-2 h-4 w-4" /> : null}
                  En cours
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'terminé'); onClosePopover(); }} className="text-white focus:bg-white/10">
                  {chantier.statut === 'terminé' ? <Check className="mr-2 h-4 w-4" /> : null}
                  Terminé
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-1.5 rounded text-white font-medium transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEditChantier(chantier);
                onClosePopover();
              }}
            >
              Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanningCalendarView({
  days,
  getChantiersForDay,
  assignmentsByChantierId: _assignmentsByChantierId,
  updatingChantierId,
  onEditChantier,
  onStatusChange,
  notesByDate = {},
  onSaveNote,
}: PlanningCalendarViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const closeDayPopover = useCallback(() => {
    setSelectedDayIndex(null);
    setDraftNote('');
  }, []);

  const handleOpenDayPopover = useCallback((index: number, date: Date) => {
    const key = toNoteDateKey(date);
    setDraftNote(notesByDate[key] ?? '');
  }, [notesByDate]);

  const handleSaveDayNote = useCallback(async (noteDate: string) => {
    if (onSaveNote) {
      await onSaveNote(noteDate, draftNote.trim());
      closeDayPopover();
    }
  }, [onSaveNote, draftNote, closeDayPopover]);

  return (
    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white shadow-none min-w-0 overflow-hidden">
      <CardContent className="px-2 py-4 sm:p-5">
        {/* Légende */}
        <div className="text-xs text-white/70 pb-2 tracking-wide">
          <span>⏳ Planifié</span>
          <span className="mx-3 text-white/40">|</span>
          <span>🔄 En cours</span>
          <span className="mx-3 text-white/40">|</span>
          <span>✅ Terminé</span>
        </div>
        {onSaveNote && (
          <p className="text-xs text-white/60 pb-4">
            📌 <strong>Notes :</strong> cliquez sur un jour pour ajouter une note (ex. intervenant, démarrage chantier, réunion…).
          </p>
        )}

        {/* Mobile: grille 7 colonnes qui tient en largeur, cellules simplifiées. Desktop: grille avec scroll si besoin, contenu détaillé. */}
        <div className="md:overflow-x-auto md:-mx-5 md:px-0">
          <div className="md:min-w-[630px] md:pr-5">
            {/* En-tête des jours */}
            <div className="grid grid-cols-7 gap-0 border-b border-white/10 bg-white/5 px-1 md:px-5 py-2 md:py-4">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-[10px] md:text-sm font-semibold text-white/80 tracking-wide border-r border-white/10 last:border-r-0 min-w-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Grille du calendrier */}
            <div className="grid grid-cols-7 gap-0 mt-1 md:mt-4 border-t border-white/10">
          {days.map((day, index) => {
            if (day.isPlaceholder) {
              const isLastInRow = index % 7 === 6;
              return (
                <div
                  key={index}
                  className={
                    'relative min-h-[52px] md:min-h-[140px] bg-white/5 border-r border-white/10 ' +
                    (isLastInRow ? 'border-r-0' : '')
                  }
                  aria-hidden
                />
              );
            }

            const dayChantiers = getChantiersForDay(day.date);
            const isToday = day.isToday;
            const visibleChantiers = dayChantiers.slice(0, 2);
            const moreCount = dayChantiers.length - 2;
            const noteDateKey = toNoteDateKey(day.date);
            const hasNote = !!(notesByDate[noteDateKey]?.trim());

            const isLastInRow = index % 7 === 6;
            const cellClass =
              'relative min-h-[52px] md:min-h-[140px] py-1 md:py-2 px-0.5 md:px-1 transition-all duration-200 cursor-pointer border-r border-white/10 ' +
              (isLastInRow ? 'border-r-0 ' : '') +
              'hover:bg-white/10 ' +
              (day.isCurrentMonth
                ? isToday
                  ? 'bg-white/10 border-l-2 md:border-l-[3px] border-l-violet-400'
                  : 'bg-white/5'
                : 'bg-white/[0.03]');

            const dayNumClass =
              'font-semibold text-xs md:text-base md:mb-2 ' +
              (day.isCurrentMonth ? 'text-white' : 'text-white/40');

            return (
              <Popover
                key={index}
                open={selectedDayIndex === index}
                onOpenChange={(open) => {
                  if (open) {
                    setSelectedDayIndex(index);
                    handleOpenDayPopover(index, day.date);
                  } else closeDayPopover();
                }}
              >
                <PopoverTrigger asChild>
                  <div role="button" tabIndex={0} aria-label={`${day.date.toLocaleDateString('fr-FR')} - ${dayChantiers.length} projet(s)`} className={cellClass}>
                    {/* Jour + indicateur note (mobile et desktop) */}
                    <div className="flex items-center justify-between gap-0.5 md:gap-1 mb-0 md:mb-1">
                      <div className={dayNumClass}>
                        {day.date.getDate()}
                        {isToday && day.isCurrentMonth && (
                          <span className="ml-0.5 md:ml-1 inline-block w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-red-500 align-middle" aria-hidden />
                        )}
                      </div>
                      {onSaveNote && (
                        <StickyNote
                          className={`h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 ${hasNote ? 'text-amber-400' : 'text-white/40 hover:text-amber-400'}`}
                          aria-label={hasNote ? 'Note du jour' : 'Cliquer pour ajouter une note'}
                          title={hasNote ? 'Note du jour' : 'Cliquer pour ajouter une note'}
                        />
                      )}
                    </div>

                    {/* Mobile uniquement : résumé compact (nombre de chantiers), clic ouvre le popover */}
                    <div className="md:hidden min-w-0">
                      {dayChantiers.length > 0 ? (
                        <div className="text-[10px] font-medium text-white/60 truncate" title={`${dayChantiers.length} projet(s)`}>
                          {dayChantiers.length} chant.
                        </div>
                      ) : null}
                    </div>

                    {/* Desktop uniquement : blocs chantiers détaillés */}
                    <div className="hidden md:block space-y-0 flex flex-col gap-0 w-full">
                      {visibleChantiers.map((chantier) => (
                        <ChantierBlockCompact
                          key={chantier.id}
                          chantier={chantier}
                          isUpdating={updatingChantierId === chantier.id}
                          onEditChantier={onEditChantier}
                          onStatusChange={onStatusChange}
                        />
                      ))}
                      {moreCount > 0 && (
                        <div className="text-xs font-medium text-white/60 pt-1 px-1">
                          +{moreCount} autre{moreCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 max-h-[32rem] overflow-y-auto p-5 bg-black/90 backdrop-blur-xl border border-white/10 text-white rounded-lg shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="text-sm font-semibold text-white">
                      {day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <button
                      type="button"
                      onClick={closeDayPopover}
                      className="p-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                      aria-label="Fermer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Notes du jour - bien visible en premier */}
                  {onSaveNote && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                      <label className="text-sm font-medium text-amber-300 flex items-center gap-1.5 mb-2">
                        <StickyNote className="h-4 w-4 text-amber-400" />
                        Note du jour
                      </label>
                      <p className="text-xs text-white/70 mb-2">
                        Indiquez par ex. qui intervient, quel chantier démarre, un rappel…
                      </p>
                      <Textarea
                        placeholder="Ex : Romain intervient ; Démarrage fondation Morgan ; Réunion client 10h"
                        value={selectedDayIndex === index ? draftNote : ''}
                        onChange={(e) => setDraftNote(e.target.value)}
                        onBlur={() => {
                          if (selectedDayIndex === index) handleSaveDayNote(noteDateKey);
                        }}
                        className="min-h-[80px] text-sm resize-y bg-black/20 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400/50"
                        rows={3}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/30"
                        onClick={() => handleSaveDayNote(noteDateKey)}
                      >
                        Enregistrer la note
                      </Button>
                    </div>
                  )}

                  {dayChantiers.length === 0 ? (
                    <p className="text-xs text-white/60">Aucun projet ce jour</p>
                  ) : (
                    <div className="space-y-3">
                      {dayChantiers.map((chantier) => (
                        <ChantierBlockModal
                          key={chantier.id}
                          chantier={chantier}
                          isUpdating={updatingChantierId === chantier.id}
                          onEditChantier={onEditChantier}
                          onStatusChange={onStatusChange}
                          onClosePopover={closeDayPopover}
                        />
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            );
          })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
