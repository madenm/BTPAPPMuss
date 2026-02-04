import { supabase } from "./supabaseClient";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  subItems?: InvoiceSubItem[];
}

export interface InvoiceSubItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SupabaseInvoice {
  id: string;
  user_id: string;
  invoice_number: string;
  quote_id: string | null;
  chantier_id: string | null;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  items: InvoiceItem[];
  subtotal_ht: number;
  tva_amount: number;
  total_ttc: number;
  status: "brouillon" | "envoyée" | "payée" | "annulée" | "partiellement_payée";
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabasePayment {
  id: string;
  invoice_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  payment_method: "virement" | "cheque" | "especes" | "carte" | "autre";
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithPayments extends SupabaseInvoice {
  payments?: SupabasePayment[];
  paidAmount?: number;
  remainingAmount?: number;
}

export type NewInvoicePayload = {
  quote_id?: string | null;
  chantier_id?: string | null;
  client_id?: string | null;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  items: InvoiceItem[];
  subtotal_ht: number;
  tva_amount: number;
  total_ttc: number;
  status?: "brouillon" | "envoyée" | "payée" | "annulée" | "partiellement_payée";
  notes?: string | null;
};

export type NewPaymentPayload = {
  amount: number;
  payment_date: string;
  payment_method: "virement" | "cheque" | "especes" | "carte" | "autre";
  reference?: string | null;
  notes?: string | null;
};

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Calcule le statut correct d'une facture en fonction des paiements réels.
 * Utilise une tolérance de 0.01€ pour les erreurs de précision décimale.
 */
function calculateInvoiceStatus(
  paidAmount: number,
  totalTtc: number,
  currentStatus: SupabaseInvoice["status"]
): SupabaseInvoice["status"] {
  // Si la facture est annulée, garder ce statut
  if (currentStatus === "annulée") {
    return "annulée";
  }

  // Arrondir à 2 décimales pour éviter les problèmes de précision
  const paid = Math.round(paidAmount * 100) / 100;
  const total = Math.round(totalTtc * 100) / 100;

  // Tolérance de 0.01€ pour considérer comme payée
  if (paid >= total - 0.01) {
    return "payée";
  } else if (paid > 0) {
    return "partiellement_payée";
  } else {
    // Si aucun paiement, garder le statut actuel s'il est envoyée, sinon brouillon
    return currentStatus === "envoyée" ? "envoyée" : "brouillon";
  }
}

export async function fetchInvoicesForUser(
  userId: string,
  filters?: {
    clientId?: string;
    chantierId?: string;
    status?: string;
    year?: number;
  }
): Promise<InvoiceWithPayments[]> {
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }
  if (filters?.chantierId) {
    query = query.eq("chantier_id", filters.chantierId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.year) {
    const yearStart = `${filters.year}-01-01`;
    const yearEnd = `${filters.year}-12-31`;
    query = query.gte("invoice_date", yearStart).lte("invoice_date", yearEnd);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching invoices:", error);
    // Si la table n'existe pas encore, retourner un tableau vide au lieu de throw
    if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
      console.warn("Table 'invoices' does not exist yet. Please run the SQL script supabase_invoices_tables.sql in Supabase.");
      return [];
    }
    throw error;
  }

  const invoices = (data ?? []) as SupabaseInvoice[];

  // Charger les paiements pour chaque facture et calculer les montants
  const invoicesWithPayments: InvoiceWithPayments[] = await Promise.all(
    invoices.map(async (invoice) => {
      const payments = await fetchPaymentsForInvoice(userId, invoice.id);
      const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const correctStatus = calculateInvoiceStatus(paidAmount, invoice.total_ttc, invoice.status);
      return {
        ...invoice,
        status: correctStatus,
        payments,
        paidAmount,
        remainingAmount: invoice.total_ttc - paidAmount,
      };
    })
  );

  return invoicesWithPayments;
}

export async function fetchInvoiceById(
  userId: string,
  invoiceId: string
): Promise<InvoiceWithPayments | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
      console.warn("Table 'invoices' does not exist yet. Please run the SQL script supabase_invoices_tables.sql in Supabase.");
      return null;
    }
    if (error?.code !== "PGRST116") {
      console.error("Error fetching invoice by id:", error);
    }
    return null;
  }

  const invoice = data as SupabaseInvoice;
  const payments = await fetchPaymentsForInvoice(userId, invoiceId);
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const correctStatus = calculateInvoiceStatus(paidAmount, invoice.total_ttc, invoice.status);

  return {
    ...invoice,
    status: correctStatus,
    payments,
    paidAmount,
    remainingAmount: invoice.total_ttc - paidAmount,
  };
}

export async function fetchPaymentsForInvoice(
  userId: string,
  invoiceId: string
): Promise<SupabasePayment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId)
    .order("payment_date", { ascending: false });

  if (error) {
    console.error("Error fetching payments:", error);
    // Si la table n'existe pas encore, retourner un tableau vide
    if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
      console.warn("Table 'payments' does not exist yet. Please run the SQL script supabase_invoices_tables.sql in Supabase.");
      return [];
    }
    return [];
  }

  return (data ?? []) as SupabasePayment[];
}

export async function generateInvoiceNumber(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_invoice_number", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error generating invoice number:", error);
    if (error.code === "42883" || error.message?.includes("function") || error.message?.includes("does not exist")) {
      throw new Error("La fonction generate_invoice_number n'existe pas. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  return data as string;
}

export async function insertInvoice(
  userId: string,
  payload: NewInvoicePayload
): Promise<SupabaseInvoice> {
  // Générer le numéro de facture
  const invoiceNumber = await generateInvoiceNumber(userId);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      quote_id: payload.quote_id ?? null,
      chantier_id: payload.chantier_id ?? null,
      client_id: payload.client_id ?? null,
      client_name: payload.client_name,
      client_email: payload.client_email ?? null,
      client_phone: payload.client_phone ?? null,
      client_address: payload.client_address ?? null,
      invoice_date: payload.invoice_date,
      due_date: payload.due_date,
      payment_terms: payload.payment_terms,
      items: payload.items,
      subtotal_ht: payload.subtotal_ht,
      tva_amount: payload.tva_amount,
      total_ttc: payload.total_ttc,
      status: payload.status ?? "brouillon",
      notes: payload.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting invoice:", error);
    if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
      throw new Error("La table 'invoices' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  return data as SupabaseInvoice;
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  payload: Partial<NewInvoicePayload>
): Promise<SupabaseInvoice> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (payload.chantier_id !== undefined) updateData.chantier_id = payload.chantier_id ?? null;
  if (payload.client_id !== undefined) updateData.client_id = payload.client_id ?? null;
  if (payload.client_name !== undefined) updateData.client_name = payload.client_name;
  if (payload.client_email !== undefined) updateData.client_email = payload.client_email ?? null;
  if (payload.client_phone !== undefined) updateData.client_phone = payload.client_phone ?? null;
  if (payload.client_address !== undefined) updateData.client_address = payload.client_address ?? null;
  if (payload.invoice_date !== undefined) updateData.invoice_date = payload.invoice_date;
  if (payload.due_date !== undefined) updateData.due_date = payload.due_date;
  if (payload.payment_terms !== undefined) updateData.payment_terms = payload.payment_terms;
  if (payload.items !== undefined) updateData.items = payload.items;
  if (payload.subtotal_ht !== undefined) updateData.subtotal_ht = payload.subtotal_ht;
  if (payload.tva_amount !== undefined) updateData.tva_amount = payload.tva_amount;
  if (payload.total_ttc !== undefined) updateData.total_ttc = payload.total_ttc;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.notes !== undefined) updateData.notes = payload.notes ?? null;

  const { data, error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error updating invoice:", error);
    if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
      throw new Error("La table 'invoices' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  return data as SupabaseInvoice;
}

export async function cancelInvoice(
  userId: string,
  invoiceId: string
): Promise<SupabaseInvoice> {
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "annulée",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error canceling invoice:", error);
    if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
      throw new Error("La table 'invoices' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  return data as SupabaseInvoice;
}

export async function insertPayment(
  userId: string,
  invoiceId: string,
  payload: NewPaymentPayload
): Promise<SupabasePayment> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      amount: payload.amount,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      reference: payload.reference ?? null,
      notes: payload.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error inserting payment:", error);
    if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
      throw new Error("La table 'payments' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  // Mettre à jour le statut de la facture
  const invoice = await fetchInvoiceById(userId, invoiceId);
  if (invoice) {
    const totalPaid = (invoice.payments ?? []).reduce((sum, p) => sum + p.amount, 0) + payload.amount;
    const newStatus = calculateInvoiceStatus(totalPaid, invoice.total_ttc, invoice.status);

    if (newStatus !== invoice.status) {
      await updateInvoice(userId, invoiceId, { status: newStatus });
    }
  }

  return data as SupabasePayment;
}

export async function deletePayment(
  userId: string,
  paymentId: string
): Promise<void> {
  // Récupérer le paiement pour obtenir l'invoice_id
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !payment) {
    console.error("Error fetching payment:", fetchError);
    if (fetchError?.code === "PGRST205" || fetchError?.message?.includes("Could not find the table")) {
      throw new Error("La table 'payments' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw fetchError;
  }

  // Supprimer le paiement
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting payment:", error);
    if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
      throw new Error("La table 'payments' n'existe pas encore. Veuillez exécuter le script SQL supabase_invoices_tables.sql dans Supabase.");
    }
    throw error;
  }

  // Recalculer le statut de la facture
  const invoice = await fetchInvoiceById(userId, payment.invoice_id);
  if (invoice) {
    const totalPaid = (invoice.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
    const newStatus = calculateInvoiceStatus(totalPaid, invoice.total_ttc, invoice.status);

    if (newStatus !== invoice.status) {
      await updateInvoice(userId, invoice.id, { status: newStatus });
    }
  }
}

export async function fetchInvoiceStats(userId: string): Promise<{
  totalRevenue: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
}> {
  const invoices = await fetchInvoicesForUser(userId);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total_ttc, 0);
  const paidAmount = invoices
    .filter((inv) => inv.status === "payée")
    .reduce((sum, inv) => sum + inv.total_ttc, 0);
  const partiallyPaidAmount = invoices
    .filter((inv) => inv.status === "partiellement_payée")
    .reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0);
  const unpaidAmount = invoices
    .filter((inv) => inv.status === "envoyée" || inv.status === "brouillon")
    .reduce((sum, inv) => sum + inv.total_ttc, 0);

  const today = new Date();
  const overdueAmount = invoices
    .filter((inv) => {
      const dueDate = new Date(inv.due_date);
      return (
        dueDate < today &&
        (inv.status === "envoyée" || inv.status === "partiellement_payée") &&
        (inv.remainingAmount ?? inv.total_ttc) > 0
      );
    })
    .reduce((sum, inv) => sum + (inv.remainingAmount ?? inv.total_ttc), 0);

  const invoiceCount = invoices.length;
  const paidCount = invoices.filter((inv) => inv.status === "payée").length;
  const unpaidCount = invoices.filter(
    (inv) => inv.status === "envoyée" || inv.status === "brouillon" || inv.status === "partiellement_payée"
  ).length;

  return {
    totalRevenue,
    paidAmount: paidAmount + partiallyPaidAmount,
    unpaidAmount,
    overdueAmount,
    invoiceCount,
    paidCount,
    unpaidCount,
  };
}
