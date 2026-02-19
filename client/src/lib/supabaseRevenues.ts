import { supabase, isSupabaseTableMissing } from "./supabaseClient";

export interface SupabasePayment {
  id: string;
  user_id: string;
  quote_id: string | null;
  chantier_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
}

export type NewRevenuePayload = {
  quote_id?: string;
  chantier_id?: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  description?: string;
};

export interface PeriodRevenue {
  period: string;
  revenue: number;
  month?: number;
  year?: number;
  week?: number;
}

export async function fetchRevenuesForUser(
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<SupabasePayment[]> {
  let query = supabase
    .from<SupabasePayment>("payments")
    .select("*")
    .eq("user_id", userId)
    .order("payment_date", { ascending: false });

  if (startDate) {
    query = query.gte("payment_date", startDate.toISOString().split("T")[0]);
  }

  if (endDate) {
    query = query.lte("payment_date", endDate.toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching revenues:", error);
    throw error;
  }

  return data ?? [];
}

export async function insertRevenue(
  userId: string,
  payload: NewRevenuePayload,
): Promise<SupabasePayment> {
  const { data, error } = await supabase
    .from<SupabasePayment>("payments")
    .insert({
      user_id: userId,
      quote_id: payload.quote_id ?? null,
      chantier_id: payload.chantier_id ?? null,
      amount: payload.amount,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method ?? null,
      description: payload.description ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting revenue:", error);
    throw error;
  }

  return data;
}

export async function calculateTotalRevenue(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("user_id", userId);

  if (error) {
    if (isSupabaseTableMissing(error)) return 0;
    console.error("Error calculating total revenue:", error);
    throw error;
  }

  return (data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export async function fetchRevenuesByPeriod(
  userId: string,
  period: "month" | "week" = "month",
): Promise<PeriodRevenue[]> {
  const { data, error } = await supabase
    .from<SupabasePayment>("payments")
    .select("amount, payment_date")
    .eq("user_id", userId)
    .order("payment_date", { ascending: true });

  if (error) {
    if (isSupabaseTableMissing(error)) return [];
    console.error("Error fetching revenues by period:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Grouper par période
  const grouped = new Map<string, number>();

  for (const payment of data) {
    const date = new Date(payment.payment_date);
    let key: string;

    if (period === "month") {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      key = `${year}-${String(month).padStart(2, "0")}`;
    } else {
      // Semaine
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      key = `${year}-W${String(week).padStart(2, "0")}`;
    }

    const current = grouped.get(key) ?? 0;
    grouped.set(key, current + Number(payment.amount));
  }

  // Convertir en tableau et trier
  const result: PeriodRevenue[] = Array.from(grouped.entries()).map(
    ([period, revenue]) => {
      const parts = period.split("-");
      if (period.includes("W")) {
        return {
          period,
          revenue,
          year: parseInt(parts[0]),
          week: parseInt(parts[1].replace("W", "")),
        };
      } else {
        return {
          period,
          revenue,
          year: parseInt(parts[0]),
          month: parseInt(parts[1]),
        };
      }
    },
  );

  return result.sort((a, b) => {
    if (a.year !== b.year) return a.year! - b.year!;
    if (a.month && b.month) return a.month - b.month;
    if (a.week && b.week) return a.week - b.week;
    return 0;
  });
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
