/**
 * Génération PDF facture côté serveur (pour envoi email sans envoyer le PDF dans le body).
 * Layout type facture professionnelle : en-tête, émetteur/client, tableau détaillé, totaux, notes, pied de page.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LINE = 14;
const FONT_SIZE = 9;
const FONT_SIZE_SM = 8;
const FONT_SIZE_TITLE = 18;

// Colonnes du tableau (x de fin pour alignement à droite, ou début pour à gauche)
const COL_DESC_END = 270;
const COL_QTY_START = 275;
const COL_QTY_END = 320;
const COL_PU_START = 325;
const COL_PU_END = 400;
const COL_MONTANT_END = PAGE_W - MARGIN;

/** Renders a string safe for pdf-lib WinAnsi (e.g. U+202F narrow no-break space, €). */
function toWinAnsiSafe(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return Array.from(s)
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      if (code >= 32 && code <= 127) return c;
      if (code >= 0xa0 && code <= 0xff) return c;
      if (code === 0x202f) return "\u0020";
      if (code === 0x20ac) return " EUR";
      return "\u0020";
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
  notes?: string | null;
};

type ProfileForPdf = {
  full_name?: string | null;
  company_address?: string | null;
  company_city_postal?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_siret?: string | null;
};

function drawHLine(
  page: { drawLine: (o: { start: { x: number; y: number }; end: { x: number; y: number }; thickness?: number; color?: unknown }) => void },
  y: number,
  fromX: number,
  toX: number,
  thickness: number = 0.5
) {
  page.drawLine({
    start: { x: fromX, y },
    end: { x: toX, y },
    thickness,
    color: rgb(0.2, 0.2, 0.2),
  });
}

/** Découpe un texte trop long pour tenir sur une ligne (approx. 50 caractères pour colonne description). */
function wrapText(text: string, maxChars: number): string[] {
  const safe = toWinAnsiSafe(text) || "—";
  if (safe.length <= maxChars) return [safe];
  const lines: string[] = [];
  let rest = safe;
  while (rest.length > 0) {
    if (rest.length <= maxChars) {
      lines.push(rest);
      break;
    }
    const chunk = rest.slice(0, maxChars);
    const lastSpace = chunk.lastIndexOf(" ");
    const cut = lastSpace > maxChars / 2 ? lastSpace : maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return lines;
}

export async function generateInvoicePdfBuffer(
  invoice: InvoiceForPdf,
  profile: ProfileForPdf | null
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const companyName = profile?.full_name ?? "Nom de l'entreprise";
  const companyAddr = profile?.company_address ?? "";
  const companyCity = profile?.company_city_postal ?? "";
  const companySiret = profile?.company_siret ?? "";

  // ----- En-tête -----
  page.drawText(toWinAnsiSafe("FACTURE"), { x: MARGIN, y, size: FONT_SIZE_TITLE, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(`N° ${invoice.invoice_number ?? "—"}`), { x: MARGIN, y, size: FONT_SIZE + 1, font: fontBold });
  y -= LINE;
  const dateEmission = formatDate(invoice.invoice_date ?? new Date().toISOString());
  page.drawText(toWinAnsiSafe(`Date d'émission : ${dateEmission}`), { x: MARGIN, y, size: FONT_SIZE, font });
  y -= LINE * 1.5;

  // ----- Bloc émetteur (gauche) et client (droite) -----
  const colRightStart = PAGE_W - MARGIN - 200;
  const blockY = y;

  page.drawText(toWinAnsiSafe(companyName), { x: MARGIN, y, size: FONT_SIZE + 1, font: fontBold });
  y -= LINE;
  if (companyAddr) {
    for (const line of wrapText(companyAddr, 35)) {
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
      y -= LINE * 0.85;
    }
  }
  if (companyCity) {
    page.drawText(toWinAnsiSafe(companyCity), { x: MARGIN, y, size: FONT_SIZE, font });
    y -= LINE * 0.85;
  }
  if (companySiret) {
    page.drawText(toWinAnsiSafe(`SIRET : ${companySiret}`), { x: MARGIN, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
  }
  if (profile?.company_phone) {
    page.drawText(toWinAnsiSafe(`Tél. : ${profile.company_phone}`), { x: MARGIN, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
  }
  if (profile?.company_email) {
    page.drawText(toWinAnsiSafe(profile.company_email), { x: MARGIN, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
  }

  y = blockY;
  page.drawText(toWinAnsiSafe("Facturé à"), { x: colRightStart, y, size: FONT_SIZE, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(invoice.client_name ?? "—"), { x: colRightStart, y, size: FONT_SIZE, font });
  y -= LINE * 0.85;
  if (invoice.client_address) {
    for (const line of wrapText(invoice.client_address, 30)) {
      page.drawText(line, { x: colRightStart, y, size: FONT_SIZE_SM, font });
      y -= LINE * 0.85;
    }
  }
  if (invoice.client_phone) {
    page.drawText(toWinAnsiSafe(`Tél. : ${invoice.client_phone}`), { x: colRightStart, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
  }
  if (invoice.client_email) {
    page.drawText(toWinAnsiSafe(invoice.client_email), { x: colRightStart, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
  }

  y -= LINE;
  drawHLine(page, y, MARGIN, PAGE_W - MARGIN);
  y -= LINE;

  // ----- Dates et conditions -----
  page.drawText(toWinAnsiSafe(`Date d'échéance : ${formatDate(invoice.due_date ?? "")}`), { x: MARGIN, y, size: FONT_SIZE, font });
  y -= LINE;
  if (invoice.payment_terms && String(invoice.payment_terms).trim()) {
    const termsLines = wrapText(invoice.payment_terms, 70);
    page.drawText(toWinAnsiSafe("Conditions de paiement : " + (termsLines[0] ?? "")), { x: MARGIN, y, size: FONT_SIZE_SM, font });
    y -= LINE * 0.85;
    for (let i = 1; i < termsLines.length; i++) {
      page.drawText(termsLines[i], { x: MARGIN, y, size: FONT_SIZE_SM, font });
      y -= LINE * 0.85;
    }
    y -= LINE * 0.5;
  }
  y -= LINE * 0.5;

  // ----- Tableau des lignes -----
  const tableTop = y;
  page.drawText(toWinAnsiSafe("Désignation"), { x: MARGIN, y, size: FONT_SIZE_SM, font: fontBold });
  page.drawText(toWinAnsiSafe("Qté"), { x: COL_QTY_START, y, size: FONT_SIZE_SM, font: fontBold });
  page.drawText(toWinAnsiSafe("PU HT"), { x: COL_PU_START, y, size: FONT_SIZE_SM, font: fontBold });
  const wTotal = font.widthOfTextAtSize(toWinAnsiSafe("Montant HT"), FONT_SIZE_SM);
  page.drawText(toWinAnsiSafe("Montant HT"), { x: COL_MONTANT_END - wTotal, y, size: FONT_SIZE_SM, font: fontBold });
  y -= LINE * 0.8;
  drawHLine(page, y, MARGIN, PAGE_W - MARGIN);
  y -= LINE * 0.8;

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

  const rowHeight = LINE * 0.95;
  const subRowHeight = LINE * 0.8;

  for (const item of items) {
    const subItems = Array.isArray(item.subItems) ? item.subItems : [];
    const qty = item.quantity ?? 0;
    const pu = item.unitPrice ?? 0;
    const total = item.total ?? 0;

    if (subItems.length) {
      const mainTotal = subItems.reduce((s, sub) => s + (sub.total ?? 0), 0);
      const descLines = wrapText(item.description ?? "—", 42);
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(descLines[i], { x: MARGIN, y, size: FONT_SIZE_SM, font });
        const wMontant = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(mainTotal)), FONT_SIZE_SM);
        page.drawText(toWinAnsiSafe(formatEur(mainTotal)), { x: COL_MONTANT_END - wMontant, y, size: FONT_SIZE_SM, font });
        y -= subRowHeight;
      }
      for (const sub of subItems) {
        const subDesc = `  ${sub.description ?? "—"}`;
        const subQty = sub.quantity ?? 0;
        const subPu = sub.unitPrice ?? 0;
        const subTotal = sub.total ?? 0;
        const wQty = font.widthOfTextAtSize(String(subQty), FONT_SIZE_SM);
        const wPu = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(subPu)), FONT_SIZE_SM);
        const wTot = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(subTotal)), FONT_SIZE_SM);
        page.drawText(toWinAnsiSafe(subDesc.slice(0, 45)), { x: MARGIN, y, size: FONT_SIZE_SM, font });
        page.drawText(String(subQty), { x: COL_QTY_END - wQty, y, size: FONT_SIZE_SM, font });
        page.drawText(toWinAnsiSafe(formatEur(subPu)), { x: COL_PU_END - wPu, y, size: FONT_SIZE_SM, font });
        page.drawText(toWinAnsiSafe(formatEur(subTotal)), { x: COL_MONTANT_END - wTot, y, size: FONT_SIZE_SM, font });
        y -= subRowHeight;
      }
    } else {
      const descLines = wrapText(item.description ?? "—", 42);
      const wQty = font.widthOfTextAtSize(String(qty), FONT_SIZE_SM);
      const wPu = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(pu)), FONT_SIZE_SM);
      const wTot = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(total)), FONT_SIZE_SM);
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(descLines[i], { x: MARGIN, y, size: FONT_SIZE_SM, font });
        const showAmount = i === 0;
        if (showAmount) {
          page.drawText(String(qty), { x: COL_QTY_END - wQty, y, size: FONT_SIZE_SM, font });
          page.drawText(toWinAnsiSafe(formatEur(pu)), { x: COL_PU_END - wPu, y, size: FONT_SIZE_SM, font });
          page.drawText(toWinAnsiSafe(formatEur(total)), { x: COL_MONTANT_END - wTot, y, size: FONT_SIZE_SM, font });
        }
        y -= subRowHeight;
      }
    }
    if (y < MARGIN + 120) break;
  }

  drawHLine(page, y, MARGIN, PAGE_W - MARGIN);
  y -= LINE;

  // ----- Totaux -----
  const totalBoxLeft = PAGE_W - MARGIN - 160;
  page.drawText(toWinAnsiSafe("Total HT"), { x: totalBoxLeft, y, size: FONT_SIZE, font });
  const wSub = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(invoice.subtotal_ht ?? 0)), FONT_SIZE);
  page.drawText(toWinAnsiSafe(formatEur(invoice.subtotal_ht ?? 0)), { x: COL_MONTANT_END - wSub, y, size: FONT_SIZE, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe("TVA 20 %"), { x: totalBoxLeft, y, size: FONT_SIZE, font });
  const wTva = font.widthOfTextAtSize(toWinAnsiSafe(formatEur(invoice.tva_amount ?? 0)), FONT_SIZE);
  page.drawText(toWinAnsiSafe(formatEur(invoice.tva_amount ?? 0)), { x: COL_MONTANT_END - wTva, y, size: FONT_SIZE, font });
  y -= LINE;
  page.drawText(toWinAnsiSafe("Total TTC"), { x: totalBoxLeft, y, size: FONT_SIZE + 1, font: fontBold });
  const wTtc = fontBold.widthOfTextAtSize(toWinAnsiSafe(formatEur(invoice.total_ttc ?? 0)), FONT_SIZE + 1);
  page.drawText(toWinAnsiSafe(formatEur(invoice.total_ttc ?? 0)), { x: COL_MONTANT_END - wTtc, y, size: FONT_SIZE + 1, font: fontBold });
  y -= LINE * 1.5;

  // ----- Notes -----
  if (invoice.notes && String(invoice.notes).trim()) {
    page.drawText(toWinAnsiSafe("Notes / Mentions"), { x: MARGIN, y, size: FONT_SIZE, font: fontBold });
    y -= LINE * 0.9;
    const noteLines = wrapText(invoice.notes, 85);
    for (const line of noteLines) {
      page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: FONT_SIZE_SM, font });
      y -= LINE * 0.85;
    }
    y -= LINE;
  }

  // ----- Pied de page -----
  y = MARGIN + 30;
  drawHLine(page, y, MARGIN, PAGE_W - MARGIN, 0.3);
  y -= LINE * 0.8;
  if (companySiret) {
    page.drawText(toWinAnsiSafe(`SIRET : ${companySiret}`), { x: MARGIN, y, size: FONT_SIZE_SM, font });
  }
  page.drawText(
    toWinAnsiSafe("TVA sur les débits - Paiement par virement, chèque ou espèces selon conditions."),
    { x: MARGIN, y: MARGIN + 10, size: 7, font }
  );

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
