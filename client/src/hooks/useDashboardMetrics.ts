import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useChantiers } from "@/context/ChantiersContext";
import { fetchQuotesForUser } from "@/lib/supabaseQuotes";
import { fetchRevenuesByPeriod } from "@/lib/supabaseRevenues";
import { fetchInvoicesForUser, type InvoiceWithPayments } from "@/lib/supabaseInvoices";

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  icon: 'quote' | 'invoice' | 'project' | 'note';
  title: string;
  detail: string;
  link?: string;
}

export interface RecentActivity {
  id: string;
  type: 'quote' | 'invoice' | 'project';
  action: string;
  label: string;
  date: Date;
  amount?: number;
}

export interface DashboardMetrics {
  totalRevenue: number;
  previousMonthRevenue: number;
  activeChantiers: number;
  pendingQuotes: number;
  conversionRate: number;
  remainingToCollect: number;
  revenueEvolution: Array<{ name: string; revenus: number }>;
  conversionEvolution: Array<{ name: string; taux: number }>;
  alerts: DashboardAlert[];
  recentActivity: RecentActivity[];
  overdueInvoicesCount: number;
  expiringQuotesCount: number;
  lateProjectsCount: number;
  pendingInvoices: InvoiceWithPayments[];
  loading: boolean;
  error: string | null;
}

export function useDashboardMetrics(): DashboardMetrics {
  const { user } = useAuth();
  const { chantiers } = useChantiers();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    previousMonthRevenue: 0,
    activeChantiers: 0,
    pendingQuotes: 0,
    conversionRate: 0,
    remainingToCollect: 0,
    revenueEvolution: [],
    conversionEvolution: [],
    alerts: [],
    recentActivity: [],
    overdueInvoicesCount: 0,
    expiringQuotesCount: 0,
    lateProjectsCount: 0,
    pendingInvoices: [],
    loading: true,
    error: null,
  });

  const loadingRef = useRef(false); // Protection contre les appels multiples

  useEffect(() => {
    const loadMetrics = async () => {
      if (!user) {
        setMetrics((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Protection contre les appels multiples
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      try {
        setMetrics((prev) => ({ ...prev, loading: true, error: null }));

        // Chantiers actifs = uniquement ceux dont le statut est "en cours"
        const activeChantiers = chantiers.filter(
          (c) => c.statut === "en cours",
        ).length;

        // Charger les devis (résilient: en cas d'erreur Supabase/RLS on utilise [])
        let allQuotes: Awaited<ReturnType<typeof fetchQuotesForUser>> = [];
        try {
          allQuotes = await fetchQuotesForUser(user.id);
        } catch (e) {
          console.warn("fetchQuotesForUser failed, using empty list:", e);
        }
        // Devis en attente = au plus un par chantier (chantiers ayant au moins un devis envoyé/brouillon)
        const pendingStatuses = ["envoyé", "brouillon"];
        const pendingQuotesList = allQuotes.filter((q) =>
          pendingStatuses.includes(q.status),
        );
        const chantierIdsWithPending = new Set(
          pendingQuotesList.map((q) => q.chantier_id).filter(Boolean) as string[],
        );
        const pendingWithoutChantier = pendingQuotesList.filter(
          (q) => !q.chantier_id,
        ).length;
        const pendingQuotes =
          chantierIdsWithPending.size + pendingWithoutChantier;

        // Taux de conversion = devis signés / total devis ayant reçu une réponse
        // Numérateur : devis acceptés ou validés (= signés)
        // Dénominateur : tous les devis qui ont dépassé le stade brouillon (envoyé + accepté + validé + refusé + expiré)
        const resolvedStatuses = ["envoyé", "accepté", "validé", "refusé", "expiré"];
        const devisResolved = allQuotes.filter((q) => resolvedStatuses.includes(q.status)).length;
        const devisConverted = allQuotes.filter((q) => q.status === "accepté" || q.status === "validé").length;
        let invoices: Awaited<ReturnType<typeof fetchInvoicesForUser>> = [];
        try {
          invoices = await fetchInvoicesForUser(user.id);
        } catch (e) {
          console.warn("fetchInvoicesForUser failed, using empty list:", e);
        }
        const conversionRate =
          devisResolved > 0 ? Math.round((devisConverted / devisResolved) * 100) : 0;

        // Factures en attente de paiement (non payées, non annulées, non brouillon)
        const pendingInvoices = invoices
          .filter((inv) => inv.status !== "payée" && inv.status !== "annulée" && inv.status !== "brouillon")
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        // Montant restant à encaisser = somme (total_ttc - payé) pour les factures non annulées
        const remainingToCollect = invoices
          .filter((inv) => inv.status !== "annulée")
          .reduce((sum, inv) => sum + Math.max(0, (inv.total_ttc ?? 0) - (inv.paidAmount ?? 0)), 0);

        // Chiffre d'affaires = somme des devis acceptés/validés ce mois-ci (total HT)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const acceptedOrValide = allQuotes.filter((q) => q.status === "accepté" || q.status === "validé");
        const quotesAcceptedThisMonth = allQuotes.filter((q) => {
          if (q.status !== "accepté" && q.status !== "validé") return false;
          const dateStr = q.accepted_at || q.updated_at || q.created_at;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
        const totalRevenue = quotesAcceptedThisMonth.reduce(
          (sum, q) => sum + (Number(q.total_ht) || 0),
          0,
        );

        // Charger l'évolution des revenus (par mois) (résilient: table payments peut être absente)
        let revenuesByMonth: Awaited<ReturnType<typeof fetchRevenuesByPeriod>> = [];
        try {
          revenuesByMonth = await fetchRevenuesByPeriod(user.id, "month");
        } catch (e) {
          console.warn("fetchRevenuesByPeriod failed, using empty list:", e);
        }
        const monthNames = [
          "Jan",
          "Fév",
          "Mar",
          "Avr",
          "Mai",
          "Jun",
          "Jul",
          "Aoû",
          "Sep",
          "Oct",
          "Nov",
          "Déc",
        ];
        
        // Créer un Map des revenus par mois/année pour accès rapide
        const revenueMap = new Map<string, number>();
        revenuesByMonth.forEach((r) => {
          if (r.year && r.month) {
            const key = `${r.year}-${r.month}`;
            revenueMap.set(key, r.revenue);
          }
        });
        
        // Générer les 12 derniers mois (mois courant inclus)
        const currentMonth1Based = now.getMonth() + 1; // 1-12
        
        const revenueEvolution: Array<{ name: string; revenus: number }> = [];
        for (let i = 11; i >= 0; i--) {
          let year = currentYear;
          let month = currentMonth1Based - i;
          
          // Ajuster l'année si on dépasse janvier
          while (month <= 0) {
            month += 12;
            year -= 1;
          }
          while (month > 12) {
            month -= 12;
            year += 1;
          }
          
          const key = `${year}-${month}`;
          const revenue = revenueMap.get(key) || 0;
          revenueEvolution.push({
            name: `${monthNames[month - 1]} ${year}`,
            revenus: Math.round(revenue),
          });
        }

        // Évolution du taux de conversion par semaine
        // Pour chaque semaine : devis signés (accepté/validé) créés cette semaine / devis résolus créés cette semaine
        const conversionEvolution: Array<{ name: string; taux: number }> = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() - (i * 7));
          const weekResolved = allQuotes.filter((q) => {
            if (!resolvedStatuses.includes(q.status)) return false;
            const d = new Date(q.created_at);
            return d >= weekStart && d <= weekEnd;
          }).length;
          const weekConverted = allQuotes.filter((q) => {
            if (q.status !== "accepté" && q.status !== "validé") return false;
            const d = new Date(q.created_at);
            return d >= weekStart && d <= weekEnd;
          }).length;
          conversionEvolution.push({
            name: `Sem ${4 - i}`,
            taux: weekResolved > 0 ? Math.round((weekConverted / weekResolved) * 100) : 0,
          });
        }

        // Previous month revenue for trend
        const prevMonth = currentMonth1Based - 1 <= 0 ? 12 : currentMonth1Based - 1;
        const prevYear = currentMonth1Based - 1 <= 0 ? currentYear - 1 : currentYear;
        const previousMonthRevenue = revenueMap.get(`${prevYear}-${prevMonth}`) || 0;

        // --- ALERTS ---
        const alerts: DashboardAlert[] = [];
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

        // Devis qui expirent dans les 7 jours
        const expiringQuotes = allQuotes.filter((q) => {
          if (q.status !== "envoyé" && q.status !== "brouillon") return false;
          const created = new Date(q.created_at);
          const expiry = new Date(created.getTime() + (q.validity_days ?? 30) * 86400000);
          return expiry > now && expiry <= sevenDaysFromNow;
        });
        if (expiringQuotes.length > 0) {
          alerts.push({
            id: "expiring-quotes",
            type: "warning",
            icon: "quote",
            title: `${expiringQuotes.length} devis expire${expiringQuotes.length > 1 ? "nt" : ""} bientôt`,
            detail: `Dans les 7 prochains jours`,
            link: "/dashboard/quotes",
          });
        }

        // Factures impayées > 30 jours
        const overdueInvoices = invoices.filter((inv) => {
          if (inv.status === "payée" || inv.status === "annulée") return false;
          const due = new Date(inv.due_date);
          return due < now;
        });
        if (overdueInvoices.length > 0) {
          const totalOverdue = overdueInvoices.reduce((s, inv) => s + Math.max(0, (inv.total_ttc ?? 0) - (inv.paidAmount ?? 0)), 0);
          alerts.push({
            id: "overdue-invoices",
            type: "danger",
            icon: "invoice",
            title: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard de paiement`,
            detail: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(totalOverdue) + " à encaisser",
            link: "/dashboard/invoices",
          });
        }

        // Chantiers en retard
        const lateProjects = chantiers.filter((c) => {
          if (!c.dateFin || c.statut === "terminé") return false;
          return c.dateFin.slice(0, 10) < now.toISOString().slice(0, 10);
        });
        if (lateProjects.length > 0) {
          alerts.push({
            id: "late-projects",
            type: "danger",
            icon: "project",
            title: `${lateProjects.length} projet${lateProjects.length > 1 ? "s" : ""} en retard`,
            detail: lateProjects.slice(0, 2).map((c) => c.nom).join(", ") + (lateProjects.length > 2 ? "..." : ""),
            link: "/dashboard/projects",
          });
        }

        // --- RECENT ACTIVITY (from quotes + invoices, sorted by date) ---
        const recentActivity: RecentActivity[] = [];
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

        for (const q of allQuotes) {
          const d = new Date(q.updated_at || q.created_at);
          if (d < thirtyDaysAgo) continue;
          if (q.status === "accepté" || q.status === "validé") {
            recentActivity.push({
              id: `q-${q.id}`,
              type: "quote",
              action: q.status === "validé" ? "Devis validé" : "Devis accepté",
              label: q.client_name || "Client",
              date: d,
              amount: q.total_ttc,
            });
          } else if (q.status === "envoyé") {
            recentActivity.push({
              id: `q-${q.id}`,
              type: "quote",
              action: "Devis envoyé",
              label: q.client_name || "Client",
              date: d,
            });
          }
        }

        for (const inv of invoices) {
          const d = new Date(inv.updated_at || inv.created_at);
          if (d < thirtyDaysAgo) continue;
          if (inv.status === "payée") {
            recentActivity.push({
              id: `i-${inv.id}`,
              type: "invoice",
              action: "Facture payée",
              label: inv.client_name || "Client",
              date: d,
              amount: inv.total_ttc,
            });
          } else if (inv.status === "envoyée") {
            recentActivity.push({
              id: `i-${inv.id}`,
              type: "invoice",
              action: "Facture envoyée",
              label: inv.client_name || "Client",
              date: d,
              amount: inv.total_ttc,
            });
          }
        }

        recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime());

        setMetrics({
          totalRevenue,
          previousMonthRevenue,
          activeChantiers,
          pendingQuotes,
          conversionRate,
          remainingToCollect,
          revenueEvolution: revenueEvolution.length > 0 ? revenueEvolution : [
            { name: "Jan", revenus: 0 },
            { name: "Fév", revenus: 0 },
            { name: "Mar", revenus: 0 },
            { name: "Avr", revenus: 0 },
            { name: "Mai", revenus: 0 },
            { name: "Jun", revenus: 0 },
          ],
          conversionEvolution: conversionEvolution.length > 0 ? conversionEvolution : [
            { name: "Sem 1", taux: 0 },
            { name: "Sem 2", taux: 0 },
            { name: "Sem 3", taux: 0 },
            { name: "Sem 4", taux: 0 },
          ],
          alerts,
          recentActivity: recentActivity.slice(0, 10),
          overdueInvoicesCount: overdueInvoices.length,
          expiringQuotesCount: expiringQuotes.length,
          lateProjectsCount: lateProjects.length,
          pendingInvoices,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error("Error loading dashboard metrics:", error);
        setMetrics((prev) => ({
          ...prev,
          loading: false,
          error: "Impossible de charger les métriques.",
        }));
      } finally {
        loadingRef.current = false;
      }
    };

    void loadMetrics();
  }, [user?.id, chantiers.length]); // Utiliser user.id et chantiers.length pour éviter les re-renders inutiles

  return metrics;
}
