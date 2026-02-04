import { Fragment } from "react";
import { Separator } from "@/components/ui/separator";
import type { QuoteItem } from "@/lib/supabaseQuotes";

export interface QuotePreviewData {
  client_name: string | null;
  client_email: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  project_type?: string | null;
  project_description?: string | null;
  validity_days?: number | null;
  items: QuoteItem[] | null;
  total_ht: number;
  total_ttc: number;
}

interface QuotePreviewProps {
  quote: QuotePreviewData;
  accentColor?: string;
  logoUrl?: string | null;
  className?: string;
}

function getItemTotal(item: QuoteItem): number {
  if (item.subItems?.length) {
    return item.subItems.reduce((sum, s) => sum + s.total, 0);
  }
  return item.quantity * item.unitPrice;
}

export function QuotePreview({ quote, accentColor = "#8b5cf6", logoUrl, className = "" }: QuotePreviewProps) {
  const items = quote.items ?? [];
  const totalHt = quote.total_ht;
  const totalTtc = quote.total_ttc;
  const tva = totalTtc - totalHt;
  const validityDays = quote.validity_days ?? 30;

  return (
    <div className={`overflow-y-auto space-y-4 pr-2 ${className}`}>
      <div
        className="flex items-center justify-between gap-4 pb-3"
        style={{ borderBottomWidth: 3, borderBottomColor: accentColor, borderBottomStyle: "solid" }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain object-left" />
        ) : (
          <span />
        )}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Devis</h2>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Client</h3>
        <p className="font-medium text-gray-900 dark:text-white">{quote.client_name || "—"}</p>
        {quote.client_email && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{quote.client_email}</p>
        )}
        {quote.client_phone && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{quote.client_phone}</p>
        )}
        {quote.client_address && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{quote.client_address}</p>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Projet</h3>
        {quote.project_type && (
          <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{quote.project_type}</p>
        )}
        {quote.project_description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
            {quote.project_description}
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Validité : {validityDays} jours</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div
          className="text-sm font-medium px-4 py-2 text-white"
          style={{ backgroundColor: accentColor }}
        >
          Détail du devis
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white font-medium" style={{ backgroundColor: accentColor }}>
                <th className="text-left py-2 px-4">Description</th>
                <th className="text-right py-2 px-4">Qté</th>
                <th className="text-right py-2 px-4">Prix unit.</th>
                <th className="text-right py-2 px-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                item.subItems?.length ? (
                  <Fragment key={item.id}>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      <td className="py-2 px-4 text-gray-900 dark:text-white font-medium">
                        {item.description || "—"}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">—</td>
                      <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">—</td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                        {getItemTotal(item).toFixed(2)} €
                      </td>
                    </tr>
                    {item.subItems.map((sub) => (
                      <tr key={sub.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-4 pl-8 text-gray-700 dark:text-gray-300">
                          {sub.description || "—"}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                          {sub.quantity}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                          {sub.unitPrice.toFixed(2)} €
                        </td>
                        <td className="py-2 px-4 text-right text-gray-900 dark:text-white">
                          {sub.total.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ) : (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-4 text-gray-900 dark:text-white">
                      {item.description || "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {item.unitPrice.toFixed(2)} €
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {item.total.toFixed(2)} €
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div
        className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1"
        style={{ borderTopWidth: 2, borderTopColor: accentColor, borderTopStyle: "solid" }}
      >
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Sous-total HT</span>
          <span className="font-medium text-gray-900 dark:text-white">{totalHt.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">TVA (20%)</span>
          <span className="font-medium text-gray-900 dark:text-white">{tva.toFixed(2)} €</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
          <span>Total TTC</span>
          <span>{totalTtc.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  );
}
