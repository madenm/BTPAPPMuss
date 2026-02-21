import { useEffect, useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Sidebar from '@/components/Sidebar'
import { 
  Building, 
  FileText, 
  Euro,
  TrendingUp,
  Plus,
  Users,
  User,
  Clock,
  Calendar,
  Wallet,
  StickyNote
} from 'lucide-react'
import { UserAccountButton } from '@/components/UserAccountButton'
import { Link, useLocation } from 'wouter'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useChantiers } from '@/context/ChantiersContext'
import { fetchChantierAssignmentsByChantier, type TeamMember } from '@/lib/supabase'
import { fetchPlanningNoteForDate } from '@/lib/supabasePlanningNotes'
import { toNoteDateKey } from '@/lib/planningUtils'

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

export default function Dashboard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const userType = localStorage.getItem('userType')
    if (userType === 'team') {
      setLocation('/team-dashboard')
    }
  }, [setLocation])
  
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="relative z-10">
        <Sidebar />

        {/* Main Content */}
        <main className="ml-0 lg:ml-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-7xl mx-auto min-w-0"
          >
            {/* Header */}
            <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
              <div className="min-w-0 w-full sm:flex-1 pl-20">
                <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white mb-2 drop-shadow-lg sm:truncate">
                  Dashboard
                </h1>
                <p className="text-white/90 drop-shadow-md text-sm sm:text-base sm:truncate">Vue d'ensemble de votre activité</p>
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                <UserAccountButton variant="inline" />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <OverviewTab />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
      </div>
    </div>
  )
}

// Overview Tab Component
function OverviewTab() {
  const [, setLocation] = useLocation();
  const { chantiers } = useChantiers();
  const [assignmentsByChantierId, setAssignmentsByChantierId] = useState<Record<string, TeamMember[]>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [noteToday, setNoteToday] = useState<string | null>(null);

  const todayKey = toNoteDateKey(new Date());

  useEffect(() => {
    let cancelled = false;
    fetchPlanningNoteForDate(todayKey).then((note) => {
      if (!cancelled && note?.content?.trim()) setNoteToday(note.content.trim());
      else if (!cancelled) setNoteToday(null);
    });
    return () => { cancelled = true; };
  }, [todayKey]);

  const {
    totalRevenue,
    activeChantiers,
    pendingQuotes,
    conversionRate,
    remainingToCollect,
    revenueEvolution,
    conversionEvolution,
    loading,
    error,
  } = useDashboardMetrics();

  // Filtrer les chantiers actifs aujourd'hui
  const chantiersToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return chantiers.filter(chantier => {
      const startDate = parseLocalDate(chantier.dateDebut);
      const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });
  }, [chantiers]);

  // Charger les affectations d'équipe pour les chantiers du jour
  useEffect(() => {
    if (chantiersToday.length === 0) {
      setAssignmentsByChantierId({});
      return;
    }

    let cancelled = false;
    setLoadingAssignments(true);
    
    const loadAssignments = async () => {
      try {
        const results = await Promise.all(
          chantiersToday.map(c => fetchChantierAssignmentsByChantier(c.id))
        );
        
        if (cancelled) return;
        
        const map: Record<string, TeamMember[]> = {};
        chantiersToday.forEach((c, i) => {
          map[c.id] = results[i] ?? [];
        });
        setAssignmentsByChantierId(map);
      } catch (error) {
        console.error('Error loading assignments:', error);
      } finally {
        if (!cancelled) {
          setLoadingAssignments(false);
        }
      }
    };

    loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [chantiersToday]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white">
        <div className="text-center">
          <div className="text-lg mb-2">Chargement des métriques...</div>
          <div className="text-sm text-white/60">Récupération de vos données</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-white">
        <div className="text-center">
          <div className="text-lg mb-2 text-red-400">Erreur</div>
          <div className="text-sm text-white/60">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Chiffre d'Affaires"
          value={formatCurrency(totalRevenue)}
          change={totalRevenue > 0 ? "Devis acceptés ce mois-ci (HT)" : "Aucun devis accepté ce mois-ci"}
          icon={Euro}
          delay={0.1}
        />
        <MetricCard
          title="Chantiers en cours"
          value={activeChantiers.toString()}
          change={activeChantiers > 0 ? "Projets en cours" : "Aucun projet en cours"}
          icon={Building}
          delay={0.2}
        />
        <MetricCard
          title="Devis En Attente"
          value={pendingQuotes.toString()}
          change={pendingQuotes > 0 ? "Réponses attendues" : "Aucun devis en attente"}
          icon={FileText}
          delay={0.3}
        />
        <MetricCard
          title="À encaisser"
          value={formatCurrency(remainingToCollect)}
          change={remainingToCollect > 0 ? "Montant restant sur les factures" : "Toutes les factures soldées"}
          icon={Wallet}
          delay={0.4}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader>
            <CardTitle className="text-white font-light">Évolution des Revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueEvolution}>
                  <defs>
                    <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.7)" />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.7)" 
                    domain={[0, (dataMax) => {
                      if (!dataMax || dataMax === 0) return 1000;
                      const rounded = Math.ceil(dataMax * 1.2);
                      const magnitude = Math.pow(10, Math.floor(Math.log10(rounded)));
                      return Math.ceil(rounded / magnitude) * magnitude;
                    }]}
                    tickFormatter={(value) => {
                      if (value >= 1000) {
                        const k = Math.round(value / 1000);
                        return `${k}k`;
                      }
                      return Math.round(value).toString();
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                  <Area type="monotone" dataKey="revenus" stroke="#a78bfa" fillOpacity={1} fill="url(#colorRevenus)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-white/60">
                Aucune donnée de revenus disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader>
            <CardTitle className="text-white font-light flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Chantiers du Jour
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {noteToday !== null && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-200/90 text-sm font-medium mb-1">
                  <StickyNote className="h-4 w-4 shrink-0" />
                  Note du jour
                </div>
                <p className="text-white/90 text-sm whitespace-pre-wrap">{noteToday}</p>
              </div>
            )}
            {loadingAssignments ? (
              <div className="flex items-center justify-center h-64 text-white/60">
                <div className="text-center">
                  <div className="text-sm mb-2">Chargement des affectations...</div>
                </div>
              </div>
            ) : chantiersToday.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-white/60">
                <div className="text-center">
                  <Building className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <div className="text-sm">Aucun projet aujourd'hui</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {chantiersToday.map(chantier => {
                  const startDate = parseLocalDate(chantier.dateDebut);
                  const endDate = calculateEndDate(chantier.dateDebut, chantier.duree);
                  const members = assignmentsByChantierId[chantier.id] ?? [];
                  
                  return (
                    <div
                      key={chantier.id}
                      className="p-4 rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building className="h-4 w-4 text-white/70" />
                            <span className="font-semibold text-white">{chantier.nom}</span>
                            <Badge className={
                              chantier.statut === 'planifié'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                                : chantier.statut === 'en cours'
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                                : 'bg-green-500/20 text-green-300 border-green-500/50'
                            }>
                              {chantier.statut}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-white/70 mb-2">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {chantier.clientName}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {startDate.toLocaleDateString('fr-FR')} - {endDate.toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          {members.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-white/80 mt-2 pt-2 border-t border-white/10">
                              <Users className="h-4 w-4 text-white/70 shrink-0" />
                              <span className="text-white/70">Équipe :</span>
                              <span className="text-white">{members.map(m => m.name).join(', ')}</span>
                            </div>
                          )}
                          {members.length === 0 && (
                            <div className="flex items-center gap-2 text-sm text-white/50 mt-2 pt-2 border-t border-white/10">
                              <Users className="h-4 w-4 shrink-0" />
                              <span>Aucun membre assigné</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
        <CardHeader>
          <CardTitle className="text-white font-light">Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            className="w-full justify-start h-auto p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
            onClick={() => setLocation('/dashboard/projects?openDialog=true')}
          >
            <Plus className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Nouveau Chantier</div>
              <div className="text-xs opacity-70">Créer un projet</div>
            </div>
          </Button>
          <Button 
            className="w-full justify-start h-auto p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
            onClick={() => setLocation('/dashboard/quotes')}
          >
            <FileText className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Créer un Devis</div>
              <div className="text-xs opacity-70">Générer un devis</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ title, value, change, icon: Icon, delay }: { title: string, value: string, change: string, icon: any, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl hover:shadow-2xl transition-shadow text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white/70">{title}</CardTitle>
          <Icon className="h-5 w-5 text-violet-400" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light text-white mb-1">{value}</div>
          <p className="text-xs text-white/60">{change}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

