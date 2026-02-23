import type { QuoteItem } from "@/lib/supabaseQuotes";

/**
 * Extrait une quantité et l'unité d'un segment de texte (ex: "40 m²", "2 jours", "12 mètres").
 * Retourne { quantity, rest } où rest est le texte sans le motif quantité.
 */
function extractQuantityFromSegment(text: string): { quantity: number; rest: string } {
  const trimmed = text.trim();
  // Patterns: 40 m², 40 m2, 40 metre carré, 40 mètres carrés, 20 m³, 2 jours, 5 heures, 10 pièces, etc.
  // Ne jamais utiliser "m" seul avant "carré" pour éviter de couper "mètre" (ex: "40 mètre carré" → pas "40 m" + "etre carré").
  const patterns: { regex: RegExp; replaceLen: (m: RegExpMatchArray) => number }[] = [
    { regex: /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:mètres?|metres?)\s*carr[ée]s?\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*m[³3]\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:mètre|metres)\s*cubes?\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:heures?|h)\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*jours?\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:pièces?|u\.?|unit[ée]s?)\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:litres?|L)\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*(?:mètres?|metres?)\s*(?:linéaires?|de\s+)/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*m\s+(?!ètre|etre)(?:linéaires?|de\s+)/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*semaines?\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
    { regex: /(\d+(?:[.,]\d+)?)\s*mois\s*(?:de\s+)?/i, replaceLen: (m) => m[0].length },
  ];
  for (const { regex, replaceLen } of patterns) {
    const m = trimmed.match(regex);
    if (m) {
      const qtyStr = (m[1] ?? "").replace(",", ".");
      const quantity = parseFloat(qtyStr) || 1;
      const len = replaceLen(m);
      const rest = (trimmed.slice(0, m.index) + trimmed.slice((m.index ?? 0) + len)).trim();
      return { quantity, rest };
    }
  }
  return { quantity: 1, rest: trimmed };
}

/**
 * Découpe une description (une ou plusieurs phrases) en segments logiques pour créer plusieurs lignes.
 */
function splitDescriptionIntoSegments(description: string): string[] {
  const normalized = description.replace(/\r\n/g, "\n").trim();
  const byNewline = normalized.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const block of byNewline) {
    // À l'intérieur d'un bloc (une ligne utilisateur), découper par séparateurs courants
    const parts = block
      .split(/\s*[,;]\s*|\s+il faut\s+|\s+puis\s+|\s+et\s+(?:ensuite\s+)?|\s+-\s+(?=[A-ZÀÉÈÊËÎÏÔÛÜ])/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 0) {
      segments.push(...parts);
    } else if (block.length > 0) {
      segments.push(block);
    }
  }
  return segments;
}

/**
 * Parse une description de projet (texte libre) en lignes de devis.
 * - Découpe par retours à la ligne ET par virgules / "il faut" / "puis" / "et" pour obtenir plusieurs lignes.
 * - Extrait les quantités (m², m³, heures, jours, pièces, etc.) quand c'est possible.
 * - Supporte aussi les formats explicites : "Prestation : 1500 €", "Prestation 50 € x 12".
 */
export function parseDescriptionToItems(description: string): QuoteItem[] {
  const segments = splitDescriptionIntoSegments(description);
  if (segments.length === 0) return [];

  const items: QuoteItem[] = [];
  let idCounter = 0;

  const priceRegex = /(\d[\d\s]*(?:[.,]\d+)?)\s*€?/;
  const qtyRegex = /(?:[x*×]\s*(\d+(?:[.,]\d+)?)|\(\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*\))/i;

  for (const segment of segments) {
    idCounter += 1;
    const id = `parsed-${idCounter}-${Date.now()}`;

    let quantity = 1;
    let rest = segment;

    // Quantité explicite en fin de ligne (x 2, * 2)
    const qtyMatch = rest.match(qtyRegex);
    if (qtyMatch) {
      const qtyStr = (qtyMatch[1] ?? qtyMatch[2]).replace(",", ".");
      quantity = parseFloat(qtyStr) || 1;
      rest = rest.replace(qtyRegex, "").trim();
    } else {
      const extracted = extractQuantityFromSegment(rest);
      quantity = extracted.quantity;
      rest = extracted.rest;
    }

    // Montant explicite (dernier nombre suivi de €)
    const priceMatches = [...rest.matchAll(/\d[\d\s]*(?:[.,]\d+)?\s*€?/g)];
    let unitPrice = 0;
    let descText = rest;
    if (priceMatches.length > 0) {
      const lastPrice = priceMatches[priceMatches.length - 1];
      const priceStr = lastPrice[0].replace(/\s/g, "").replace(",", ".").replace("€", "").trim();
      unitPrice = parseFloat(priceStr) || 0;
      const priceStart = lastPrice.index ?? 0;
      descText = rest.slice(0, priceStart).trim();
      descText = descText.replace(/\s*[:\-–—]\s*$/, "").trim();
    }

    if (!descText) descText = rest.replace(priceRegex, "").replace(qtyRegex, "").trim();
    if (!descText) descText = segment;
    descText = descText.replace(/\s*[,\-–—]\s*$/, "").trim();
    if (!descText) continue;

    items.push({
      id,
      description: descText,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      unit: '',
    });
  }

  return items;
}
