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

/**
 * Ajoute une signature à un PDF de devis existant dans le rectangle "Bon pour accord"
 * @param pdfBase64 PDF original en base64
 * @param signatureDataBase64 Données de signature (image PNG en base64)
 * @param signerFirstName Prénom du signataire
 * @param signerLastName Nom du signataire
 * @param signedAt Date de signature
 * @param rectCoords Coordonnées du rectangle en mm {x, y, width, height} - optionnel
 */
export async function addSignatureToPdf(
  pdfBase64: string,
  signatureDataBase64: string,
  signerFirstName: string,
  signerLastName: string,
  signedAt: Date,
  rectCoords?: { x: number; y: number; width: number; height: number }
): Promise<Buffer> {
  try {
    // Charger le PDF existant
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Obtenir la dernière page (celle avec la signature)
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    console.log(`[ADD SIGNATURE] Page size: ${width}x${height}`);

    // Extraire la base64
    let base64Data = signatureDataBase64;
    if (base64Data.includes(",")) {
      base64Data = base64Data.split(",")[1];
    }

    // Valider le base64
    if (!base64Data || base64Data.length < 100) {
      console.warn("[ADD SIGNATURE] Données de signature invalides ou vides, longueur:", base64Data?.length);
      return Buffer.from(pdfBase64, "base64");
    }

    console.log(`[ADD SIGNATURE] Base64 valide, longueur: ${base64Data.length}`);

    const signatureBuffer = Buffer.from(base64Data, "base64");
    console.log(`[ADD SIGNATURE] Buffer créé, taille: ${signatureBuffer.length} bytes`);
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Déterminer les coordonnées du rectangle
    // Si rectCoords est fourni (en mm), convertir en points pdf-lib
    // Sinon, utiliser des valeurs par défaut estimées
    let signatureX: number;
    let signatureY: number;
    let signatureW: number;
    let signatureH: number;

    if (rectCoords && rectCoords.x && rectCoords.y && rectCoords.width && rectCoords.height) {
      // Convertir de mm (jsPDF) à points (pdf-lib)
      // 1 mm = 2.834645669 points
      const MM_TO_POINTS = 2.834645669;
      
      signatureX = rectCoords.x * MM_TO_POINTS;
      signatureW = rectCoords.width * MM_TO_POINTS;
      signatureH = rectCoords.height * MM_TO_POINTS;
      
      // Y : jsPDF compte de haut en bas, pdf-lib compte de bas en haut
      // Y_pdflib = pageHeight - (Y_jspdf + height_jspdf)
      signatureY = height - ((rectCoords.y + rectCoords.height) * MM_TO_POINTS);
      
      console.log(`[ADD SIGNATURE] Coordonnées depuis base (mm): X=${rectCoords.x}, Y=${rectCoords.y}, W=${rectCoords.width}, H=${rectCoords.height}`);
      console.log(`[ADD SIGNATURE] Coordonnées converties (points): X=${signatureX}, Y=${signatureY}, W=${signatureW}, H=${signatureH}`);
    } else {
      // Valeurs par défaut basées sur la structure de jsPDF
      // PAGE_W = 210mm, PAGE_H = 297mm, MARGIN = 10mm
      // Le rectangle "Bon pour accord" se trouve vers 255-260mm du haut pour un devis type
      const MM_TO_POINTS = 2.834645669;
      const A4_HEIGHT_MM = 297;
      
      // Estimer la position du rectangle (vers 35-40mm du bas)
      const rectFromBottomMm = 35;
      const rectYmm = A4_HEIGHT_MM - rectFromBottomMm; // ~262mm du haut
      
      signatureX = 105 * MM_TO_POINTS;  // totalsX = 105mm dans jsPDF
      signatureW = 48 * MM_TO_POINTS;   // largeur du rectangle
      signatureH = 20 * MM_TO_POINTS;   // hauteur du rectangle
      signatureY = height - ((rectYmm + 20) * MM_TO_POINTS); // Convertir position jsPDF en pdf-lib
      
      console.log(`[ADD SIGNATURE] Utilisation des coordonnées par défaut (Y estimé: ${rectYmm}mm du haut)`);
    }

    try {
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);
      console.log("[ADD SIGNATURE] Image PNG embedée avec succès");
      
      // Placer l'image dans le rectangle
      lastPage.drawImage(signatureImage, {
        x: signatureX + 1,
        y: signatureY + 1,
        width: signatureW - 2,
        height: signatureH - 2,
      });
      
      console.log("[ADD SIGNATURE] Image dessinée dans le PDF");
    } catch (embedErr) {
      console.error("[ADD SIGNATURE] Erreur lors de l'embed PNG:", embedErr?.toString());
      
      // Fallback : écrire du texte visible pour tester les coordonnées
      lastPage.drawText("✓ Signé", {
        x: signatureX + 2,
        y: signatureY + 3,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });
      console.log("[ADD SIGNATURE] Fallback texte ajouté");
    }

    // Sauvegarder et retourner le PDF modifié
    const pdfBytes = await pdfDoc.save();
    console.log("[ADD SIGNATURE] PDF sauvegardé");
    return Buffer.from(pdfBytes);
  } catch (err) {
    console.error("[ADD SIGNATURE TO PDF] Erreur générale:", err);
    return Buffer.from(pdfBase64, "base64");
  }
}

