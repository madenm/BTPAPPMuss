import type { QuoteItem } from "./supabaseQuotes";

export const DEFAULT_THEME_COLOR = "#8b5cf6";

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoyé: "Envoyé",
  accepté: "Accepté",
  refusé: "Refusé",
  expiré: "Expiré",
  validé: "Validé",
  signé: "Signé",
};

/** Valeur sentinelle pour "aucune unité" (Radix Select n'accepte pas value=""). */
export const QUOTE_UNIT_NONE = "__none__";

export const QUOTE_UNIT_OPTIONS = [
  { value: QUOTE_UNIT_NONE, label: "—" },
  { value: "Pièce", label: "Pièce" },
  { value: "Forfait", label: "Forfait" },
  { value: "m²", label: "m²" },
  { value: "m", label: "m" },
  { value: "jour", label: "jour" },
  { value: "lot", label: "lot" },
  { value: "U", label: "U" },
];

/** Déduit l'unité depuis la description (ex. "(U)" → "U", "(forfait)" → "Forfait") pour lignes sans unité. */
export function inferUnitFromDescription(description: string): string {
  const m = description.match(/\s*\(([^)]+)\)\s*$/);
  if (!m) return "";
  const raw = m[1].trim().toLowerCase();
  if (raw === "u") return "U";
  if (raw === "forfait") return "Forfait";
  return m[1].trim();
}

export function backfillUnitOnItems(items: QuoteItem[]): QuoteItem[] {
  return items.map((item) => {
    const unit = item.unit?.trim() || inferUnitFromDescription(item.description || "");
    const subItems = item.subItems?.map((sub) => ({
      ...sub,
      unit: sub.unit?.trim() || inferUnitFromDescription(sub.description || ""),
    }));
    return {
      ...item,
      unit,
      ...(subItems && subItems.length > 0 ? { subItems } : {}),
    };
  });
}
