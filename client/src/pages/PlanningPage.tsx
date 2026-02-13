import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardHeader } from '@/components/ui/card';
import { UserAccountButton } from '@/components/UserAccountButton';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import { useChantiers } from '@/context/ChantiersContext';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { fetchChantierAssignmentsByChantier, type TeamMember } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { Chantier } from '@/context/ChantiersContext';
import { ChantierEditDialog } from '@/components/ChantierEditDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlanningListView } from '@/components/PlanningListView';
import { PlanningCalendarView } from '@/components/PlanningCalendarView';
import {
  parseLocalDate,
  calculateEndDate,
  getDaysInMonth,
  monthNames,
  toNoteDateKey,
} from '@/lib/planningUtils';
import { fetchPlanningNotesForRange, upsertPlanningNote, deletePlanningNote } from '@/lib/supabasePlanningNotes';

export default function PlanningPage() {
  const { chantiers, updateChantier } = useChantiers();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [editingChantier, setEditingChantier] = useState<Chantier | null>(null);
  const [updatingChantierId, setUpdatingChantierId] = useState<string | null>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [assignmentsByChantierId, setAssignmentsByChantierId] = useState<Record<string, TeamMember[]>>({});
  const [assignmentsRefreshKey, setAssignmentsRefreshKey] = useState(0);
  const [notesByDate, setNotesByDate] = useState<Record<string, string>>({});
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const getChantiersForDay = useCallback(
    (date: Date) => {
      return chantiers.filter((chantier) => {
        const startDate = parseLocalDate(chantier.dateDebut);
        const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const chantierStart = new Date(startDate);
        chantierStart.setHours(0, 0, 0, 0);
        const chantierEnd = new Date(endDate);
        chantierEnd.setHours(23, 59, 59, 999);
        return dayStart >= chantierStart && dayStart <= chantierEnd;
      });
    },
    [chantiers]
  );

  const chantiersInMonth = useMemo(() => {
    return chantiers.filter((chantier) => {
      const startDate = parseLocalDate(chantier.dateDebut);
      const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
      return (
        (startDate.getMonth() === month && startDate.getFullYear() === year) ||
        (endDate.getMonth() === month && endDate.getFullYear() === year) ||
        (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1))
      );
    });
  }, [chantiers, year, month]);

  // Chantiers à charger en affectations : grille + liste du mois (union pour les deux vues)
  const chantiersInView = useMemo(() => {
    const ids = new Set<string>();
    chantiersInMonth.forEach((c) => ids.add(c.id));
    days.forEach((d) => getChantiersForDay(d.date).forEach((c) => ids.add(c.id)));
    return chantiers.filter((c) => ids.has(c.id));
  }, [chantiers, chantiersInMonth, days, getChantiersForDay]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results = await Promise.all(chantiersInView.map((c) => fetchChantierAssignmentsByChantier(c.id)));
      if (cancelled) return;
      const map: Record<string, TeamMember[]> = {};
      chantiersInView.forEach((c, i) => {
        map[c.id] = results[i] ?? [];
      });
      setAssignmentsByChantierId((prev) => ({ ...prev, ...map }));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [chantiersInView, assignmentsRefreshKey]);

  // Charger les notes du planning pour le mois affiché
  useEffect(() => {
    const start = toNoteDateKey(new Date(year, month, 1));
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = toNoteDateKey(new Date(year, month, lastDay));
    let cancelled = false;
    fetchPlanningNotesForRange(start, end).then((notes) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      notes.forEach((n) => {
        map[n.note_date] = n.content;
      });
      setNotesByDate(map);
    });
    return () => { cancelled = true; };
  }, [year, month, notesRefreshKey]);

  const handleSavePlanningNote = useCallback(async (noteDate: string, content: string) => {
    try {
      if (content.trim()) {
        await upsertPlanningNote(noteDate, content);
        toast({ title: 'Note enregistrée' });
      } else {
        await deletePlanningNote(noteDate);
        toast({ title: 'Note supprimée' });
      }
      setNotesByDate((prev) => {
        const next = { ...prev };
        if (content.trim()) next[noteDate] = content.trim();
        else delete next[noteDate];
        return next;
      });
      setNotesRefreshKey((k) => k + 1);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'enregistrer la note', variant: 'destructive' });
    }
  }, [toast]);

  const handleChangeStatut = useCallback(
    async (chantier: Chantier, newStatut: 'planifié' | 'en cours' | 'terminé') => {
      if (updatingChantierId) return;
      if (newStatut === chantier.statut) return;
      setUpdatingChantierId(chantier.id);
      try {
        await updateChantier(chantier.id, { statut: newStatut });
        toast({ title: 'Statut mis à jour' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
        toast({ title: 'Erreur', description: message, variant: 'destructive' });
      } finally {
        setUpdatingChantierId(null);
      }
    },
    [updateChantier, updatingChantierId]
  );

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <PageWrapper>
      <header className="bg-white border-b border-gray-200 px-2 py-3 sm:px-6 sm:py-4 rounded-tl-3xl ml-0 md:ml-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 max-md:pl-14">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 sm:truncate">Planning des Chantiers</h1>
            <p className="text-xs sm:text-sm text-gray-600 sm:truncate">Calendrier intégré pour organiser vos interventions</p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-2 py-4 sm:p-6 space-y-4 sm:space-y-6 ml-0 md:ml-20 overflow-x-hidden">
        {/* Contrôles du calendrier */}
        <Card className="bg-white border border-gray-200 text-gray-900 min-w-0 overflow-hidden">
          <CardHeader className="px-2 sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 min-w-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Popover
                  open={periodPickerOpen}
                  onOpenChange={(open) => {
                    setPeriodPickerOpen(open);
                    if (open) setPickerYear(year);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xl font-semibold text-left hover:opacity-90 transition-opacity text-gray-900"
                      aria-label="Changer la période"
                    >
                      {monthNames[month]} {year}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 bg-white border border-gray-200 text-gray-900 shadow-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => Math.max(2020, y - 1))}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        aria-label="Année précédente"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium tabular-nums">{pickerYear}</span>
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => Math.min(2030, y + 1))}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        aria-label="Année suivante"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {monthNames.map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setCurrentDate(new Date(pickerYear, i, 1));
                            setPeriodPickerOpen(false);
                          }}
                          className={`px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 transition-colors ${i === month && pickerYear === year ? 'bg-gray-100' : ''}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                      viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    Liste
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                      viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Calendrier
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 transition-colors text-sm"
                >
                  Aujourd'hui
                </button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {viewMode === 'list' && (
          <PlanningListView
            chantiers={chantiers}
            currentDate={currentDate}
            onEditChantier={setEditingChantier}
            onStatusChange={handleChangeStatut}
            assignmentsByChantierId={assignmentsByChantierId}
            updatingChantierId={updatingChantierId}
            canCreateChantier
          />
        )}

        {viewMode === 'calendar' && (
          <PlanningCalendarView
            days={days}
            getChantiersForDay={getChantiersForDay}
            assignmentsByChantierId={assignmentsByChantierId}
            updatingChantierId={updatingChantierId}
            onEditChantier={setEditingChantier}
            onStatusChange={handleChangeStatut}
            notesByDate={notesByDate}
            onSaveNote={handleSavePlanningNote}
          />
        )}

        <ChantierEditDialog
          chantier={editingChantier}
          open={!!editingChantier}
          onOpenChange={(open) => {
            if (!open) {
              setEditingChantier(null);
              setAssignmentsRefreshKey((k) => k + 1);
            }
          }}
        />
      </main>
    </PageWrapper>
  );
}
