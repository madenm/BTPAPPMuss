import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Sidebar from '@/components/Sidebar'
import { 
  Building, 
  FileText, 
  Wand2, 
  Euro,
  TrendingUp,
  Plus
} from 'lucide-react'
import { UserAccountButton } from '@/components/UserAccountButton'
import { Link, useLocation } from 'wouter'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'

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
        <main className="ml-0 lg:ml-0 p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-7xl mx-auto"
          >
            {/* Header */}
            <div className="mb-8 ml-20 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-light tracking-tight text-white mb-2 drop-shadow-lg">
                  Dashboard
                </h1>
                <p className="text-white/90 drop-shadow-md">Vue d'ensemble de votre activité</p>
              </div>
              <UserAccountButton variant="inline" />
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
  const {
    totalRevenue,
    activeChantiers,
    pendingQuotes,
    conversionRate,
    revenueEvolution,
    conversionEvolution,
    loading,
    error,
  } = useDashboardMetrics();

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
          change={totalRevenue > 0 ? "Paiements enregistrés" : "Aucun paiement enregistré"}
          icon={Euro}
          delay={0.1}
        />
        <MetricCard
          title="Chantiers Actifs"
          value={activeChantiers.toString()}
          change={activeChantiers > 0 ? "En cours et planifiés" : "Aucun chantier actif"}
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
          title="Taux de Conversion"
          value={`${conversionRate}%`}
          change={conversionRate > 0 ? "Factures envoyées / devis envoyés" : "Devis ou factures envoyés"}
          icon={TrendingUp}
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
            <CardTitle className="text-white font-light">Taux de Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            {conversionEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={conversionEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.7)" />
                  <YAxis stroke="rgba(255, 255, 255, 0.7)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                  <Line type="monotone" dataKey="taux" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-white/60">
                Aucune donnée de conversion disponible
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
          <Button 
            className="w-full justify-start h-auto p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
            onClick={() => setLocation('/dashboard/ai-visualization')}
          >
            <Wand2 className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Estimation IA</div>
              <div className="text-xs opacity-70">Analyser un projet</div>
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

