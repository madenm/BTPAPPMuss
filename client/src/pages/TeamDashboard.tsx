import { useState, useEffect, useMemo } from "react"
import { useLocation } from "wouter"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TeamSidebar from '@/components/TeamSidebar'
import { GlobalBackground } from '@/components/GlobalBackground'
import { UserAccountButton } from '@/components/UserAccountButton'
import { Building, Calendar, Clock, ChevronLeft, ChevronRight, FileText, LayoutGrid, Receipt, Users, UserCircle, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useChantiers } from '@/context/ChantiersContext'
import type { Chantier } from '@/context/ChantiersContext'
import QuotesPage from '@/pages/QuotesPage'
import CRMPipelinePage from '@/pages/CRMPipelinePage'
import InvoicesPage from '@/pages/InvoicesPage'
import TeamPage from '@/pages/TeamPage'
import ClientsPage from '@/pages/ClientsPage'
import { refreshTeamMember, type TeamMember } from '@/lib/supabase'
import { TeamEffectiveUserIdProvider } from '@/context/TeamEffectiveUserIdContext'

// Helpers pour le planning (alignés sur PlanningPage)
function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10)
  const [y, m, d] = datePart.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function calculateEndDate(dateDebut: string, duree: string): Date {
  const startDate = parseLocalDate(dateDebut)
  const dureeLower = duree.toLowerCase().trim()
  let daysToAdd = 0
  if (dureeLower.includes('semaine') || dureeLower.includes('sem')) {
    daysToAdd = (parseInt(dureeLower.match(/\d+/)?.[0] || '1') || 1) * 7
  } else if (dureeLower.includes('mois')) {
    daysToAdd = (parseInt(dureeLower.match(/\d+/)?.[0] || '1') || 1) * 30
  } else {
    daysToAdd = parseInt(dureeLower.match(/\d+/)?.[0] || '1') || 1
  }
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + daysToAdd)
  return endDate
}
function getDaysInMonth(year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = new Date(year, month, 1).getDay()
  const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []
  const today = new Date()
  const prevMonth = new Date(year, month, 0)
  const prevMonthDays = prevMonth.getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false, isToday: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    days.push({ date, isCurrentMonth: true, isToday: date.toDateString() === today.toDateString() })
  }
  for (let day = 1; days.length < 42; day++) {
    days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false, isToday: false })
  }
  return days
}
function getChantiersForDay(date: Date, chantiers: Chantier[]): Chantier[] {
  return chantiers.filter((c) => {
    const start = parseLocalDate(c.dateDebut)
    const end = calculateEndDate(c.dateDebut, c.duree)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const s = new Date(start)
    s.setHours(0, 0, 0, 0)
    const e = new Date(end)
    e.setHours(23, 59, 59, 999)
    return d >= s && d <= e
  })
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function TeamDashboard() {
  const [location, setLocation] = useLocation()
  const tabFromPath = useMemo(() => {
    // Vérifier les permissions avant de déterminer l'onglet actif
    const storedMember = localStorage.getItem('teamMember');
    let teamMemberForCheck: TeamMember | null = null;
    if (storedMember) {
      try {
        const member = JSON.parse(storedMember);
        let permissionsFromStorage: Partial<TeamMember> = {};
        try {
          const storedPermissions = localStorage.getItem(`team_member_permissions_${member.id}`);
          if (storedPermissions) {
            permissionsFromStorage = JSON.parse(storedPermissions);
          }
        } catch (e) {
          console.warn('Could not load permissions from localStorage:', e);
        }
        // Donner la priorité aux permissions stockées dans localStorage
        teamMemberForCheck = {
          ...member,
          can_view_dashboard: permissionsFromStorage.can_view_dashboard !== undefined 
            ? permissionsFromStorage.can_view_dashboard 
            : (member.can_view_dashboard ?? false),
          can_use_estimation: permissionsFromStorage.can_use_estimation !== undefined 
            ? permissionsFromStorage.can_use_estimation 
            : (member.can_use_estimation ?? false),
          can_view_all_chantiers: permissionsFromStorage.can_view_all_chantiers !== undefined 
            ? permissionsFromStorage.can_view_all_chantiers 
            : (member.can_view_all_chantiers ?? false),
          can_manage_chantiers: permissionsFromStorage.can_manage_chantiers !== undefined 
            ? permissionsFromStorage.can_manage_chantiers 
            : (member.can_manage_chantiers ?? false),
          can_view_planning: permissionsFromStorage.can_view_planning !== undefined 
            ? permissionsFromStorage.can_view_planning 
            : (member.can_view_planning ?? false),
          can_manage_planning: permissionsFromStorage.can_manage_planning !== undefined 
            ? permissionsFromStorage.can_manage_planning 
            : (member.can_manage_planning ?? false),
          can_access_crm: permissionsFromStorage.can_access_crm !== undefined 
            ? permissionsFromStorage.can_access_crm 
            : (member.can_access_crm ?? false),
          can_create_quotes: permissionsFromStorage.can_create_quotes !== undefined 
            ? permissionsFromStorage.can_create_quotes 
            : (member.can_create_quotes ?? false),
          can_manage_invoices: permissionsFromStorage.can_manage_invoices !== undefined 
            ? permissionsFromStorage.can_manage_invoices 
            : (member.can_manage_invoices ?? false),
          can_use_ai_visualization: permissionsFromStorage.can_use_ai_visualization !== undefined 
            ? permissionsFromStorage.can_use_ai_visualization 
            : (member.can_use_ai_visualization ?? false),
          can_manage_team: permissionsFromStorage.can_manage_team !== undefined 
            ? permissionsFromStorage.can_manage_team 
            : (member.can_manage_team ?? false),
          can_manage_clients: permissionsFromStorage.can_manage_clients !== undefined 
            ? permissionsFromStorage.can_manage_clients 
            : (member.can_manage_clients ?? false),
        } as TeamMember;
      } catch (e) {
        console.error('Error parsing team member:', e);
      }
    }
    
    if (location === '/team-dashboard/projects') {
      if (teamMemberForCheck?.can_view_all_chantiers || teamMemberForCheck?.can_manage_chantiers) {
        return 'projects' as const;
      }
      return 'overview' as const;
    }
    if (location === '/team-dashboard/planning') {
      if (teamMemberForCheck?.can_view_planning || teamMemberForCheck?.can_manage_planning) {
        return 'planning' as const;
      }
      return 'overview' as const;
    }
    if (location === '/team-dashboard/quotes') {
      if (teamMemberForCheck?.can_create_quotes) {
        return 'quotes' as const;
      }
      return 'overview' as const;
    }
    if (location === '/team-dashboard/crm' && teamMemberForCheck?.can_access_crm) return 'crm' as const;
    if (location === '/team-dashboard/invoices' && teamMemberForCheck?.can_manage_invoices) return 'invoices' as const;
    if (location === '/team-dashboard/team' && teamMemberForCheck?.can_manage_team) return 'team' as const;
    if (location === '/team-dashboard/clients' && teamMemberForCheck?.can_manage_clients) return 'clients' as const;
    return 'overview' as const
  }, [location])
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'planning' | 'quotes' | 'crm' | 'invoices' | 'team' | 'clients'>(tabFromPath)
  const { chantiers, refreshChantiers, refreshClients, loading } = useChantiers()
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)

  useEffect(() => {
    setActiveTab(tabFromPath)
  }, [tabFromPath])
  
  // Rediriger si l'utilisateur n'a pas la permission pour l'onglet demandé
  useEffect(() => {
    if (!teamMember) return;
    
    if (tabFromPath === 'projects' && !teamMember.can_view_all_chantiers && !teamMember.can_manage_chantiers) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'planning' && !teamMember.can_view_planning && !teamMember.can_manage_planning) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'quotes' && !teamMember.can_create_quotes) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'crm' && !teamMember.can_access_crm) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'invoices' && !teamMember.can_manage_invoices) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'team' && !teamMember.can_manage_team) {
      setLocation('/team-dashboard');
    } else if (tabFromPath === 'clients' && !teamMember.can_manage_clients) {
      setLocation('/team-dashboard');
    }
  }, [tabFromPath, teamMember, setLocation])

  // Exposer l'user_id du propriétaire pour que getCurrentUserId() renvoie cet id en mode membre d'équipe
  useEffect(() => {
    if (teamMember?.user_id) {
      window.__AOS_TEAM_EFFECTIVE_USER_ID__ = teamMember.user_id;
      refreshClients();
    } else {
      window.__AOS_TEAM_EFFECTIVE_USER_ID__ = null;
    }
    return () => {
      window.__AOS_TEAM_EFFECTIVE_USER_ID__ = null;
    };
  }, [teamMember?.user_id, refreshClients])

  useEffect(() => {
    const storedMember = localStorage.getItem('teamMember')
    if (!storedMember) return

    const applyMember = (memberWithPermissions: TeamMember) => {
      setTeamMember(memberWithPermissions)
      refreshChantiers()
      window.dispatchEvent(new CustomEvent('teamMemberRefreshed'))
    }

    const mergePermissions = (member: TeamMember): TeamMember => {
      let permissionsFromStorage: Partial<TeamMember> = {}
      try {
        const storedPermissions = localStorage.getItem(`team_member_permissions_${member.id}`)
        if (storedPermissions) permissionsFromStorage = JSON.parse(storedPermissions)
      } catch (e) {
        console.warn('Could not load permissions from localStorage:', e)
      }
      return {
        ...member,
        can_view_dashboard: permissionsFromStorage.can_view_dashboard !== undefined ? permissionsFromStorage.can_view_dashboard : (member.can_view_dashboard ?? false),
        can_use_estimation: permissionsFromStorage.can_use_estimation !== undefined ? permissionsFromStorage.can_use_estimation : (member.can_use_estimation ?? false),
        can_view_all_chantiers: permissionsFromStorage.can_view_all_chantiers !== undefined ? permissionsFromStorage.can_view_all_chantiers : (member.can_view_all_chantiers ?? false),
        can_manage_chantiers: permissionsFromStorage.can_manage_chantiers !== undefined ? permissionsFromStorage.can_manage_chantiers : (member.can_manage_chantiers ?? false),
        can_view_planning: permissionsFromStorage.can_view_planning !== undefined ? permissionsFromStorage.can_view_planning : (member.can_view_planning ?? false),
        can_manage_planning: permissionsFromStorage.can_manage_planning !== undefined ? permissionsFromStorage.can_manage_planning : (member.can_manage_planning ?? false),
        can_access_crm: permissionsFromStorage.can_access_crm !== undefined ? permissionsFromStorage.can_access_crm : (member.can_access_crm ?? false),
        can_create_quotes: permissionsFromStorage.can_create_quotes !== undefined ? permissionsFromStorage.can_create_quotes : (member.can_create_quotes ?? false),
        can_manage_invoices: permissionsFromStorage.can_manage_invoices !== undefined ? permissionsFromStorage.can_manage_invoices : (member.can_manage_invoices ?? false),
        can_use_ai_visualization: permissionsFromStorage.can_use_ai_visualization !== undefined ? permissionsFromStorage.can_use_ai_visualization : (member.can_use_ai_visualization ?? false),
        can_manage_team: permissionsFromStorage.can_manage_team !== undefined ? permissionsFromStorage.can_manage_team : (member.can_manage_team ?? false),
        can_manage_clients: permissionsFromStorage.can_manage_clients !== undefined ? permissionsFromStorage.can_manage_clients : (member.can_manage_clients ?? false),
      }
    }

    ;(async () => {
      try {
        const member = JSON.parse(storedMember) as TeamMember
        const code = sessionStorage.getItem('teamMemberLoginCode') || localStorage.getItem('teamMemberLoginCode')
        if (member.id && code) {
          const refreshed = await refreshTeamMember(member.id, code)
          if (refreshed) {
            localStorage.setItem('teamMember', JSON.stringify(refreshed))
            applyMember(mergePermissions(refreshed))
            return
          }
        }
        applyMember(mergePermissions(member))
      } catch (error) {
        console.error('Error loading team member:', error)
      }
    })()
  }, [refreshChantiers])

  const goToTab = (tab: 'overview' | 'projects' | 'planning' | 'quotes' | 'crm' | 'invoices' | 'team' | 'clients') => {
    if (tab === 'projects' && !teamMember?.can_view_all_chantiers && !teamMember?.can_manage_chantiers) return;
    if (tab === 'planning' && !teamMember?.can_view_planning && !teamMember?.can_manage_planning) return;
    if (tab === 'quotes' && !teamMember?.can_create_quotes) return;
    if (tab === 'crm' && !teamMember?.can_access_crm) return;
    if (tab === 'invoices' && !teamMember?.can_manage_invoices) return;
    if (tab === 'team' && !teamMember?.can_manage_team) return;
    if (tab === 'clients' && !teamMember?.can_manage_clients) return;
    setActiveTab(tab)
    const path = tab === 'overview' ? '/team-dashboard' : `/team-dashboard/${tab}`
    setLocation(path)
  }

  // Planning simplifié : mois affiché
  const [planningDate, setPlanningDate] = useState(() => new Date())
  const planningYear = planningDate.getFullYear()
  const planningMonth = planningDate.getMonth()
  const planningDays = useMemo(() => getDaysInMonth(planningYear, planningMonth), [planningYear, planningMonth])

  // Stats pour le membre
  const myChantiers = chantiers.filter(c => c.statut !== 'terminé')
  const chantiersEnCours = chantiers.filter(c => c.statut === 'en cours')
  const chantiersPlanifies = chantiers.filter(c => c.statut === 'planifié')

  const [teamMenuOpen, setTeamMenuOpen] = useState(false);

  return (
    <>
      <GlobalBackground />
      <div className="flex min-h-screen relative overflow-hidden">
        {/* Sidebar - desktop only */}
        <TeamSidebar />

        {/* Main Content */}
        <Sheet open={teamMenuOpen} onOpenChange={setTeamMenuOpen}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col relative z-10 ml-0 md:ml-64 rounded-l-3xl overflow-hidden"
            >
              <header className="bg-black/10 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
                  <div className="flex items-center gap-2 min-w-0 w-full sm:flex-1">
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-10 w-10 min-h-[44px] min-w-[44px] text-white hover:bg-white/10">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
                      Dashboard Membre d'Équipe
                    </h1>
                    <p className="text-xs sm:text-sm text-white/70 sm:truncate">
                      {teamMember ? (
                        <>
                          Bienvenue, {teamMember.name}
                          {teamMember.role && (
                            <span className="ml-2 text-white/50">• Connecté en tant qu'{teamMember.role}</span>
                          )}
                        </>
                      ) : (
                        'Chargement...'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                  <UserAccountButton variant="inline" />
                </div>
              </div>
            </header>

            {/* Tabs Navigation */}
            <div className="bg-black/10 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 rounded-tl-3xl">
              <div className="flex gap-2 overflow-x-auto min-w-0">
                {/* Vue d'ensemble - toujours accessible */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToTab('overview')}
                  className={activeTab === 'overview' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                >
                  Vue d'ensemble
                </Button>
                
                {/* Mes Chantiers - seulement si permission */}
                {(teamMember?.can_view_all_chantiers || teamMember?.can_manage_chantiers) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToTab('projects')}
                    className={activeTab === 'projects' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Mes Chantiers
                  </Button>
                )}
                
                {/* Planning - seulement si permission */}
                {(teamMember?.can_view_planning || teamMember?.can_manage_planning) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToTab('planning')}
                    className={activeTab === 'planning' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Planning
                  </Button>
                )}
                
                {/* Créer un Devis - seulement si permission */}
                {teamMember?.can_create_quotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToTab('quotes')}
                    className={activeTab === 'quotes' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Créer un Devis
                  </Button>
                )}
                {teamMember?.can_access_crm && (
                  <Button variant="ghost" size="sm" onClick={() => goToTab('crm')} className={activeTab === 'crm' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}>
                    <LayoutGrid className="h-4 w-4 mr-2" /> CRM
                  </Button>
                )}
                {teamMember?.can_manage_invoices && (
                  <Button variant="ghost" size="sm" onClick={() => goToTab('invoices')} className={activeTab === 'invoices' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}>
                    <Receipt className="h-4 w-4 mr-2" /> Factures
                  </Button>
                )}
                {teamMember?.can_manage_team && (
                  <Button variant="ghost" size="sm" onClick={() => goToTab('team')} className={activeTab === 'team' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}>
                    <Users className="h-4 w-4 mr-2" /> Équipe
                  </Button>
                )}
                {teamMember?.can_manage_clients && (
                  <Button variant="ghost" size="sm" onClick={() => goToTab('clients')} className={activeTab === 'clients' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}>
                    <UserCircle className="h-4 w-4 mr-2" /> Clients
                  </Button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <TeamEffectiveUserIdProvider value={teamMember?.user_id ?? null}>
            <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-auto overflow-x-hidden">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {(() => {
                    // Si le membre n'est pas encore chargé, afficher un message de chargement
                    if (!teamMember) {
                      return (
                        <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                          <CardContent className="py-12 text-center">
                            <p className="text-white/70">Chargement...</p>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    // Vérifier si le membre a au moins une permission accordée
                    const hasAnyPermission = 
                      teamMember.can_view_dashboard ||
                      teamMember.can_use_estimation ||
                      teamMember.can_view_all_chantiers ||
                      teamMember.can_manage_chantiers ||
                      teamMember.can_view_planning ||
                      teamMember.can_manage_planning ||
                      teamMember.can_access_crm ||
                      teamMember.can_create_quotes ||
                      teamMember.can_manage_invoices ||
                      teamMember.can_use_ai_visualization ||
                      teamMember.can_manage_team ||
                      teamMember.can_manage_clients;
                    
                    // Si le membre n'a aucune permission, afficher le message d'accès limité
                    if (!hasAnyPermission) {
                      return (
                        <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                          <CardContent className="py-12 text-center">
                            <Building className="h-12 w-12 mx-auto mb-4 text-white/50" />
                            <p className="text-white/70 text-lg font-semibold">Accès limité</p>
                            <p className="text-sm text-white/50 mt-2">Vous n'avez pas accès au tableau de bord complet. Contactez votre administrateur pour obtenir cette autorisation.</p>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    // Sinon, afficher le contenu du dashboard
                    return (
                      <>
                        {/* Stats Cards - seulement si permission de voir les chantiers */}
                        {(teamMember.can_view_all_chantiers || teamMember.can_manage_chantiers) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Mes Chantiers</CardTitle>
                                <Building className="h-4 w-4 text-white/70" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">{myChantiers.length}</div>
                                <p className="text-xs text-white/70">Chantiers actifs</p>
                              </CardContent>
                            </Card>

                            <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">En Cours</CardTitle>
                                <Clock className="h-4 w-4 text-white/70" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">{chantiersEnCours.length}</div>
                                <p className="text-xs text-white/70">Chantiers en cours</p>
                              </CardContent>
                            </Card>

                            <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Planifiés</CardTitle>
                                <Calendar className="h-4 w-4 text-white/70" />
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">{chantiersPlanifies.length}</div>
                                <p className="text-xs text-white/70">Chantiers planifiés</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* Mes Chantiers Récents - seulement si permission de voir les chantiers */}
                        {(teamMember.can_view_all_chantiers || teamMember.can_manage_chantiers) && (
                          <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                            <CardHeader>
                              <CardTitle>Mes Chantiers Récents</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {chantiers.length === 0 ? (
                                <p className="text-white/70 text-center py-4">Aucun chantier assigné</p>
                              ) : (
                                <div className="space-y-3">
                                  {chantiers.slice(0, 5).map((chantier) => (
                                    <div
                                      key={chantier.id}
                                      className="flex items-center justify-between p-3 bg-black/10 backdrop-blur-md border border-white/10 rounded-lg"
                                    >
                                      <div>
                                        <p className="font-medium text-white">{chantier.nom}</p>
                                        <p className="text-sm text-white/70">Client: {chantier.clientName}</p>
                                        <p className="text-xs text-white/60">Début: {chantier.dateDebut} ({chantier.duree})</p>
                                      </div>
                                      <Badge className={
                                        chantier.statut === 'planifié' ? 'bg-blue-500/20 text-blue-300' :
                                        chantier.statut === 'en cours' ? 'bg-yellow-500/20 text-yellow-300' :
                                        'bg-green-500/20 text-green-300'
                                      }>
                                        {chantier.statut}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {activeTab === 'projects' && (
                <>
                  {!teamMember?.can_view_all_chantiers && !teamMember?.can_manage_chantiers ? (
                    <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                      <CardContent className="py-12 text-center">
                        <Building className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70 text-lg font-semibold">Accès refusé</p>
                        <p className="text-sm text-white/50 mt-2">Vous n'avez pas la permission de voir les chantiers. Contactez votre administrateur pour obtenir cette autorisation.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                      <CardHeader>
                        <CardTitle>Mes Chantiers</CardTitle>
                      </CardHeader>
                      <CardContent>
                    {loading ? (
                      <div className="text-center py-8">
                        <p className="text-white/70">Chargement des chantiers...</p>
                      </div>
                    ) : chantiers.length === 0 ? (
                      <div className="text-center py-8">
                        <Building className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70">Aucun chantier assigné</p>
                        <p className="text-sm text-white/50 mt-2">Vos chantiers apparaîtront ici une fois que l'administrateur vous y aura affecté.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {chantiers.map((chantier) => (
                          <Card key={chantier.id} className="bg-black/10 backdrop-blur-lg border border-white/10 text-white">
                            <CardHeader>
                              <CardTitle className="text-lg">{chantier.nom}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <p className="text-sm text-white/70">Client: {chantier.clientName}</p>
                              <p className="text-sm text-white/70">Début: {chantier.dateDebut}</p>
                              <p className="text-sm text-white/70">Durée: {chantier.duree}</p>
                              {chantier.images.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {chantier.images.slice(0, 2).map((img, index) => (
                                    <img key={index} src={img} alt={`Chantier ${index}`} className="w-full h-20 object-cover rounded-md" />
                                  ))}
                                </div>
                              )}
                              <Badge className={
                                chantier.statut === 'planifié' ? 'bg-blue-500/20 text-blue-300' :
                                chantier.statut === 'en cours' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-green-500/20 text-green-300'
                              }>
                                {chantier.statut}
                              </Badge>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                  )}
                </>
              )}

              {activeTab === 'quotes' && (
                <div className="space-y-6">
                  {teamMember?.can_create_quotes ? (
                    <QuotesPage />
                  ) : (
                    <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                      <CardContent className="py-12 text-center">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70 text-lg font-semibold">Accès refusé</p>
                        <p className="text-sm text-white/50 mt-2">Vous n'avez pas la permission de créer des devis. Contactez votre administrateur pour obtenir cette autorisation.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === 'crm' && teamMember?.can_access_crm && (
                <div className="min-h-[60vh]">
                  <CRMPipelinePage />
                </div>
              )}
              {activeTab === 'invoices' && teamMember?.can_manage_invoices && (
                <div className="min-h-[60vh]">
                  <InvoicesPage />
                </div>
              )}
              {activeTab === 'team' && teamMember?.can_manage_team && (
                <div className="min-h-[60vh]">
                  <TeamPage />
                </div>
              )}
              {activeTab === 'clients' && teamMember?.can_manage_clients && (
                <div className="min-h-[60vh]">
                  <ClientsPage />
                </div>
              )}

              {activeTab === 'planning' && (
                <>
                  {!teamMember?.can_view_planning && !teamMember?.can_manage_planning ? (
                    <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                      <CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70 text-lg font-semibold">Accès refusé</p>
                        <p className="text-sm text-white/50 mt-2">Vous n'avez pas la permission de voir le planning. Contactez votre administrateur pour obtenir cette autorisation.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {!loading && chantiers.length === 0 ? (
                    <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                      <CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70">Aucun chantier assigné</p>
                        <p className="text-sm text-white/50 mt-2">Votre planning s'affichera ici une fois que des chantiers vous auront été affectés.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                  <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle>Mon Planning</CardTitle>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPlanningDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label="Mois précédent"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <span className="text-lg font-semibold min-w-[180px] text-center">
                            {MONTH_NAMES[planningMonth]} {planningYear}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPlanningDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label="Mois suivant"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPlanningDate(new Date())}
                            className="text-white hover:bg-white/10"
                          >
                            Aujourd'hui
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-7 gap-2 mb-4">
                        {DAY_NAMES.map((day) => (
                          <div key={day} className="text-center text-sm font-semibold text-white/70 py-2">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {planningDays.map((day, index) => {
                          const dayChantiers = getChantiersForDay(day.date, chantiers)
                          return (
                            <div
                              key={index}
                              className={`min-h-[90px] p-2 rounded-lg border ${
                                day.isCurrentMonth
                                  ? day.isToday
                                    ? 'bg-white/10 border-white/30 border-2'
                                    : 'bg-black/10 border-white/10'
                                  : 'bg-black/5 border-white/5 opacity-50'
                              }`}
                            >
                              <div
                                className={`text-sm font-medium mb-1 ${
                                  day.isCurrentMonth ? 'text-white' : 'text-white/50'
                                } ${day.isToday ? 'font-bold' : ''}`}
                              >
                                {day.date.getDate()}
                              </div>
                              <div className="space-y-1">
                                {dayChantiers.slice(0, 3).map((chantier) => {
                                  const startDate = parseLocalDate(chantier.dateDebut)
                                  const isStart = day.date.toDateString() === startDate.toDateString()
                                  const endDate = calculateEndDate(chantier.dateDebut, chantier.duree)
                                  const isEnd = day.date.toDateString() === endDate.toDateString()
                                  return (
                                    <div
                                      key={chantier.id}
                                      className={`text-xs p-1 rounded truncate ${
                                        chantier.statut === 'planifié'
                                          ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                                          : chantier.statut === 'en cours'
                                          ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50'
                                          : 'bg-green-500/30 text-green-200 border border-green-500/50'
                                      }`}
                                      title={`${chantier.nom} — ${chantier.clientName} — ${chantier.statut}`}
                                    >
                                      {isStart && '▶ '}
                                      {isEnd && '◀ '}
                                      {chantier.nom}
                                    </div>
                                  )
                                })}
                                {dayChantiers.length > 3 && (
                                  <div className="text-xs text-white/60">+{dayChantiers.length - 3}</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
                    <CardContent className="py-3">
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50" />
                          <span className="text-sm">Planifié</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500/50" />
                          <span className="text-sm">En cours</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50" />
                          <span className="text-sm">Terminé</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    </>
                  )}
                    </div>
                  )}
                </>
              )}
            </main>
            </TeamEffectiveUserIdProvider>
          </motion.div>
        </AnimatePresence>
          <SheetContent side="left" className="w-[min(20rem,85vw)] p-0 bg-black/20 backdrop-blur-xl border-white/10 rounded-r-3xl border-r md:hidden">
            <TeamSidebar variant="drawer" onNavigate={() => setTeamMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

