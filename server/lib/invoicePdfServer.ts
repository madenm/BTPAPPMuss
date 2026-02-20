/**
 * Génération PDF facture côté serveur (pour envoi email sans envoyer le PDF dans le body).
 * Utilise pdf-lib pour éviter un body trop gros et la 404 Vercel.
 */
import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";

const MARGIN = 40;
const PAGE_W = 595.28;
const LINE = 14;

/** Renders a string safe for pdf-lib WinAnsi (e.g. U+202F narrow no-break space, €). */
function toWinAnsiSafe(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return Array.from(s)
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      if (code >= 32 && code <= 127) return c; // ASCII
      if (code >= 0xa0 && code <= 0xff) return c; // Latin-1 supplement
      if (code === 0x202f) return "\u0020"; // narrow no-break space → space
      if (code === 0x20ac) return " EUR";   // € → " EUR"
      return "\u0020"; // other (e.g. special quotes) → space
    })
    .join("");
}

function formatDate(dateStr: string): string {
  if (!dateStr || String(dateStr).trim() === "") return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

type InvoiceRow = {
  description?: string | null;
  unitPrice?: number;
  quantity?: number;
  total?: number;
  subItems?: { description?: string | null; quantity?: number; unitPrice?: number; total?: number }[];
};

type InvoiceForPdf = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  client_name?: string | null;
  client_address?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  items?: InvoiceRow[] | null;
  subtotal_ht?: number;
  tva_amount?: number;
  total_ttc?: number;
  payment_terms?: string | null;
};

type ProfileForPdf = {
  full_name?: string | null;
  company_address?: string | null;
  company_city_postal?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_siret?: string | null;
};

export async function generateInvoicePdfBuffer(
  invoice: InvoiceForPdf,
  profile: ProfileForPdf | null
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, 841.89]);
  let y = 841.89 - MARGIN;

  const companyName = profile?.full_name ?? "Nom de l'entreprise";
  const companyAddr = profile?.company_address ?? "";
  const companyCity = profile?.company_city_postal ?? "";

  page.drawText(toWinAnsiSafe("FACTURE"), { x: PAGE_W - MARGIN - 80, y, size: 16, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(`N° ${invoice.invoice_number ?? "—"}`), { x: PAGE_W - MARGIN - 80, y, size: 10, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe(`${companyCity || "—"}, le ${formatDate(invoice.invoice_date ?? new Date().toISOString())}`), {
    x: PAGE_W - MARGIN - 80,
    y,
    size: 9,
    font,
  });
  y -= LINE * 2;

  page.drawText(toWinAnsiSafe(companyName), { x: MARGIN, y, size: 10, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(companyAddr || "—"), { x: MARGIN, y, size: 9, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe(companyCity || "—"), { x: MARGIN, y, size: 9, font });
  page.drawText(toWinAnsiSafe("Facturé à"), { x: PAGE_W - MARGIN - 120, y, size: 9, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(profile?.company_phone ?? "—"), { x: MARGIN, y, size: 9, font });
  page.drawText(toWinAnsiSafe(invoice.client_name ?? "—"), { x: PAGE_W - MARGIN - 120, y, size: 9, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe(profile?.company_email ?? "—"), { x: MARGIN, y, size: 9, font });
  page.drawText(toWinAnsiSafe(invoice.client_address ?? "—"), { x: PAGE_W - MARGIN - 120, y, size: 9, font });
  y -= LINE * 2;

  page.drawText(toWinAnsiSafe(`Date d'émission: ${formatDate(invoice.invoice_date ?? "")}`), { x: MARGIN, y, size: 9, font });
  page.drawText(toWinAnsiSafe(`Date d'échéance: ${formatDate(invoice.due_date ?? "")}`), { x: MARGIN + 200, y, size: 9, font });
  y -= LINE * 2;

  page.drawText(toWinAnsiSafe("Description"), { x: MARGIN, y, size: 9, font: fontBold });
  page.drawText(toWinAnsiSafe("Montant HT"), { x: PAGE_W - MARGIN - 70, y, size: 9, font: fontBold });
  y -= LINE;

  let items: InvoiceRow[] = [];
  if (Array.isArray(invoice.items)) {
    items = invoice.items;
  } else if (invoice.items && typeof invoice.items === "string") {
    try {
      items = JSON.parse(invoice.items) as InvoiceRow[];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
  }
  for (const item of items) {
    const subItems = Array.isArray(item.subItems) ? item.subItems : [];
    if (subItems.length) {
      page.drawText(toWinAnsiSafe(item.description ?? "—"), { x: MARGIN, y, size: 9, font });
      const mainTotal = subItems.reduce((s, sub) => s + (sub.total ?? 0), 0);
      page.drawText(toWinAnsiSafe(formatEur(mainTotal)), { x: PAGE_W - MARGIN - 70, y, size: 9, font });
      y -= LINE;
      for (const sub of subItems) {
        page.drawText(toWinAnsiSafe(`  ${sub.description ?? "—"}`), { x: MARGIN, y, size: 8, font });
        page.drawText(toWinAnsiSafe(formatEur(sub.total ?? 0)), { x: PAGE_W - MARGIN - 70, y, size: 8, font });
        y -= LINE * 0.9;
      }
    } else {
      page.drawText(toWinAnsiSafe(item.description ?? "—"), { x: MARGIN, y, size: 9, font });
      page.drawText(toWinAnsiSafe(formatEur(item.total ?? 0)), { x: PAGE_W - MARGIN - 70, y, size: 9, font });
      y -= LINE;
    }
  }

  y -= LINE;
  page.drawText(toWinAnsiSafe("Total HT"), { x: PAGE_W - MARGIN - 120, y, size: 10, font });
  page.drawText(toWinAnsiSafe(formatEur(invoice.subtotal_ht ?? 0)), { x: PAGE_W - MARGIN - 70, y, size: 10, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe("TVA 20%"), { x: PAGE_W - MARGIN - 120, y, size: 10, font });
  page.drawText(toWinAnsiSafe(formatEur(invoice.tva_amount ?? 0)), { x: PAGE_W - MARGIN - 70, y, size: 10, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe("Total TTC"), { x: PAGE_W - MARGIN - 120, y, size: 11, font: fontBold });
  page.drawText(toWinAnsiSafe(formatEur(invoice.total_ttc ?? 0)), { x: PAGE_W - MARGIN - 70, y, size: 11, font: fontBold });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
