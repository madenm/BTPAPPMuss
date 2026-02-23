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
  TrendingDown,
  Plus,
  Users,
  Clock,
  Calendar,
  Wallet,
  StickyNote,
  AlertTriangle,
  Bell,
  Receipt,
  ArrowRight,
  Activity,
  BarChart3,
  ChevronRight,
} from 'lucide-react'
import { UserAccountButton } from '@/components/UserAccountButton'
import { useLocation } from 'wouter'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardMetrics, type DashboardAlert, type RecentActivity } from '@/hooks/useDashboardMetrics'
import { useChantiers } from '@/context/ChantiersContext'
import { useUserSettings } from '@/context/UserSettingsContext'
import { fetchPlanningNotesForRange, type PlanningNote } from '@/lib/supabasePlanningNotes'
import { toNoteDateKey } from '@/lib/planningUtils'

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatRelativeDate(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
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
              <OverviewTab />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function OverviewTab() {
  const [, setLocation] = useLocation();
  const { chantiers } = useChantiers();
  const { profile } = useUserSettings();
  const [planningNotes, setPlanningNotes] = useState<PlanningNote[]>([]);

  const todayKey = toNoteDateKey(new Date());
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = toNoteDateKey(weekEnd);

  useEffect(() => {
    let cancelled = false;
    fetchPlanningNotesForRange(todayKey, weekEndKey).then((notes) => {
      if (!cancelled) setPlanningNotes(notes.filter((n) => n.content?.trim()));
    });
    return () => { cancelled = true; };
  }, [todayKey, weekEndKey]);

  const {
    totalRevenue,
    previousMonthRevenue,
    activeChantiers,
    pendingQuotes,
    conversionRate,
    remainingToCollect,
    revenueEvolution,
    conversionEvolution,
    alerts,
    recentActivity,
    overdueInvoicesCount,
    expiringQuotesCount,
    lateProjectsCount,
    loading,
    error,
  } = useDashboardMetrics();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(amount);

  const revenueTrend = previousMonthRevenue > 0
    ? Math.round(((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
    : totalRevenue > 0 ? 100 : 0;

  const userName = profile?.full_name?.split(" ")[0] || "";

  // Merge planning notes into alerts
  const allAlerts = useMemo(() => {
    const merged: DashboardAlert[] = [...alerts];
    for (const note of planningNotes) {
      const dateLabel = note.note_date === todayKey
        ? "Aujourd'hui"
        : new Date(note.note_date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
      merged.push({
        id: `note-${note.id}`,
        type: "info",
        icon: "note",
        title: `Note : ${dateLabel}`,
        detail: note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content,
        link: "/dashboard/planning",
      });
    }
    return merged;
  }, [alerts, planningNotes, todayKey]);

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
      {/* Welcome Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 w-full sm:flex-1 pl-20">
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white mb-1 drop-shadow-lg sm:truncate">
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-white/70 drop-shadow-md text-sm sm:text-base">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto">
          <UserAccountButton variant="inline" />
        </div>
      </div>

      {/* Alerts Section */}
      {allAlerts.length > 0 && (
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-light flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-amber-400" />
              Alertes & rappels
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/50 text-xs ml-1">{allAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  alert.type === "danger"
                    ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/20"
                    : alert.type === "warning"
                      ? "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                      : "bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20"
                }`}
                onClick={() => alert.link && setLocation(alert.link)}
              >
                <div className={`mt-0.5 shrink-0 ${
                  alert.type === "danger" ? "text-red-400" : alert.type === "warning" ? "text-amber-400" : "text-blue-400"
                }`}>
                  {alert.icon === "quote" && <FileText className="h-4 w-4" />}
                  {alert.icon === "invoice" && <Receipt className="h-4 w-4" />}
                  {alert.icon === "project" && <Building className="h-4 w-4" />}
                  {alert.icon === "note" && <StickyNote className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="text-xs text-white/60 truncate">{alert.detail}</p>
                </div>
                {alert.link && <ChevronRight className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard
          title="CA du mois"
          value={formatCurrency(totalRevenue)}
          trend={revenueTrend}
          icon={Euro}
          onClick={() => setLocation("/dashboard/invoices")}
        />
        <KpiCard
          title="Chantiers actifs"
          value={activeChantiers.toString()}
          subtitle={lateProjectsCount > 0 ? `${lateProjectsCount} en retard` : undefined}
          subtitleColor={lateProjectsCount > 0 ? "text-red-400" : undefined}
          icon={Building}
          onClick={() => setLocation("/dashboard/projects")}
        />
        <KpiCard
          title="Devis en attente"
          value={pendingQuotes.toString()}
          subtitle={expiringQuotesCount > 0 ? `${expiringQuotesCount} expire${expiringQuotesCount > 1 ? "nt" : ""} bientôt` : undefined}
          subtitleColor="text-amber-400"
          icon={FileText}
          onClick={() => setLocation("/dashboard/quotes")}
        />
        <KpiCard
          title="À encaisser"
          value={formatCurrency(remainingToCollect)}
          subtitle={overdueInvoicesCount > 0 ? `${overdueInvoicesCount} en retard` : undefined}
          subtitleColor="text-red-400"
          icon={Wallet}
          onClick={() => setLocation("/dashboard/invoices")}
        />
        <KpiCard
          title="Taux conversion"
          value={`${conversionRate}%`}
          icon={BarChart3}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-light text-base">Évolution des Revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueEvolution}>
                  <defs>
                    <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fontSize: 11 }}
                    domain={[0, (dataMax: number) => {
                      if (!dataMax || dataMax === 0) return 1000;
                      const rounded = Math.ceil(dataMax * 1.2);
                      const magnitude = Math.pow(10, Math.floor(Math.log10(rounded)));
                      return Math.ceil(rounded / magnitude) * magnitude;
                    }]}
                    tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v).toString()}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff", fontSize: 13 }}
                    formatter={(value: number) => [new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(value), "Revenus"]}
                  />
                  <Area type="monotone" dataKey="revenus" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenus)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-white/50 text-sm">
                Aucune donnée de revenus
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Chart */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-light text-base">Taux de Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            {conversionEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={conversionEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff", fontSize: 13 }}
                    formatter={(value: number) => [`${value}%`, "Taux"]}
                  />
                  <Line type="monotone" dataKey="taux" stroke="#34d399" strokeWidth={2} dot={{ r: 4, fill: "#34d399" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-white/50 text-sm">
                Pas encore de données
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity + Contextual Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-light text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-400" />
              Dernière activité
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-white/50 text-sm">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune activité récente</p>
                  <p className="text-xs mt-1">Les devis et factures apparaîtront ici</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === "quote" ? "bg-violet-500/20 text-violet-400" :
                      item.type === "invoice" ? "bg-green-500/20 text-green-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {item.type === "quote" && <FileText className="h-3.5 w-3.5" />}
                      {item.type === "invoice" && <Receipt className="h-3.5 w-3.5" />}
                      {item.type === "project" && <Building className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">{item.action}</span>
                        <span className="text-white/60"> — {item.label}</span>
                      </p>
                    </div>
                    {item.amount != null && (
                      <span className="text-sm font-medium text-white/80 shrink-0">
                        {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(item.amount)}
                      </span>
                    )}
                    <span className="text-xs text-white/40 shrink-0 hidden sm:block">
                      {formatRelativeDate(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contextual Actions */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-light text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingQuotes > 0 && (
              <ContextualAction
                icon={FileText}
                label={`${pendingQuotes} devis en attente`}
                action="Voir"
                color="violet"
                onClick={() => setLocation("/dashboard/quotes")}
              />
            )}
            {overdueInvoicesCount > 0 && (
              <ContextualAction
                icon={Receipt}
                label={`${overdueInvoicesCount} facture${overdueInvoicesCount > 1 ? "s" : ""} impayée${overdueInvoicesCount > 1 ? "s" : ""}`}
                action="Relancer"
                color="red"
                onClick={() => setLocation("/dashboard/invoices")}
              />
            )}
            {lateProjectsCount > 0 && (
              <ContextualAction
                icon={AlertTriangle}
                label={`${lateProjectsCount} projet${lateProjectsCount > 1 ? "s" : ""} en retard`}
                action="Gérer"
                color="amber"
                onClick={() => setLocation("/dashboard/projects")}
              />
            )}

            <div className="border-t border-white/10 pt-3 mt-3 space-y-2">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Raccourcis</p>
              <QuickAction icon={Plus} label="Nouveau projet" onClick={() => setLocation("/dashboard/projects?openDialog=true")} />
              <QuickAction icon={FileText} label="Créer un devis" onClick={() => setLocation("/dashboard/quotes")} />
              <QuickAction icon={Receipt} label="Créer une facture" onClick={() => setLocation("/dashboard/invoices")} />
              <QuickAction icon={Calendar} label="Voir le planning" onClick={() => setLocation("/dashboard/planning")} />
              <QuickAction icon={Users} label="Gérer l'équipe" onClick={() => setLocation("/dashboard/team")} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  title,
  value,
  trend,
  subtitle,
  subtitleColor,
  icon: Icon,
  onClick,
  className = "",
}: {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
  subtitleColor?: string;
  icon: any;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card
      className={`bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl text-white ${onClick ? "cursor-pointer hover:bg-white/5 active:scale-[0.98]" : ""} transition-all ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm text-white/60 truncate">{title}</span>
          <Icon className="h-4 w-4 text-violet-400 shrink-0" />
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-light text-white truncate">{value}</div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend > 0 ? "text-green-400" : "text-red-400"}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend > 0 ? "+" : ""}{trend}% vs mois précédent
          </div>
        )}
        {subtitle && (
          <p className={`text-xs mt-1 ${subtitleColor || "text-white/50"}`}>{subtitle}</p>
        )}
        {!trend && !subtitle && <div className="h-4" />}
      </CardContent>
    </Card>
  )
}

function ContextualAction({
  icon: Icon,
  label,
  action,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  action: string;
  color: "violet" | "red" | "amber" | "green";
  onClick: () => void;
}) {
  const colors = {
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-300",
    red: "bg-red-500/10 border-red-500/20 text-red-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    green: "bg-green-500/10 border-green-500/20 text-green-300",
  };
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-white/5 ${colors[color]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left text-sm text-white">{label}</span>
      <span className="text-xs opacity-70">{action}</span>
      <ArrowRight className="h-3.5 w-3.5 opacity-50" />
    </button>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left text-sm">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-30" />
    </button>
  );
}
