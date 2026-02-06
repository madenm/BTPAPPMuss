import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Pencil } from 'lucide-react';
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
} from '@/lib/planningUtils';

export interface PlanningCalendarViewProps {
  days: DayInfo[];
  getChantiersForDay: (date: Date) => Chantier[];
  assignmentsByChantierId: Record<string, TeamMember[]>;
  updatingChantierId: string | null;
  onEditChantier: (chantier: Chantier) => void;
  onStatusChange: (chantier: Chantier, newStatut: 'planifié' | 'en cours' | 'terminé') => void;
}

// Pastel Notion badge styles
const STATUT_STYLES = {
  planifié: { bg: 'bg-[#F0F5FF]', text: 'text-[#3B82F6]', emoji: '⏳', label: 'Planifié' },
  'en cours': { bg: 'bg-[#FFFAF0]', text: 'text-[#FBBF24]', emoji: '🔄', label: 'En cours' },
  terminé: { bg: 'bg-[#F0FDF4]', text: 'text-[#10B981]', emoji: '✅', label: 'Terminé' },
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
            'rounded p-2 cursor-pointer transition-all duration-200 ' +
            style.bg +
            ' hover:bg-opacity-90 hover:shadow-[0_1px_3px_rgba(0,0,0,0.05)] ' +
            (isUpdating ? 'opacity-60 pointer-events-none' : '')
          }
        >
          <div className="flex items-start gap-2">
            <span className="text-xl leading-none" aria-hidden>
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-gray-900 truncate">{chantier.nom}</div>
              <div className="font-normal text-xs text-gray-500 truncate">{chantier.clientName}</div>
              <span
                className={
                  'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium ' + style.bg + ' ' + style.text
                }
              >
                {style.emoji} {style.label}
              </span>
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-white border border-gray-200 text-gray-900 shadow-lg">
        <DropdownMenuItem onSelect={() => handleStatusChange('planifié')} className="focus:bg-gray-100 focus:text-gray-900">
          {chantier.statut === 'planifié' ? <Check className="mr-2 h-4 w-4" /> : null}
          Planifié
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleStatusChange('en cours')} className="focus:bg-gray-100 focus:text-gray-900">
          {chantier.statut === 'en cours' ? <Check className="mr-2 h-4 w-4" /> : null}
          En cours
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleStatusChange('terminé')} className="focus:bg-gray-100 focus:text-gray-900">
          {chantier.statut === 'terminé' ? <Check className="mr-2 h-4 w-4" /> : null}
          Terminé
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-200" />
        <DropdownMenuItem onSelect={() => { onEditChantier(chantier); onCloseDayPopover?.(); }} className="focus:bg-gray-100 focus:text-gray-900">
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
        'rounded-lg p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors duration-200 ' +
        (isUpdating ? 'opacity-60 pointer-events-none' : '')
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-gray-900">{chantier.nom}</div>
          <div className="font-normal text-xs text-gray-500 mt-0.5">{chantier.clientName}</div>
          <span className={'inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium ' + style.bg + ' ' + style.text}>
            {style.emoji} {style.label}
          </span>
          <div className="flex gap-2 mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-xs bg-white hover:bg-gray-100 border border-gray-200 px-2 py-1.5 rounded text-gray-700 font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Changer statut
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-white border border-gray-200">
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'planifié'); onClosePopover(); }}>
                  {chantier.statut === 'planifié' ? <Check className="mr-2 h-4 w-4" /> : null}
                  Planifié
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'en cours'); onClosePopover(); }}>
                  {chantier.statut === 'en cours' ? <Check className="mr-2 h-4 w-4" /> : null}
                  En cours
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { onStatusChange(chantier, 'terminé'); onClosePopover(); }}>
                  {chantier.statut === 'terminé' ? <Check className="mr-2 h-4 w-4" /> : null}
                  Terminé
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="text-xs bg-white hover:bg-gray-100 border border-gray-200 px-2 py-1.5 rounded text-gray-700 font-medium transition-colors"
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
}: PlanningCalendarViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const closeDayPopover = () => setSelectedDayIndex(null);

  return (
    <Card className="bg-white border border-[#E5E7EB] text-gray-900 shadow-none">
      <CardContent className="p-5">
        {/* Legend - Notion style */}
        <div className="text-xs text-gray-600 pb-4 tracking-wide">
          <span>⏳ Planifié</span>
          <span className="mx-3 text-gray-400">|</span>
          <span>🔄 En cours</span>
          <span className="mx-3 text-gray-400">|</span>
          <span>✅ Terminé</span>
        </div>

        {/* Week header */}
        <div className="grid grid-cols-7 gap-3 md:gap-4 border-b border-[#E5E7EB] bg-[#FAFBFC] -mx-5 px-5 py-4">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-gray-700 tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-3 md:gap-4 mt-4">
          {days.map((day, index) => {
            const dayChantiers = getChantiersForDay(day.date);
            const isToday = day.isToday;
            const visibleChantiers = dayChantiers.slice(0, 2);
            const moreCount = dayChantiers.length - 2;

            const cellClass =
              'relative min-h-[120px] md:min-h-[140px] p-3 md:p-4 rounded-lg transition-all duration-200 cursor-pointer ' +
              'hover:bg-[#F9FAFB] hover:shadow-[0_1px_3px_rgba(0,0,0,0.05)] ' +
              (day.isCurrentMonth
                ? isToday
                  ? 'bg-white border-l-[3px] border-l-red-500'
                  : 'bg-white'
                : 'bg-[#F9FAFB]');

            const dayNumClass =
              'font-semibold text-base mb-2 ' +
              (day.isCurrentMonth ? 'text-gray-900' : 'text-gray-300');

            return (
              <Popover
                key={index}
                open={selectedDayIndex === index}
                onOpenChange={(open) => setSelectedDayIndex(open ? index : null)}
              >
                <PopoverTrigger asChild>
                  <div role="button" tabIndex={0} aria-label={`${day.date.toLocaleDateString('fr-FR')} - ${dayChantiers.length} chantier(s)`} className={cellClass}>
                    {/* Day number with optional today dot */}
                    <div className={dayNumClass}>
                      {day.date.getDate()}
                      {isToday && day.isCurrentMonth && (
                        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" aria-hidden />
                      )}
                    </div>

                    {/* Compact chantier blocks - chantier clicks stopPropagation to avoid opening day popover */}
                    <div className="space-y-2">
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
                        <div className="text-xs font-medium text-gray-500 pt-1">
                          +{moreCount} autre{moreCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 max-h-[28rem] overflow-y-auto p-5 bg-white border border-[#E5E7EB] rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.07)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-sm font-semibold text-gray-900 mb-4">
                    {day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {dayChantiers.length === 0 ? (
                    <p className="text-xs text-gray-500">Aucun chantier ce jour</p>
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
      </CardContent>
    </Card>
  );
}
