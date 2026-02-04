import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Building, Check, ChevronLeft, ChevronRight, Clock, User, Users, Pencil } from 'lucide-react';
import { useChantiers } from '@/context/ChantiersContext';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { fetchChantierAssignmentsByChantier, type TeamMember } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { Chantier } from '@/context/ChantiersContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChantierEditDialog } from '@/components/ChantierEditDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Parse "YYYY-MM-DD" (ou ISO avec time) en date locale pour éviter le décalage UTC
function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Fonction pour parser la durée et calculer la date de fin
function calculateEndDate(dateDebut: string, duree: string): Date {
  const startDate = parseLocalDate(dateDebut);
  const dureeLower = duree.toLowerCase().trim();
  
  // Parser différentes formats de durée
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
    // Si c'est juste un nombre, on assume des jours
    const days = parseInt(dureeLower.match(/\d+/)?.[0] || '1');
    daysToAdd = days;
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysToAdd);
  return endDate;
}

// Fonction pour obtenir les jours du mois
function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const days = [];
  
  // Ajouter les jours du mois précédent pour compléter la première semaine
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
      isToday: false
    });
  }
  
  // Ajouter les jours du mois actuel
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString()
    });
  }
  
  // Ajouter les jours du mois suivant pour compléter la dernière semaine
  const remainingDays = 42 - days.length; // 6 semaines * 7 jours
  for (let day = 1; day <= remainingDays; day++) {
    days.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
      isToday: false
    });
  }
  
  return days;
}

export default function PlanningPage() {
  const { chantiers, updateChantier } = useChantiers();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingChantier, setEditingChantier] = useState<Chantier | null>(null);
  const [updatingChantierId, setUpdatingChantierId] = useState<string | null>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [assignmentsByChantierId, setAssignmentsByChantierId] = useState<Record<string, TeamMember[]>>({});
  const [assignmentsRefreshKey, setAssignmentsRefreshKey] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  // Fonction pour obtenir les chantiers d'un jour donné
  const getChantiersForDay = useCallback((date: Date) => {
    return chantiers.filter(chantier => {
      const startDate = parseLocalDate(chantier.dateDebut);
      const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const chantierStart = new Date(startDate);
      chantierStart.setHours(0, 0, 0, 0);
      const chantierEnd = new Date(endDate);
      chantierEnd.setHours(23, 59, 59, 999);
      return dayStart >= chantierStart && dayStart <= chantierEnd;
    });
  }, [chantiers]);

  // Chantiers qui touchent le mois courant (même filtre que "Chantiers du mois")
  const chantiersInMonth = useMemo(() => {
    return chantiers.filter(chantier => {
      const startDate = parseLocalDate(chantier.dateDebut);
      const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
      return (
        (startDate.getMonth() === month && startDate.getFullYear() === year) ||
        (endDate.getMonth() === month && endDate.getFullYear() === year) ||
        (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1))
      );
    });
  }, [chantiers, year, month]);

  // Chantiers visibles dans la grille (tous les jours affichés) pour charger leurs affectations
  const chantiersInView = useMemo(() => {
    const ids = new Set<string>();
    days.forEach(d => getChantiersForDay(d.date).forEach(c => ids.add(c.id)));
    return chantiers.filter(c => ids.has(c.id));
  }, [chantiers, days, getChantiersForDay]);

  // Charger les affectations équipe par chantier (grille + liste du mois)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results = await Promise.all(
        chantiersInView.map(c => fetchChantierAssignmentsByChantier(c.id))
      );
      if (cancelled) return;
      const map: Record<string, TeamMember[]> = {};
      chantiersInView.forEach((c, i) => { map[c.id] = results[i] ?? []; });
      setAssignmentsByChantierId(prev => ({ ...prev, ...map }));
    };
    run();
    return () => { cancelled = true; };
  }, [chantiersInView, assignmentsRefreshKey]);

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
  
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const TYPE_CHANTIER_LABELS: Record<string, string> = {
  piscine: 'Piscine & Spa',
  paysage: 'Aménagement Paysager',
  menuiserie: 'Menuiserie Sur-Mesure',
  renovation: 'Rénovation',
  autre: 'Autre',
};
  
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
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-tl-3xl ml-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Planning des Chantiers
            </h1>
            <p className="text-sm text-white/70">Calendrier intégré pour organiser vos interventions</p>
          </div>
          <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 ml-20">
        {/* Contrôles du calendrier */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Popover open={periodPickerOpen} onOpenChange={(open) => {
                  setPeriodPickerOpen(open);
                  if (open) setPickerYear(year);
                }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xl font-semibold text-left hover:opacity-90 transition-opacity"
                      aria-label="Changer la période"
                    >
                      {monthNames[month]} {year}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 bg-black/90 border-white/10 text-white p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => Math.max(2020, y - 1))}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        aria-label="Année précédente"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium tabular-nums">{pickerYear}</span>
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => Math.min(2030, y + 1))}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
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
                          className={`px-2 py-1.5 rounded text-sm text-left hover:bg-white/10 transition-colors ${i === month && pickerYear === year ? 'bg-white/20' : ''}`}
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
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={goToToday}
                className="px-4 py-2 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors text-sm"
              >
                Aujourd'hui
              </button>
            </div>
          </CardHeader>
        </Card>

        {/* Calendrier */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <CardContent className="p-6">
            {/* En-têtes des jours */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {dayNames.map(day => (
                <div key={day} className="text-center text-sm font-semibold text-white/70 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Grille du calendrier */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const dayChantiers = getChantiersForDay(day.date);
                const isToday = day.isToday;
                
                return (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 rounded-lg border ${
                      day.isCurrentMonth
                        ? isToday
                          ? 'bg-white/10 border-white/30 border-2'
                          : 'bg-black/10 border-white/10'
                        : 'bg-black/5 border-white/5 opacity-50'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      day.isCurrentMonth ? 'text-white' : 'text-white/50'
                    } ${isToday ? 'text-white font-bold' : ''}`}>
                      {day.date.getDate()}
                    </div>
                    
                    {/* Afficher les chantiers */}
                    <div className="space-y-1">
                      {dayChantiers.slice(0, 2).map(chantier => {
                        const startDate = parseLocalDate(chantier.dateDebut);
                        const isStart = day.date.toDateString() === startDate.toDateString();
                        const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
                        const isEnd = day.date.toDateString() === endDate.toDateString();
                        const isUpdating = updatingChantierId === chantier.id;
                        return (
                          <DropdownMenu key={chantier.id}>
                            <DropdownMenuTrigger asChild>
                              <div
                                role="button"
                                tabIndex={0}
                                className={`text-xs p-1 rounded min-w-0 ${
                                  chantier.statut === 'planifié'
                                    ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                                    : chantier.statut === 'en cours'
                                    ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50'
                                    : 'bg-green-500/30 text-green-200 border border-green-500/50'
                                } cursor-pointer hover:opacity-90 ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}
                                title={`Cliquer pour changer le statut — ${chantier.nom} — ${chantier.clientName}${chantier.typeChantier ? ` — ${TYPE_CHANTIER_LABELS[chantier.typeChantier] ?? chantier.typeChantier}` : ''}${(assignmentsByChantierId[chantier.id]?.length ?? 0) > 0 ? ` — Équipe: ${(assignmentsByChantierId[chantier.id] ?? []).map(m => m.name).join(', ')}` : ''}`}
                              >
                                <span className="truncate block">{isStart && '▶ '}{isEnd && '◀ '}{chantier.nom}</span>
                                {(assignmentsByChantierId[chantier.id]?.length ?? 0) > 0 && (
                                  <span className="block truncate text-[10px] opacity-90 mt-0.5">
                                    {(assignmentsByChantierId[chantier.id] ?? []).map(m => m.name).join(', ')}
                                  </span>
                                )}
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-black/90 border-white/10 text-white">
                              <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'planifié')} className="focus:bg-white/10 focus:text-white">
                                {chantier.statut === 'planifié' && <Check className="mr-2 h-4 w-4" />}
                                Planifié
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'en cours')} className="focus:bg-white/10 focus:text-white">
                                {chantier.statut === 'en cours' && <Check className="mr-2 h-4 w-4" />}
                                En cours
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'terminé')} className="focus:bg-white/10 focus:text-white">
                                {chantier.statut === 'terminé' && <Check className="mr-2 h-4 w-4" />}
                                Terminé
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem onSelect={() => setEditingChantier(chantier)} className="focus:bg-white/10 focus:text-white">
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier le chantier
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })}
                      {dayChantiers.length > 2 && (
                        <div className="text-xs text-white/70">
                          +{dayChantiers.length - 2} autre(s)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Légende */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Légende</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50"></div>
                <span className="text-sm">Planifié</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500/50"></div>
                <span className="text-sm">En cours</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
                <span className="text-sm">Terminé</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des chantiers du mois */}
        {chantiers.length > 0 && (
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Chantiers du mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {chantiers
                  .filter(chantier => {
                    const startDate = parseLocalDate(chantier.dateDebut);
                    const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
                    return (
                      (startDate.getMonth() === month && startDate.getFullYear() === year) ||
                      (endDate.getMonth() === month && endDate.getFullYear() === year) ||
                      (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1))
                    );
                  })
                  .map(chantier => {
                    const startDate = parseLocalDate(chantier.dateDebut);
                    const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
                    const isUpdating = updatingChantierId === chantier.id;
                    return (
                      <DropdownMenu key={chantier.id}>
                        <DropdownMenuTrigger asChild>
                          <div
                            role="button"
                            tabIndex={0}
                            className={`p-3 rounded-lg bg-black/20 border border-white/10 cursor-pointer hover:bg-black/30 ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}
                            title="Cliquer pour changer le statut"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Building className="h-4 w-4 text-white/70" />
                                  <span className="font-semibold">{chantier.nom}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    chantier.statut === 'planifié'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : chantier.statut === 'en cours'
                                      ? 'bg-yellow-500/20 text-yellow-300'
                                      : 'bg-green-500/20 text-green-300'
                                  }`}>
                                    {chantier.statut}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-white/70">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {chantier.clientName}
                                  </div>
                                  {chantier.typeChantier && (
                                    <span className="text-white/50 text-xs">
                                      {TYPE_CHANTIER_LABELS[chantier.typeChantier] ?? chantier.typeChantier}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {startDate.toLocaleDateString('fr-FR')} - {endDate.toLocaleDateString('fr-FR')}
                                  </div>
                                </div>
                                {(assignmentsByChantierId[chantier.id]?.length ?? 0) > 0 && (
                                  <div className="flex items-center gap-1 text-sm text-white/60 mt-1">
                                    <Users className="h-3 w-3 shrink-0" />
                                    <span>{(assignmentsByChantierId[chantier.id] ?? []).map(m => m.name).join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-black/90 border-white/10 text-white">
                          <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'planifié')} className="focus:bg-white/10 focus:text-white">
                            {chantier.statut === 'planifié' && <Check className="mr-2 h-4 w-4" />}
                            Planifié
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'en cours')} className="focus:bg-white/10 focus:text-white">
                            {chantier.statut === 'en cours' && <Check className="mr-2 h-4 w-4" />}
                            En cours
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleChangeStatut(chantier, 'terminé')} className="focus:bg-white/10 focus:text-white">
                            {chantier.statut === 'terminé' && <Check className="mr-2 h-4 w-4" />}
                            Terminé
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10" />
                          <DropdownMenuItem onSelect={() => setEditingChantier(chantier)} className="focus:bg-white/10 focus:text-white">
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier le chantier
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        <ChantierEditDialog
          chantier={editingChantier}
          open={!!editingChantier}
          onOpenChange={(open) => {
            if (!open) {
              setEditingChantier(null);
              setAssignmentsRefreshKey(k => k + 1);
            }
          }}
        />
      </main>
    </PageWrapper>
  );
}
