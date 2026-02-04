import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoiceItem, SupabaseInvoice } from "./supabaseInvoices";
import { buildContactBlockHtml, type ContactBlockParams } from "./quotePdf";

const MARGIN = 15;
const PAGE_W = 210;
const LOGO_MAX_HEIGHT_MM = 20;
const COL_RIGHT_X = PAGE_W - 80;
const LINE_HEIGHT = 5;
const HEAD_FILL_DEFAULT = [100, 116, 139];
const ROW_FILL = [248, 250, 252];
const BORDER_GRAY = [226, 232, 240];

export interface InvoicePdfParams {
  invoice: SupabaseInvoice;
  companyName?: string;
  companyAddress?: string;
  companyCityPostal?: string;
  companyPhone?: string;
  companyEmail?: string;
  companySiret?: string;
  companyLegal?: string;
  themeColor?: string;
  logoDataUrl?: string | null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function formatDateFR(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildInvoiceDoc(params: InvoicePdfParams): jsPDF {
  const {
    invoice,
    themeColor,
    logoDataUrl,
    companyName,
    companyAddress,
    companyCityPostal,
    companyPhone,
    companyEmail,
    companySiret,
    companyLegal,
  } = params;

  const doc = new jsPDF();
  const rgb = themeColor ? hexToRgb(themeColor) : null;
  const headFill = rgb ?? HEAD_FILL_DEFAULT;
  const headText = rgb && luminance(rgb) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  let y = MARGIN;

  // ----- Header: Logo (left) | FACTURE N° + Ville, le date (right) -----
  const dateStr = formatDateFR(invoice.invoice_date);
  const cityLabel = companyCityPostal ? `${companyCityPostal}, le ${dateStr}` : `Le ${dateStr}`;

  if (logoDataUrl) {
    try {
      const imgFormat = logoDataUrl.indexOf("image/png") !== -1 ? "PNG" : "JPEG";
      const imgProps = doc.getImageProperties(logoDataUrl) as { width: number; height: number };
      const logoH = LOGO_MAX_HEIGHT_MM;
      const logoW = Math.min((imgProps.width / imgProps.height) * logoH, 45);
      doc.addImage(logoDataUrl, imgFormat, MARGIN, y, logoW, logoH);
    } catch {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Logo", MARGIN, y + 5);
    }
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Logo", MARGIN, y + 5);
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", COL_RIGHT_X, y + 4);
  doc.setFontSize(11);
  doc.text("N°", COL_RIGHT_X, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.invoice_number || "À renseigner", COL_RIGHT_X + 8, y + 10);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(cityLabel, COL_RIGHT_X, y + 16);
  doc.setTextColor(0, 0, 0);
  y += LOGO_MAX_HEIGHT_MM + 6;

  // ----- Two columns: Company (left) | Client box (right) -----
  const colLeftW = COL_RIGHT_X - MARGIN - 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(companyName || "Nom de l'entreprise", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont("helvetica", "normal");
  doc.text(companyAddress?.trim() || "Adresse", MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(companyCityPostal?.trim() || "Ville et Code Postal", MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(companyPhone?.trim() || "Numéro de téléphone", MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(companyEmail?.trim() || "Email", MARGIN, y);
  y += LINE_HEIGHT + 2;

  const clientBoxY = y - (5 * LINE_HEIGHT + 2);
  const clientBoxH = 5 * LINE_HEIGHT + 6;
  doc.setDrawColor(0, 0, 0);
  doc.rect(COL_RIGHT_X, clientBoxY, PAGE_W - COL_RIGHT_X - MARGIN, clientBoxH);
  doc.setFont("helvetica", "bold");
  doc.text("Facturé à", COL_RIGHT_X + 3, clientBoxY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.client_name || "—", COL_RIGHT_X + 3, clientBoxY + 10);
  doc.text(invoice.client_address || "—", COL_RIGHT_X + 3, clientBoxY + 15);
  doc.text(invoice.client_phone || "—", COL_RIGHT_X + 3, clientBoxY + 20);
  doc.text(invoice.client_email || "—", COL_RIGHT_X + 3, clientBoxY + 25);

  y += 4;

  // ----- Dates: Date d'émission et Date d'échéance -----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Date d'émission:", MARGIN, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatDateFR(invoice.invoice_date), MARGIN + 35, y);
  doc.setTextColor(71, 85, 105);
  doc.text("Date d'échéance:", MARGIN + 80, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatDateFR(invoice.due_date), MARGIN + 115, y);
  y += LINE_HEIGHT + 4;

  // ----- Table: Description | Prix unitaire HT | Unité | Quantité | Montant HT -----
  const tableBody: string[][] = [];
  for (const item of invoice.items) {
    if (item.subItems?.length) {
      const mainTotal = item.subItems.reduce((s, sub) => s + sub.total, 0);
      tableBody.push([
        item.description || "—",
        "—",
        "—",
        "—",
        `${mainTotal.toFixed(2)} €`,
      ]);
      for (const sub of item.subItems) {
        tableBody.push([
          "  " + (sub.description || "—"),
          `${sub.unitPrice.toFixed(2)} €`,
          "—",
          String(sub.quantity),
          `${sub.total.toFixed(2)} €`,
        ]);
      }
    } else {
      tableBody.push([
        item.description || "—",
        `${item.unitPrice.toFixed(2)} €`,
        "—",
        String(item.quantity),
        `${item.total.toFixed(2)} €`,
      ]);
    }
  }

  const tableWidth = PAGE_W - 2 * MARGIN;
  const colDescW = tableWidth - 28 - 18 - 22 - 28;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Prix unitaire HT", "Unité", "Quantité", "Montant HT"]],
    body: tableBody,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth,
    theme: "striped",
    headStyles: {
      fillColor: headFill,
      fontStyle: "bold",
      textColor: headText,
      cellPadding: 4,
      fontSize: 10,
    },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: ROW_FILL },
    columnStyles: {
      0: { cellWidth: colDescW },
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "right", cellWidth: 28 },
    },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let finalY = lastTable?.finalY ?? y + 20;
  y = finalY + 10;

  // ----- Bottom: Left = Conditions de paiement / Right = Totals -----
  const totalsX = PAGE_W - MARGIN - 52;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Conditions de paiement", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(MARGIN, y - 2, 88, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const paymentTermsText = invoice.payment_terms || "Paiement à 30 jours par chèque ou virement. En cas de retard, pénalités de retard et indemnité forfaitaire selon art. L441-6 du code de commerce.";
  const paymentTermsLines = doc.splitTextToSize(paymentTermsText, 84);
  doc.text(paymentTermsLines.slice(0, 4), MARGIN + 2, y + 3);

  // Bloc totaux (encadré)
  const totalsBoxX = totalsX - 3;
  const totalsBoxW = PAGE_W - MARGIN - totalsBoxX;
  const totalsBoxHeight = 30;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(totalsBoxX, finalY + 6, totalsBoxW, totalsBoxHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total HT", totalsX, finalY + 14);
  doc.text(`${invoice.subtotal_ht.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 14, { align: "right" });
  doc.text("TVA 20 %", totalsX, finalY + 23);
  doc.text(`${invoice.tva_amount.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 23, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", totalsX, finalY + 32);
  doc.text(`${invoice.total_ttc.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 32, { align: "right" });

  // Notes si présentes
  if (invoice.notes) {
    const notesY = finalY + 6 + totalsBoxHeight + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Notes:", MARGIN, notesY);
    doc.setTextColor(0, 0, 0);
    const notesLines = doc.splitTextToSize(invoice.notes, PAGE_W - 2 * MARGIN);
    doc.text(notesLines.slice(0, 3), MARGIN, notesY + 5);
  }

  // ----- Footer -----
  const footerY = doc.getPageHeight() - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const siretStr = companySiret?.trim() ? `N° Siret : ${companySiret.trim()}` : "N° Siret : …";
  const footerStr = companyLegal?.trim() || `Société au capital de … € — ${siretStr} — RCS — N° TVA : …`;
  doc.text(footerStr, PAGE_W / 2, footerY, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return doc;
}

export function downloadInvoicePdf(params: InvoicePdfParams): void {
  const doc = buildInvoiceDoc(params);
  const safeName = (params.invoice.client_name || "facture").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const date = new Date(params.invoice.invoice_date).toISOString().slice(0, 10);
  const filename = `facture-${params.invoice.invoice_number}-${safeName}-${date}.pdf`;
  doc.save(filename);
}

export function getInvoicePdfBase64(params: InvoicePdfParams): string {
  const doc = buildInvoiceDoc(params);
  const dataUrl = doc.output("datauristring");
  const base64 = dataUrl.split(",")[1];
  return base64 ?? "";
}

/** Builds HTML body for invoice email (matches PDF layout style). */
export function buildInvoiceEmailHtml(params: {
  clientName: string;
  invoiceNumber: string;
  total: number;
  dueDate: string;
  paymentTerms: string;
  companyName?: string;
  /** Bloc de contact en fin d'email (nom, tél., email, adresse) */
  contactBlock?: ContactBlockParams;
}): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dueDateStr = (() => {
    const d = new Date(params.dueDate);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();
  const company = params.companyName || "Nom de l'entreprise";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #64748b; }
  .header-right { text-align: right; }
  .header-right strong { font-size: 12px; color: #475569; }
  .two-cols { display: flex; gap: 24px; margin-bottom: 24px; }
  .col { flex: 1; }
  .client-box { border: 1px solid #000; padding: 12px; background: #fafafa; }
  .client-box strong { display: block; margin-bottom: 4px; font-size: 11px; color: #475569; }
  .dates { margin-bottom: 16px; font-size: 12px; }
  .dates span { margin-right: 24px; }
  .totals { margin-top: 16px; text-align: right; }
  .totals-row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
  .totals-row.grey { background: #f1f5f9; padding: 6px 8px; margin: 0 -8px; }
  .totals-row strong { min-width: 80px; text-align: right; }
  .payment-terms { margin-top: 20px; padding: 12px; background: #f1f5f9; border-left: 3px solid #64748b; font-size: 12px; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #64748b; }
</style></head>
<body>
  <div class="header">
    <div><strong>${company}</strong></div>
    <div class="header-right">
      <strong style="font-size: 16px;">FACTURE</strong><br>
      <strong>N°</strong> ${params.invoiceNumber}<br>
      <span style="font-size: 12px;">Le ${dateStr}</span>
    </div>
  </div>
  <div class="two-cols">
    <div class="col">
      <strong>${company}</strong><br>
      Adresse<br>
      Ville et Code Postal<br>
      Téléphone / Email
    </div>
    <div class="col client-box">
      <strong>Facturé à</strong>
      ${params.clientName || "—"}<br>
      <strong>Adresse</strong> —<br>
      <strong>Téléphone</strong> —<br>
      <strong>Email</strong> —
    </div>
  </div>
  <div class="dates">
    <span><strong>Date d'émission:</strong> ${dateStr}</span>
    <span><strong>Date d'échéance:</strong> ${dueDateStr}</span>
  </div>
  <p>Veuillez trouver ci-joint le détail de la facture en pièce jointe (PDF).</p>
  <div class="totals">
    <div class="totals-row grey"><strong>Total TTC</strong> ${params.total.toFixed(2)} €</div>
  </div>
  <div class="payment-terms">
    <strong>Conditions de paiement:</strong><br>
    ${params.paymentTerms}
  </div>
  ${params.contactBlock ? buildContactBlockHtml(params.contactBlock) : ""}
  <div class="footer">${company}</div>
</body>
</html>`;
}

export async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string | null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
