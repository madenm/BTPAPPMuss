import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoiceItem, SupabaseInvoice } from "./supabaseInvoices";
import { buildContactBlockHtml, type ContactBlockParams } from "./quotePdf";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

const MARGIN = 18;
const PAGE_W = 210;
const LOGO_MAX_HEIGHT_MM = 22;
const COL_RIGHT_X = PAGE_W - 82;
const LINE_HEIGHT = 5.5;
const HEAD_FILL_DEFAULT = [51, 65, 85];
const ROW_FILL = [248, 250, 252];
const BORDER_GRAY = [226, 232, 240];
const ACCENT_LINE_HEIGHT = 1.2;

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

  // ----- Header: Logo (left) | FACTURE N° + date (right) -----
  const dateStr = formatDateFR(invoice.invoice_date);

  if (logoDataUrl) {
    try {
      const imgFormat = logoDataUrl.indexOf("image/png") !== -1 ? "PNG" : "JPEG";
      const imgProps = doc.getImageProperties(logoDataUrl) as { width: number; height: number };
      const logoH = LOGO_MAX_HEIGHT_MM;
      const logoW = Math.min((imgProps.width / imgProps.height) * logoH, 48);
      doc.addImage(logoDataUrl, imgFormat, MARGIN, y, logoW, logoH);
    } catch {
      // Pas de texte "Logo" si échec : on laisse l’espace
    }
  }

  const companyDisplayName = companyName?.trim() || "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURE", COL_RIGHT_X, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N° ${invoice.invoice_number || "—"}`, COL_RIGHT_X, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(companyCityPostal ? `${companyCityPostal}, le ${dateStr}` : `Le ${dateStr}`, COL_RIGHT_X, y + 18);
  doc.setTextColor(0, 0, 0);
  y += LOGO_MAX_HEIGHT_MM + 8;

  // Ligne d’accent (couleur thème ou gris)
  doc.setFillColor(...(rgb ?? HEAD_FILL_DEFAULT));
  doc.rect(0, y - 2, PAGE_W, ACCENT_LINE_HEIGHT, "F");
  y += 6;

  const blockStartY = y;

  // ----- Colonne gauche : Coordonnées entreprise (uniquement les champs renseignés) -----
  const companyLines: string[] = [];
  if (companyDisplayName) companyLines.push(companyDisplayName);
  if (companyAddress?.trim()) companyLines.push(companyAddress.trim());
  if (companyCityPostal?.trim()) companyLines.push(companyCityPostal.trim());
  if (companyPhone?.trim()) companyLines.push(companyPhone.trim());
  if (companyEmail?.trim()) companyLines.push(companyEmail.trim());
  if (companyLines.length === 0) companyLines.push("");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(companyLines[0] || "Votre entreprise", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (let i = 1; i < companyLines.length; i++) {
    doc.text(companyLines[i], MARGIN, y);
    y += LINE_HEIGHT;
  }
  if (companyLines.length === 1 && !companyDisplayName) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Renseignez vos coordonnées dans Paramètres", MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += LINE_HEIGHT;
  }

  // ----- Bloc « Facturé à » (même hauteur que bloc entreprise) -----
  const clientBoxX = COL_RIGHT_X;
  const clientBoxW = PAGE_W - COL_RIGHT_X - MARGIN;
  const clientBoxH = Math.max(28, (companyLines.length + 1) * LINE_HEIGHT + 4);
  const clientBoxY = blockStartY;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.setLineWidth(0.3);
  doc.rect(clientBoxX, clientBoxY, clientBoxW, clientBoxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Facturé à", clientBoxX + 4, clientBoxY + 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.client_name?.trim() || "—", clientBoxX + 4, clientBoxY + 12);
  doc.setFontSize(9);
  let clientLineY = clientBoxY + 17;
  if (invoice.client_address?.trim()) {
    doc.text(invoice.client_address.trim(), clientBoxX + 4, clientLineY);
    clientLineY += LINE_HEIGHT;
  }
  if (invoice.client_phone?.trim()) {
    doc.text(invoice.client_phone.trim(), clientBoxX + 4, clientLineY);
    clientLineY += LINE_HEIGHT;
  }
  if (invoice.client_email?.trim()) {
    doc.text(invoice.client_email.trim(), clientBoxX + 4, clientLineY);
  }

  y = Math.max(y, clientBoxY + clientBoxH) + 6;

  // ----- Dates -----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Date d'émission", MARGIN, y);
  doc.text("Date d'échéance", MARGIN + 75, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(formatDateFR(invoice.invoice_date), MARGIN + 38, y);
  doc.text(formatDateFR(invoice.due_date), MARGIN + 113, y);
  doc.setFont("helvetica", "normal");
  y += LINE_HEIGHT + 6;

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

  // ----- Bottom: Conditions de paiement (gauche) | Totaux (droite) -----
  const totalsX = PAGE_W - MARGIN - 55;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Conditions de paiement", MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += LINE_HEIGHT;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y - 2, 90, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const paymentTermsRaw = (invoice.payment_terms || "").trim();
  const paymentTermsText = paymentTermsRaw || "Paiement à 30 jours (net)";
  const paymentTermsLines = doc.splitTextToSize(paymentTermsText, 86);
  doc.text(paymentTermsLines.slice(0, 3), MARGIN + 3, y + 4);

  // Bloc totaux (fond léger + bordure)
  const totalsBoxX = totalsX - 4;
  const totalsBoxW = PAGE_W - MARGIN - totalsBoxX;
  const totalsBoxHeight = 32;
  doc.setFillColor(248, 250, 252);
  doc.rect(totalsBoxX, finalY + 6, totalsBoxW, totalsBoxHeight, "F");
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(totalsBoxX, finalY + 6, totalsBoxW, totalsBoxHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total HT", totalsX, finalY + 15);
  doc.text(formatCurrency(invoice.subtotal_ht), PAGE_W - MARGIN - 4, finalY + 15, { align: "right" });
  doc.text("TVA 20 %", totalsX, finalY + 24);
  doc.text(formatCurrency(invoice.tva_amount), PAGE_W - MARGIN - 4, finalY + 24, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total TTC", totalsX, finalY + 34);
  doc.text(formatCurrency(invoice.total_ttc), PAGE_W - MARGIN - 4, finalY + 34, { align: "right" });

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

  // ----- Footer (infos légales uniquement si renseignées) -----
  const footerY = doc.getPageHeight() - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const footerParts: string[] = [];
  if (companyLegal?.trim()) footerParts.push(companyLegal.trim());
  if (companySiret?.trim()) footerParts.push(`SIRET ${companySiret.trim()}`);
  const footerStr = footerParts.length > 0 ? footerParts.join(" — ") : (companyDisplayName || "Facture générée par TitanBtp");
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
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotalHt: number;
  tvaAmount: number;
  total: number;
  dueDate: string;
  paymentTerms: string;
  companyName?: string;
  companyAddress?: string;
  companyCityPostal?: string;
  companyPhone?: string;
  companyEmail?: string;
  /** Bloc de contact en fin d'email (nom, tél., email, adresse) */
  contactBlock?: ContactBlockParams;
}): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dueDateStr = (() => {
    const d = new Date(params.dueDate);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();
  const company = params.companyName || "Nom de l'entreprise";
  const companyAddress = params.companyAddress || "";
  const companyCityPostal = params.companyCityPostal || "";
  const companyPhone = params.companyPhone || "";
  const companyEmail = params.companyEmail || "";
  
  const clientAddress = params.clientAddress || "—";
  const clientPhone = params.clientPhone || "—";
  const clientEmail = params.clientEmail || "—";
  
  // Générer le HTML des articles
  let itemsHtml = '';
  if (params.items && params.items.length > 0) {
    itemsHtml = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">';
    itemsHtml += '<thead><tr style="background-color: #64748b; color: white;">';
    itemsHtml += '<th style="padding: 10px; text-align: left; border: 1px solid #475569;">Description</th>';
    itemsHtml += '<th style="padding: 10px; text-align: right; border: 1px solid #475569;">Prix unitaire HT</th>';
    itemsHtml += '<th style="padding: 10px; text-align: center; border: 1px solid #475569;">Quantité</th>';
    itemsHtml += '<th style="padding: 10px; text-align: right; border: 1px solid #475569;">Montant HT</th>';
    itemsHtml += '</tr></thead><tbody>';
    
    params.items.forEach((item, idx) => {
      if (item.subItems && item.subItems.length > 0) {
        // Article avec sous-articles
        const mainTotal = item.subItems.reduce((sum, sub) => sum + sub.total, 0);
        itemsHtml += `<tr style="background-color: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">`;
        itemsHtml += `<td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${item.description || "—"}</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">—</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">—</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: bold;">${formatCurrency(mainTotal)}</td>`;
        itemsHtml += '</tr>';
        
        item.subItems.forEach((subItem) => {
          itemsHtml += `<tr style="background-color: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">`;
          itemsHtml += `<td style="padding: 10px; padding-left: 30px; border: 1px solid #e2e8f0;">${subItem.description || "—"}</td>`;
          itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">${formatCurrency(subItem.unitPrice)}</td>`;
          itemsHtml += `<td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${subItem.quantity}</td>`;
          itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">${formatCurrency(subItem.total)}</td>`;
          itemsHtml += '</tr>';
        });
      } else {
        // Article simple
        itemsHtml += `<tr style="background-color: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">`;
        itemsHtml += `<td style="padding: 10px; border: 1px solid #e2e8f0;">${item.description || "—"}</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">${formatCurrency(item.unitPrice)}</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${item.quantity}</td>`;
        itemsHtml += `<td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">${formatCurrency(item.total)}</td>`;
        itemsHtml += '</tr>';
      }
    });
    
    itemsHtml += '</tbody></table>';
  }
  
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
  .items-section { margin: 20px 0; }
  .totals { margin-top: 20px; text-align: right; }
  .totals-row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
  .totals-row.grey { background: #f1f5f9; padding: 6px 8px; margin: 0 -8px; }
  .totals-row strong { min-width: 100px; text-align: right; }
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
      ${companyAddress ? companyAddress + "<br>" : ""}
      ${companyCityPostal ? companyCityPostal + "<br>" : ""}
      ${companyPhone ? companyPhone + "<br>" : ""}
      ${companyEmail ? companyEmail : ""}
    </div>
    <div class="col client-box">
      <strong>Facturé à</strong>
      ${params.clientName || "—"}<br>
      ${clientAddress !== "—" ? `<strong>Adresse</strong> ${clientAddress}<br>` : ""}
      ${clientPhone !== "—" ? `<strong>Téléphone</strong> ${clientPhone}<br>` : ""}
      ${clientEmail !== "—" ? `<strong>Email</strong> ${clientEmail}` : ""}
    </div>
  </div>
  <div class="dates">
    <span><strong>Date d'émission:</strong> ${dateStr}</span>
    <span><strong>Date d'échéance:</strong> ${dueDateStr}</span>
  </div>
  <div class="items-section">
    <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #475569;">Détail des articles</h3>
    ${itemsHtml}
  </div>
  <div class="totals">
    <div class="totals-row"><strong>Total HT:</strong> ${formatCurrency(params.subtotalHt)}</div>
    <div class="totals-row"><strong>TVA (20%):</strong> ${formatCurrency(params.tvaAmount)}</div>
    <div class="totals-row grey" style="font-weight: bold; font-size: 16px; margin-top: 8px;"><strong>Total TTC:</strong> ${formatCurrency(params.total)}</div>
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
