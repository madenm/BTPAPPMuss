import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAccountButton } from '@/components/UserAccountButton';
import {
  ChevronLeft, ChevronRight, List, CalendarDays, Calendar as CalendarIcon,
  Filter, Clock, Users, AlertTriangle, StickyNote, Building,
} from 'lucide-react';
import { useChantiers } from '@/context/ChantiersContext';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { fetchChantierAssignmentsByChantier, type TeamMember } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { Chantier } from '@/context/ChantiersContext';
import { ChantierEditDialog } from '@/components/ChantierEditDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlanningListView } from '@/components/PlanningListView';
import { PlanningCalendarView } from '@/components/PlanningCalendarView';
import { PlanningWeekView } from '@/components/PlanningWeekView';
import {
  parseLocalDate,
  calculateEndDate,
  getDaysInMonth,
  monthNames,
  toNoteDateKey,
  TYPE_CHANTIER_LABELS,
  TYPE_CHANTIER_ICONS,
} from '@/lib/planningUtils';
import { fetchPlanningNotesForRange, upsertPlanningNote, deletePlanningNote } from '@/lib/supabasePlanningNotes';

type ViewMode = 'list' | 'calendar' | 'week';
type StatutFilter = 'all' | 'planifié' | 'en cours' | 'terminé' | 'en retard';

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function isChantierEnRetard(c: Chantier): boolean {
  if (c.statut === 'terminé') return false;
  const endDate = calculateEndDate(c.dateDebut, c.duree);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
}

export default function PlanningPage() {
  const { chantiers, updateChantier } = useChantiers();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [editingChantier, setEditingChantier] = useState<Chantier | null>(null);
  const [updatingChantierId, setUpdatingChantierId] = useState<string | null>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [assignmentsByChantierId, setAssignmentsByChantierId] = useState<Record<string, TeamMember[]>>({});
  const [assignmentsRefreshKey, setAssignmentsRefreshKey] = useState(0);
  const [notesByDate, setNotesByDate] = useState<Record<string, string>>({});
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);

  const [statutFilter, setStatutFilter] = useState<StatutFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const allMembers = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(assignmentsByChantierId).forEach((members) =>
      members.forEach((m) => map.set(m.id, m.name))
    );
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [assignmentsByChantierId]);

  const activeTypes = useMemo(() => {
    const types = new Set<string>();
    chantiers.forEach((c) => {
      if (c.typeChantier) types.add(c.typeChantier);
    });
    return Array.from(types).sort();
  }, [chantiers]);

  const filteredChantiers = useMemo(() => {
    return chantiers.filter((c) => {
      if (statutFilter === 'en retard') {
        if (!isChantierEnRetard(c)) return false;
      } else if (statutFilter !== 'all' && c.statut !== statutFilter) {
        return false;
      }
      if (typeFilter !== 'all' && c.typeChantier !== typeFilter) return false;
      if (memberFilter !== 'all') {
        const members = assignmentsByChantierId[c.id] ?? [];
        if (!members.some((m) => m.id === memberFilter)) return false;
      }
      return true;
    });
  }, [chantiers, statutFilter, typeFilter, memberFilter, assignmentsByChantierId]);

  const hasActiveFilters = statutFilter !== 'all' || typeFilter !== 'all' || memberFilter !== 'all';

  const getChantiersForDay = useCallback(
    (date: Date) => {
      return filteredChantiers.filter((chantier) => {
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
    [filteredChantiers]
  );

  const chantiersInMonth = useMemo(() => {
    return filteredChantiers.filter((chantier) => {
      const startDate = parseLocalDate(chantier.dateDebut);
      const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
      return (
        (startDate.getMonth() === month && startDate.getFullYear() === year) ||
        (endDate.getMonth() === month && endDate.getFullYear() === year) ||
        (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1))
      );
    });
  }, [filteredChantiers, year, month]);

  const chantiersInView = useMemo(() => {
    const ids = new Set<string>();
    chantiersInMonth.forEach((c) => ids.add(c.id));
    days.forEach((d) => getChantiersForDay(d.date).forEach((c) => ids.add(c.id)));
    chantiers.forEach((c) => ids.add(c.id));
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
    return () => { cancelled = true; };
  }, [chantiersInView, assignmentsRefreshKey]);

  useEffect(() => {
    const start = toNoteDateKey(new Date(year, month, 1));
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = toNoteDateKey(new Date(year, month, lastDay));
    let cancelled = false;
    fetchPlanningNotesForRange(start, end).then((notes) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      notes.forEach((n) => { map[n.note_date] = n.content; });
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
  }, []);

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

  const goToPrevious = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };
  const goToNext = () => {
    if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };
  const goToToday = () => setCurrentDate(new Date());

  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const { start, end } = getWeekRange(currentDate);
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `${fmt(start)} — ${fmt(end)} ${end.getFullYear()}`;
    }
    return `${monthNames[month]} ${year}`;
  }, [viewMode, currentDate, month, year]);

  // --- Today summary ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toNoteDateKey(today);
  const todayNote = notesByDate[todayKey];

  const todayChantiers = useMemo(() => {
    return chantiers.filter((c) => {
      const start = parseLocalDate(c.dateDebut);
      const end = calculateEndDate(c.dateDebut, c.duree);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [chantiers]);

  const enRetardCount = useMemo(() => chantiers.filter(isChantierEnRetard).length, [chantiers]);

  const nextDeadline = useMemo(() => {
    const upcoming = chantiers
      .filter((c) => c.statut !== 'terminé')
      .map((c) => ({ chantier: c, end: calculateEndDate(c.dateDebut, c.duree) }))
      .filter((x) => x.end >= today)
      .sort((a, b) => a.end.getTime() - b.end.getTime());
    return upcoming[0] ?? null;
  }, [chantiers]);

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Planning des Projets</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Calendrier intégré pour organiser vos interventions</p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:p-6 space-y-4 sm:space-y-5 overflow-x-hidden">

        {/* --- Bandeau Aujourd'hui --- */}
        <Card className="bg-black/30 backdrop-blur-xl border border-white/10 text-white overflow-hidden">
          <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">
                Aujourd'hui — {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              {enRetardCount > 0 && (
                <Badge className="bg-red-500/20 text-red-300 border border-red-400/30 text-xs ml-auto">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {enRetardCount} en retard
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Chantiers du jour */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                  {todayChantiers.length} projet{todayChantiers.length !== 1 ? 's' : ''} actif{todayChantiers.length !== 1 ? 's' : ''}
                </span>
                {todayChantiers.length === 0 ? (
                  <p className="text-xs text-white/40">Aucun projet aujourd'hui</p>
                ) : (
                  todayChantiers.slice(0, 3).map((c) => {
                    const icon = (c.typeChantier && TYPE_CHANTIER_ICONS[c.typeChantier]) || '📋';
                    const isLate = isChantierEnRetard(c);
                    return (
                      <div key={c.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${isLate ? 'bg-red-500/10 border border-red-400/20' : 'bg-white/5'}`}>
                        <span aria-hidden>{icon}</span>
                        <span className="truncate font-medium text-white">{c.nom}</span>
                        <span className="text-white/50 truncate">— {c.clientName}</span>
                        {isLate && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 ml-auto" />}
                      </div>
                    );
                  })
                )}
                {todayChantiers.length > 3 && (
                  <p className="text-xs text-white/50">+{todayChantiers.length - 3} autre{todayChantiers.length - 3 > 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Note du jour */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wide flex items-center gap-1">
                  <StickyNote className="h-3 w-3" /> Note du jour
                </span>
                {todayNote ? (
                  <p className="text-xs text-amber-300/90 bg-amber-500/10 rounded px-2 py-1 border border-amber-400/20 line-clamp-3">{todayNote}</p>
                ) : (
                  <p className="text-xs text-white/40">Aucune note</p>
                )}
              </div>

              {/* Prochaine échéance */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Prochaine échéance</span>
                {nextDeadline ? (
                  <div className="text-xs bg-white/5 rounded px-2 py-1">
                    <span className="font-medium text-white">{nextDeadline.chantier.nom}</span>
                    <span className="text-white/50 ml-1">
                      — fin le {nextDeadline.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-white/40">Aucune échéance à venir</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- Contrôles --- */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 min-w-0">
              {/* Navigation période */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={goToPrevious} className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors" aria-label="Précédent">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {viewMode !== 'week' ? (
                  <Popover open={periodPickerOpen} onOpenChange={(open) => { setPeriodPickerOpen(open); if (open) setPickerYear(year); }}>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-lg sm:text-xl font-semibold text-left hover:opacity-90 transition-opacity text-white" aria-label="Changer la période">
                        {periodLabel}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <button type="button" onClick={() => setPickerYear((y) => Math.max(2020, y - 1))} className="p-1 rounded text-white hover:bg-white/10 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                        <span className="text-sm font-medium tabular-nums">{pickerYear}</span>
                        <button type="button" onClick={() => setPickerYear((y) => Math.min(2030, y + 1))} className="p-1 rounded text-white hover:bg-white/10 transition-colors"><ChevronRight className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {monthNames.map((name, i) => (
                          <button key={name} type="button" onClick={() => { setCurrentDate(new Date(pickerYear, i, 1)); setPeriodPickerOpen(false); }} className={`px-2 py-1.5 rounded text-sm text-left text-white hover:bg-white/10 transition-colors ${i === month && pickerYear === year ? 'bg-white/20' : ''}`}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-lg sm:text-xl font-semibold text-white">{periodLabel}</span>
                )}
                <button type="button" onClick={goToNext} className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors" aria-label="Suivant">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Vue + filtres + aujourd'hui */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {([
                    { mode: 'list' as ViewMode, icon: List, label: 'Liste' },
                    { mode: 'week' as ViewMode, icon: CalendarIcon, label: 'Semaine' },
                    { mode: 'calendar' as ViewMode, icon: CalendarDays, label: 'Mois' },
                  ]).map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        viewMode === mode ? 'bg-violet-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors border ${
                    hasActiveFilters ? 'bg-violet-500/20 text-violet-300 border-violet-400/30' : 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filtres</span>
                  {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-violet-400" />}
                </button>
                <button onClick={goToToday} className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors text-sm">
                  Aujourd'hui
                </button>
              </div>
            </div>

            {/* Barre de filtres */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-3">
                {/* Statut */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/60 font-medium">Statut :</span>
                  {([
                    { val: 'all' as StatutFilter, label: 'Tous', color: 'bg-white/10 text-white' },
                    { val: 'planifié' as StatutFilter, label: '⏳ Planifié', color: 'bg-blue-500/20 text-blue-300 border-blue-400/30' },
                    { val: 'en cours' as StatutFilter, label: '🔄 En cours', color: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
                    { val: 'terminé' as StatutFilter, label: '✅ Terminé', color: 'bg-green-500/20 text-green-300 border-green-400/30' },
                    { val: 'en retard' as StatutFilter, label: '⚠️ En retard', color: 'bg-red-500/20 text-red-300 border-red-400/30' },
                  ]).map(({ val, label, color }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStatutFilter(val)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                        statutFilter === val ? color + ' ring-1 ring-white/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Type */}
                {activeTypes.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/60 font-medium ml-2">
                      <Building className="h-3 w-3 inline mr-0.5" />
                      Type :
                    </span>
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                        typeFilter === 'all' ? 'bg-white/10 text-white ring-1 ring-white/30 border-white/20' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Tous
                    </button>
                    {activeTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                          typeFilter === t ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/40 border-violet-400/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {TYPE_CHANTIER_ICONS[t] ?? ''} {TYPE_CHANTIER_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Membre */}
                {allMembers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/60 font-medium ml-2">
                      <Users className="h-3 w-3 inline mr-0.5" />
                      Équipe :
                    </span>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                        memberFilter === 'all' ? 'bg-white/10 text-white ring-1 ring-white/30 border-white/20' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Tous
                    </button>
                    {allMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMemberFilter(m.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                          memberFilter === m.id ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/40 border-violet-400/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => { setStatutFilter('all'); setTypeFilter('all'); setMemberFilter('all'); }}
                    className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* --- Vues --- */}
        {viewMode === 'list' && (
          <PlanningListView
            chantiers={filteredChantiers}
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

        {viewMode === 'week' && (
          <PlanningWeekView
            currentDate={currentDate}
            chantiers={filteredChantiers}
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
