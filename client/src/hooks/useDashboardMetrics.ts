import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useChantiers } from "@/context/ChantiersContext";
import { fetchQuotesForUser } from "@/lib/supabaseQuotes";
import { fetchRevenuesByPeriod } from "@/lib/supabaseRevenues";
import { fetchInvoicesForUser } from "@/lib/supabaseInvoices";

export interface DashboardMetrics {
  totalRevenue: number;
  activeChantiers: number;
  pendingQuotes: number;
  conversionRate: number;
  /** Montant restant à encaisser (somme des factures non soldées) pour compléter les factures */
  remainingToCollect: number;
  revenueEvolution: Array<{ name: string; revenus: number }>;
  conversionEvolution: Array<{ name: string; taux: number }>;
  loading: boolean;
  error: string | null;
}

export function useDashboardMetrics(): DashboardMetrics {
  const { user } = useAuth();
  const { chantiers } = useChantiers();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    activeChantiers: 0,
    pendingQuotes: 0,
    conversionRate: 0,
    remainingToCollect: 0,
    revenueEvolution: [],
    conversionEvolution: [],
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

        // Charger les devis
        const allQuotes = await fetchQuotesForUser(user.id);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDashboardMetrics.ts:loadMetrics',message:'loadMetrics run',data:{userId:user.id,allQuotesCount:allQuotes.length,chantiersLength:chantiers.length,timestamp:Date.now()},timestamp:Date.now(),hypothesisId:'H4,H5'})}).catch(()=>{});
        // #endregion
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

        // Taux de conversion = (factures envoyées / devis envoyés) * 100
        const devisEnvoyes = allQuotes.filter((q) => q.status === "envoyé").length;
        const invoices = await fetchInvoicesForUser(user.id);
        const facturesEnvoyees = invoices.filter((inv) =>
          ["envoyée", "payée", "partiellement_payée"].includes(inv.status),
        ).length;
        const conversionRate =
          devisEnvoyes > 0 ? Math.round((facturesEnvoyees / devisEnvoyes) * 100) : 0;

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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDashboardMetrics.ts:CA-calculation',message:'CA calc',data:{currentYear,currentMonth,acceptedCount:acceptedOrValide.length,includedCount:quotesAcceptedThisMonth.length,totalRevenue,acceptedQuotes:acceptedOrValide.map(q=>{const ds=q.accepted_at||q.updated_at||q.created_at;const d=ds?new Date(ds):null;return{id:q.id,status:q.status,total_ht:q.total_ht,accepted_at:q.accepted_at,updated_at:q.updated_at,created_at:q.created_at,parsedMonth:d?.getMonth(),parsedYear:d?.getFullYear(),included:d&&d.getFullYear()===currentYear&&d.getMonth()===currentMonth}})},timestamp:Date.now(),hypothesisId:'H1,H2,H3,H5'})}).catch(()=>{});
        // #endregion

        // Charger l'évolution des revenus (par mois)
        const revenuesByMonth = await fetchRevenuesByPeriod(user.id, "month");
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

        // Évolution du taux de conversion par semaine (factures envoyées / devis envoyés)
        const conversionEvolution: Array<{ name: string; taux: number }> = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() - (i * 7));
          const weekDevisEnvoyes = allQuotes.filter((q) => {
            if (q.status !== "envoyé") return false;
            const d = new Date(q.created_at);
            return d >= weekStart && d <= weekEnd;
          }).length;
          const weekFacturesEnvoyees = invoices.filter((inv) => {
            if (!["envoyée", "payée", "partiellement_payée"].includes(inv.status)) return false;
            const d = new Date(inv.invoice_date || inv.created_at);
            return d >= weekStart && d <= weekEnd;
          }).length;
          conversionEvolution.push({
            name: `Sem ${4 - i}`,
            taux: weekDevisEnvoyes > 0 ? Math.round((weekFacturesEnvoyees / weekDevisEnvoyes) * 100) : 0,
          });
        }

        setMetrics({
          totalRevenue,
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
