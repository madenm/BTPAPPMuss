import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotePdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  subItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface QuotePdfParams {
  clientInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  projectType: string;
  projectDescription: string;
  validityDays: string;
  items: QuotePdfItem[];
  subtotal: number;
  tva: number;
  total: number;
  themeColor?: string;
  logoDataUrl?: string;
  /** Numéro du devis (ex. "2024-001") */
  quoteNumber?: string;
  /** Infos entreprise pour en-tête et pied de page */
  companyName?: string;
  companyAddress?: string;
  companyCityPostal?: string;
  companyPhone?: string;
  companyEmail?: string;
  companySiret?: string;
  companyLegal?: string;
}

const MARGIN = 10;
const PAGE_W = 210;
const LINE_HEIGHT = 5.5;
const LOGO_MAX_HEIGHT_MM = 12;
const COL_RIGHT_X = 105;

// Couleur d'en-tête par défaut (bleu-gris) si pas de couleur thème
const HEAD_FILL_DEFAULT = [51, 65, 85] as [number, number, number];
const HEAD_TEXT = [255, 255, 255] as [number, number, number];
const ROW_FILL = [248, 250, 252] as [number, number, number];
const BORDER_GRAY = [203, 213, 225] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => c / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function formatDateFR(isoOrDays: string): string {
  if (/^\d+$/.test(isoOrDays.trim())) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(isoOrDays, 10));
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const part = isoOrDays.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    const [y, m, d] = part.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildQuoteDoc(params: QuotePdfParams): jsPDF {
  const {
    clientInfo,
    projectType,
    projectDescription,
    validityDays,
    items,
    subtotal,
    tva,
    total,
    themeColor,
    logoDataUrl,
    quoteNumber,
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

  // ----- Header: Logo (left) | Devis N° + Ville, le date (right) -----
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Devis N°", COL_RIGHT_X, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(quoteNumber || "À renseigner", COL_RIGHT_X + 22, y + 4);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(cityLabel, COL_RIGHT_X, y + 10);
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
  doc.text("Nom du client", COL_RIGHT_X + 3, clientBoxY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(clientInfo.name || "—", COL_RIGHT_X + 3, clientBoxY + 10);
  doc.text(clientInfo.address || "—", COL_RIGHT_X + 3, clientBoxY + 15);
  doc.text(clientInfo.phone || "—", COL_RIGHT_X + 3, clientBoxY + 20);
  doc.text(clientInfo.email || "—", COL_RIGHT_X + 3, clientBoxY + 25);

  y += 4;

  // ----- Objet du devis (au-dessus du tableau) -----
  if (projectType || projectDescription) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Objet du devis", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    y += LINE_HEIGHT;
    const objetText = [projectType, projectDescription].filter(Boolean).join(" — ");
    const objetLines = doc.splitTextToSize(objetText || "—", PAGE_W - 2 * MARGIN);
    doc.setFontSize(9);
    doc.text(objetLines.slice(0, 2), MARGIN, y);
    y += Math.min(objetLines.length, 2) * LINE_HEIGHT + 4;
  }

  // ----- Table: Description | Prix unitaire HT | Unité | Quantité | Montant HT -----
  const tableBody: string[][] = [];
  for (const item of items) {
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

  // ----- Bottom: Left = Modalités / Right = Totals + Validité + Signature -----
  const totalsX = PAGE_W - MARGIN - 52;
  const validityDateStr = formatDateFR(validityDays);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Modalités et conditions de règlement", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(MARGIN, y - 2, 88, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const modalitesText =
    "Paiement à 30 jours par chèque ou virement. En cas de retard, pénalités de retard et indemnité forfaitaire selon art. L441-6 du code de commerce.";
  const modalitesLines = doc.splitTextToSize(modalitesText, 84);
  doc.text(modalitesLines.slice(0, 4), MARGIN + 2, y + 3);

  // Bloc totaux (encadré) : hauteur limitée aux 3 lignes pour ne pas chevaucher la zone signature
  const totalsBoxX = totalsX - 3;
  const totalsBoxW = PAGE_W - MARGIN - totalsBoxX;
  const totalsBoxHeight = 30;
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(totalsBoxX, finalY + 6, totalsBoxW, totalsBoxHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total HT", totalsX, finalY + 14);
  doc.text(`${subtotal.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 14, { align: "right" });
  doc.text("TVA 20 %", totalsX, finalY + 23);
  doc.text(`${tva.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 23, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", totalsX, finalY + 32);
  doc.text(`${total.toFixed(2)} €`, PAGE_W - MARGIN - 3, finalY + 32, { align: "right" });

  // Validité et signature : sous le bloc totaux, sans chevauchement
  const rightColY = finalY + 6 + totalsBoxHeight + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Offre valable jusqu'au ${validityDateStr}`, totalsX, rightColY);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text("Bon pour accord", totalsX, rightColY + 10);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(totalsX, rightColY + 12, 48, 20);

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

export function downloadQuotePdf(params: QuotePdfParams): void {
  const doc = buildQuoteDoc(params);
  const safeName = (params.clientInfo.name || "devis").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `devis-${safeName}-${date}.pdf`;
  doc.save(filename);
}

export function getQuotePdfBase64(params: QuotePdfParams): string {
  const doc = buildQuoteDoc(params);
  const dataUrl = doc.output("datauristring");
  const base64 = dataUrl.split(",")[1];
  return base64 ?? "";
}

/** Item shape for email HTML (same as QuotePdfItem). */
export type QuoteEmailItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  subItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
};

/** Paramètres pour le bloc de contact en fin d'email. */
export type ContactBlockParams = {
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  cityPostal?: string | null;
};

/** Génère le HTML du bloc de contact en fin d'email (nom, tél., email, adresse). */
export function buildContactBlockHtml(params: ContactBlockParams): string {
  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const name = params.contactName?.trim();
  const phone = params.phone?.trim();
  const email = params.email?.trim();
  const address = params.address?.trim();
  const cityPostal = params.cityPostal?.trim();
  if (!name && !phone && !email && !address && !cityPostal) return "";
  const parts: string[] = [];
  if (name) parts.push(escapeHtml(name));
  if (phone) parts.push(`Tél. ${escapeHtml(phone)}`);
  if (email) parts.push(`Email : ${escapeHtml(email)}`);
  if (address) parts.push(escapeHtml(address));
  if (cityPostal) parts.push(escapeHtml(cityPostal));
  return `<div class="contact-block" style="margin-top: 24px; padding: 12px; background: #f8fafc; border-left: 3px solid #64748b; font-size: 13px;">
  <strong>Pour me joindre :</strong><br>
  ${parts.join("<br>\n  ")}
</div>`;
}

/** Builds HTML body for quote email (matches PDF layout style). Includes line items when provided. */
export function buildQuoteEmailHtml(params: {
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  total: number;
  subtotal?: number;
  tva?: number;
  validityDays: string;
  companyName?: string;
  quoteNumber?: string;
  /** Lignes du devis à afficher dans l'email */
  items?: QuoteEmailItem[];
  /** Bloc de contact en fin d'email (nom, tél., email, adresse) */
  contactBlock?: ContactBlockParams;
}): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const validityDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(params.validityDays, 10) || 30);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();
  const company = params.companyName || "Nom de l'entreprise";
  const items = params.items ?? [];
  const hasItems = items.length > 0;

  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  let tableRows = "";
  if (hasItems) {
    for (const row of items) {
      tableRows += `<tr><td>${escapeHtml(row.description)}</td><td>${row.quantity}</td><td>${row.unitPrice.toFixed(2)} €</td><td>${row.total.toFixed(2)} €</td></tr>`;
      if (row.subItems?.length) {
        for (const sub of row.subItems) {
          tableRows += `<tr class="sub"><td style="padding-left: 16px;">${escapeHtml(sub.description)}</td><td>${sub.quantity}</td><td>${sub.unitPrice.toFixed(2)} €</td><td>${sub.total.toFixed(2)} €</td></tr>`;
        }
      }
    }
  }

  const introText = hasItems
    ? "Détail du devis ci-dessous. Le PDF en pièce jointe reprend l’intégralité du document."
    : "Veuillez trouver ci-joint le détail du devis en pièce jointe (PDF).";

  const subtotalRow =
    params.subtotal != null
      ? `<div class="totals-row"><strong>Total HT</strong> ${params.subtotal.toFixed(2)} €</div>`
      : "";
  const tvaRow =
    params.tva != null && params.tva > 0
      ? `<div class="totals-row"><strong>TVA</strong> ${params.tva.toFixed(2)} €</div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 640px; margin: 0 auto; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #64748b; }
  .header-right { text-align: right; }
  .header-right strong { font-size: 12px; color: #475569; }
  .two-cols { display: flex; gap: 24px; margin-bottom: 24px; }
  .col { flex: 1; }
  .client-box { border: 1px solid #000; padding: 12px; background: #fafafa; }
  .client-box strong { display: block; margin-bottom: 4px; font-size: 11px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #64748b; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
  tr.sub td { font-size: 11px; color: #475569; }
  .totals { margin-top: 16px; text-align: right; }
  .totals-row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
  .totals-row.grey { background: #f1f5f9; padding: 6px 8px; margin: 0 -8px; }
  .totals-row strong { min-width: 80px; text-align: right; }
  .validity { margin-top: 20px; text-align: right; font-size: 12px; color: #475569; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #64748b; }
</style></head>
<body>
  <div class="header">
    <div><strong>${escapeHtml(company)}</strong></div>
    <div class="header-right">
      <strong>Devis N°</strong> ${params.quoteNumber ? escapeHtml(params.quoteNumber) : "—"}<br>
      <span style="font-size: 12px;">Le ${dateStr}</span>
    </div>
  </div>
  <div class="two-cols">
    <div class="col">
      <strong>${escapeHtml(company)}</strong><br>
      Adresse<br>
      Ville et Code Postal<br>
      Téléphone / Email
    </div>
    <div class="col client-box">
      <strong>Nom du client</strong>
      ${params.clientName ? escapeHtml(params.clientName) : "—"}<br>
      <strong>Adresse</strong> ${params.clientAddress ? escapeHtml(params.clientAddress) : "—"}<br>
      <strong>Téléphone</strong> ${params.clientPhone ? escapeHtml(params.clientPhone) : "—"}<br>
      <strong>Email</strong> ${params.clientEmail ? escapeHtml(params.clientEmail) : "—"}
    </div>
  </div>
  <p>${introText}</p>
  ${hasItems ? `
  <table>
    <thead><tr><th>Désignation</th><th>Qté</th><th>Prix unit. HT</th><th>Montant HT</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  ` : ""}
  <div class="totals">
    ${subtotalRow}
    ${tvaRow}
    <div class="totals-row grey"><strong>Total TTC</strong> ${params.total.toFixed(2)} €</div>
    <div class="validity">Offre valable jusqu'au ${validityDate}</div>
  </div>
  ${params.contactBlock ? buildContactBlockHtml(params.contactBlock) : ""}
  <div class="footer">${escapeHtml(company)}</div>
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
