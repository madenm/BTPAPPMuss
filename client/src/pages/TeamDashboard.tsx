import { useState, useEffect, useMemo } from "react"
import { useLocation } from "wouter"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TeamSidebar from '@/components/TeamSidebar'
import { GlobalBackground } from '@/components/GlobalBackground'
import { UserAccountButton } from '@/components/UserAccountButton'
import { Building, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useChantiers } from '@/context/ChantiersContext'
import type { Chantier } from '@/context/ChantiersContext'

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
    if (location === '/team-dashboard/projects') return 'projects' as const
    if (location === '/team-dashboard/planning') return 'planning' as const
    return 'overview' as const
  }, [location])
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'planning'>(tabFromPath)
  const { chantiers, refreshChantiers, loading } = useChantiers()
  const [teamMember, setTeamMember] = useState<any>(null)

  useEffect(() => {
    setActiveTab(tabFromPath)
  }, [tabFromPath])

  useEffect(() => {
    const storedMember = localStorage.getItem('teamMember')
    if (storedMember) {
      setTeamMember(JSON.parse(storedMember))
      refreshChantiers()
    }
  }, [refreshChantiers])

  const goToTab = (tab: 'overview' | 'projects' | 'planning') => {
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

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'TeamDashboard.tsx:chantiers', message: 'chantiers in UI', data: { chantiersLength: chantiers.length, chantierIds: chantiers.map((c) => c.id), myChantiersLength: myChantiers.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,D' }) }).catch(() => {});
  }, [chantiers, myChantiers.length]);
  // #endregion

  return (
    <>
      <GlobalBackground />
      <div className="flex min-h-screen relative overflow-hidden">
        {/* Sidebar */}
        <TeamSidebar />

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col relative z-10 ml-64 rounded-l-3xl overflow-hidden"
          >
            <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-tl-3xl ml-20">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Dashboard Membre d'Équipe
                  </h1>
                  <p className="text-sm text-white/70">
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
                <UserAccountButton variant="inline" />
              </div>
            </header>

            {/* Tabs Navigation */}
            <div className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 rounded-tl-3xl">
              <div className="flex gap-2 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToTab('overview')}
                  className={activeTab === 'overview' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                >
                  Vue d'ensemble
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToTab('projects')}
                  className={activeTab === 'projects' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                >
                  <Building className="h-4 w-4 mr-2" />
                  Mes Chantiers
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToTab('planning')}
                  className={activeTab === 'planning' ? 'bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30' : 'text-white hover:bg-white/10'}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Planning
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <main className="flex-1 p-6 space-y-6 overflow-auto ml-20">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mes Chantiers</CardTitle>
                        <Building className="h-4 w-4 text-white/70" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{myChantiers.length}</div>
                        <p className="text-xs text-white/70">Chantiers actifs</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">En Cours</CardTitle>
                        <Clock className="h-4 w-4 text-white/70" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{chantiersEnCours.length}</div>
                        <p className="text-xs text-white/70">Chantiers en cours</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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

                  {/* Mes Chantiers Récents */}
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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
                              className="flex items-center justify-between p-3 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg"
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
                </div>
              )}

              {activeTab === 'projects' && (
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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
                          <Card key={chantier.id} className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
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

              {activeTab === 'planning' && (
                <div className="space-y-4">
                  {!loading && chantiers.length === 0 ? (
                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                      <CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70">Aucun chantier assigné</p>
                        <p className="text-sm text-white/50 mt-2">Votre planning s'affichera ici une fois que des chantiers vous auront été affectés.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
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
            </main>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

