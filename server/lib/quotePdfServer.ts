/**
 * Génération PDF devis côté serveur avec signature
 * Utilise pdf-lib pour créer un PDF sans dépendre du frontend
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MARGIN = 40;
const PAGE_W = 595.28; // A4 width in points
const PAGE_H = 841.89; // A4 height in points
const LINE = 14;
const FONT_SIZE = 9;
const FONT_SIZE_TITLE = 16;

interface QuoteItem {
  description?: string | null;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  subItems?: { description?: string | null; quantity?: number; unitPrice?: number; total?: number }[];
}

interface QuoteDataForPdf {
  quoteNumber?: string | null;
  projectDescription?: string | null;
  validityDays?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  items?: QuoteItem[] | null;
  subtotalHt?: number;
  tva?: number;
  totalTtc?: number;
  companyName?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  companySiret?: string | null;
  signatureData?: string | null; // Base64 image data
  signerFirstName?: string | null;
  signerLastName?: string | null;
  signedAt?: string | null;
}

function toWinAnsiSafe(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return Array.from(s)
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      if (code >= 32 && code <= 127) return c;
      if (code >= 0xa0 && code <= 0xff) return c;
      if (code === 0x202f) return " ";
      if (code === 0x20ac) return "EUR";
      return " ";
    })
    .join("");
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr || String(dateStr).trim() === "") return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEur(n: number | undefined): string {
  if (n == null) return "0,00 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export async function generateQuotePdfWithSignature(data: QuoteDataForPdf): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - MARGIN;

  // ===== Header =====
  const companyName = toWinAnsiSafe(data.companyName || "TitanBtp");
  page.drawText(companyName, { x: MARGIN, y, size: FONT_SIZE_TITLE, font: fontBold });
  y -= LINE * 1.5;

  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  page.drawText(`Devis N° ${toWinAnsiSafe(data.quoteNumber || "—")} - Le ${dateStr}`, {
    x: PAGE_W - MARGIN - 200,
    y: PAGE_H - MARGIN - 10,
    size: FONT_SIZE,
    font: fontBold,
  });

  y -= LINE;

  // ===== Émetteur et Client =====
  page.drawText("Émetteur:", { x: MARGIN, y, size: FONT_SIZE, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(data.companyAddress || "Adresse"), { x: MARGIN + 20, y, size: FONT_SIZE, font });
  y -= LINE;
  if (data.companyPhone) {
    page.drawText(`Tél. ${toWinAnsiSafe(data.companyPhone)}`, { x: MARGIN + 20, y, size: FONT_SIZE, font });
    y -= LINE;
  }
  if (data.companyEmail) {
    page.drawText(toWinAnsiSafe(data.companyEmail), { x: MARGIN + 20, y, size: FONT_SIZE, font });
    y -= LINE;
  }

  y -= LINE * 0.5;
  page.drawText("Client:", { x: MARGIN, y, size: FONT_SIZE, font: fontBold });
  y -= LINE;
  page.drawText(toWinAnsiSafe(data.clientName || "—"), { x: MARGIN + 20, y, size: FONT_SIZE, font });
  y -= LINE;
  if (data.clientAddress) {
    page.drawText(toWinAnsiSafe(data.clientAddress), { x: MARGIN + 20, y, size: FONT_SIZE, font });
    y -= LINE;
  }
  if (data.clientPhone) {
    page.drawText(`Tél. ${toWinAnsiSafe(data.clientPhone)}`, { x: MARGIN + 20, y, size: FONT_SIZE, font });
    y -= LINE;
  }

  y -= LINE;

  // ===== Project Description =====
  page.drawText("Projet:", { x: MARGIN, y, size: FONT_SIZE, font: fontBold });
  y -= LINE;
  const projDesc = toWinAnsiSafe(data.projectDescription || "—");
  page.drawText(projDesc.substring(0, 60), { x: MARGIN + 20, y, size: FONT_SIZE, font });
  y -= LINE;

  y -= LINE * 0.5;

  // ===== Items Table =====
  const tableStartY = y;
  const colDesc = MARGIN;
  const colQty = 350;
  const colPrice = 430;
  const colTotal = PAGE_W - MARGIN - 50;

  // Header
  page.drawText("Désignation", { x: colDesc, y, size: FONT_SIZE, font: fontBold });
  page.drawText("Qté", { x: colQty, y, size: FONT_SIZE, font: fontBold });
  page.drawText("P.U. HT", { x: colPrice, y, size: FONT_SIZE, font: fontBold });
  page.drawText("Montant", { x: colTotal, y, size: FONT_SIZE, font: fontBold });
  y -= LINE * 1.2;

  // Items
  const items = data.items || [];
  for (const item of items) {
    const desc = toWinAnsiSafe(item.description || "—");
    page.drawText(desc.substring(0, 40), { x: colDesc, y, size: FONT_SIZE, font });
    page.drawText(String(item.quantity || 0), { x: colQty, y, size: FONT_SIZE, font });
    page.drawText(formatEur(item.unitPrice), { x: colPrice, y, size: FONT_SIZE, font });
    page.drawText(formatEur(item.total), { x: colTotal, y, size: FONT_SIZE, font });
    y -= LINE;

    if (item.subItems) {
      for (const sub of item.subItems) {
        const subDesc = toWinAnsiSafe(sub.description || "—");
        page.drawText(`  → ${subDesc.substring(0, 35)}`, { x: colDesc, y, size: FONT_SIZE - 1, font });
        page.drawText(String(sub.quantity || 0), { x: colQty, y, size: FONT_SIZE - 1, font });
        page.drawText(formatEur(sub.unitPrice), { x: colPrice, y, size: FONT_SIZE - 1, font });
        page.drawText(formatEur(sub.total), { x: colTotal, y, size: FONT_SIZE - 1, font });
        y -= LINE;
      }
    }
  }

  y -= LINE;

  // ===== Totals (right aligned) =====
  const totalsX = PAGE_W - MARGIN - 150;
  page.drawText("Total HT", { x: totalsX, y, size: FONT_SIZE, font });
  page.drawText(formatEur(data.subtotalHt), { x: PAGE_W - MARGIN - 50, y, size: FONT_SIZE, font });
  y -= LINE;

  if (data.tva && data.tva > 0) {
    page.drawText("TVA", { x: totalsX, y, size: FONT_SIZE, font });
    page.drawText(formatEur(data.tva), { x: PAGE_W - MARGIN - 50, y, size: FONT_SIZE, font });
    y -= LINE;
  }

  page.drawText("Total TTC", { x: totalsX, y, size: FONT_SIZE, font: fontBold });
  page.drawText(formatEur(data.totalTtc), { x: PAGE_W - MARGIN - 50, y, size: FONT_SIZE, font: fontBold });
  y -= LINE * 1.5;

  // ===== Validity =====
  if (data.validityDays) {
    const validityDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(data.validityDays, 10) || 30);
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    })();
    page.drawText(`Offre valable jusqu'au ${validityDate}`, { x: MARGIN, y, size: FONT_SIZE, font });
    y -= LINE;
  }

  // ===== Signature Section =====
  if (data.signatureData) {
    y -= LINE;
    page.drawText("Signature du client:", { x: MARGIN, y, size: FONT_SIZE, font: fontBold });
    y -= LINE * 2;

    try {
      // Extract base64 from data URI if needed
      let base64Data = data.signatureData;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      // Convert base64 to Buffer
      const signatureBuffer = Buffer.from(base64Data, "base64");

      // Determine image type (assume PNG for data from canvas)
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);

      // Draw signature (max width 100pt, max height 40pt)
      const signW = 100;
      const signH = 40;
      page.drawImage(signatureImage, {
        x: MARGIN,
        y: y - signH,
        width: signW,
        height: signH,
      });

      y -= signH + LINE;

      if (data.signerFirstName || data.signerLastName) {
        const signerName = `${toWinAnsiSafe(data.signerFirstName || "")} ${toWinAnsiSafe(data.signerLastName || "")}`.trim();
        page.drawText(signerName, { x: MARGIN, y, size: FONT_SIZE, font });
        y -= LINE;
      }

      if (data.signedAt) {
        const signedDate = formatDate(data.signedAt);
        page.drawText(`Signé le ${signedDate}`, { x: MARGIN, y, size: FONT_SIZE - 1, font });
      }
    } catch (err) {
      console.error("[QUOTE PDF] Erreur lors de l'ajout de la signature:", err);
      page.drawText("(Erreur lors de l'ajout de la signature)", { x: MARGIN, y, size: FONT_SIZE, font });
    }
  }

  // ===== Footer =====
  page.drawText(`— ${companyName}`, { x: PAGE_W / 2, y: MARGIN - 10, size: FONT_SIZE - 1, font });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
