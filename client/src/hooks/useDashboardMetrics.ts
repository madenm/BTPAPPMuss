import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useChantiers } from "@/context/ChantiersContext";
import { fetchQuotesForUser } from "@/lib/supabaseQuotes";
import { fetchRevenuesByPeriod, calculateTotalRevenue } from "@/lib/supabaseRevenues";
import { fetchInvoicesForUser } from "@/lib/supabaseInvoices";

export interface DashboardMetrics {
  totalRevenue: number;
  activeChantiers: number;
  pendingQuotes: number;
  conversionRate: number;
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

        // Calculer les chantiers actifs (depuis le contexte déjà chargé)
        const activeChantiers = chantiers.filter(
          (c) => c.statut === "en cours" || c.statut === "planifié",
        ).length;

        // Charger les devis
        const allQuotes = await fetchQuotesForUser(user.id);
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

        // Chiffre d'affaires total = somme des paiements enregistrés (table payments)
        const totalRevenue = await calculateTotalRevenue(user.id);

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
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        
        const revenueEvolution: Array<{ name: string; revenus: number }> = [];
        for (let i = 11; i >= 0; i--) {
          let year = currentYear;
          let month = currentMonth - i;
          
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
