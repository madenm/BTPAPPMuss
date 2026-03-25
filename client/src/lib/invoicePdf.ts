import { getApiPostHeaders } from "./apiHeaders";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email court : la facture officielle est le PDF joint (même fichier que le téléchargement).
 */
export function buildInvoiceEmailNotificationHtml(params: {
  clientName?: string | null;
  invoiceNumber: string;
  companyName: string;
}): string {
  const name = params.clientName?.trim();
  const cn = params.companyName.trim() || "Votre entreprise";
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;">
<p style="margin:0 0 12px;">Bonjour${name ? " " + escapeHtml(name) : ""},</p>
<p style="margin:0 0 12px;">Veuillez trouver ci-joint votre facture n° <strong>${escapeHtml(params.invoiceNumber)}</strong> au format PDF. Ce document fait foi.</p>
<p style="margin:0;">Cordialement,<br/><strong>${escapeHtml(cn)}</strong></p>
</body>
</html>`;
}

function triggerBrowserPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Télécharge le PDF serveur pour une facture enregistrée (identique à la pièce jointe email). */
export async function downloadServerInvoicePdfById(opts: {
  accessToken: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  clientName?: string | null;
  invoiceDate?: string | null;
}): Promise<void> {
  const apiBase = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${apiBase}/api/invoices/${encodeURIComponent(opts.invoiceId)}/pdf`, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: "application/pdf",
      "X-Auth-Token": opts.accessToken,
    },
  });
  if (!res.ok) {
    let msg = "Impossible de générer le PDF";
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const date = (opts.invoiceDate || new Date().toISOString()).slice(0, 10);
  const safeName = (opts.clientName || "client")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 60) || "client";
  const num = String(opts.invoiceNumber ?? "facture").replace(/[^\w.-]+/g, "_");
  triggerBrowserPdfDownload(blob, `facture-${num}-${safeName}-${date}.pdf`);
}

/** PDF serveur à partir d’un objet facture (brouillon / formulaire), même moteur que l’email. */
export async function downloadServerInvoicePdfFromPayload(opts: {
  accessToken: string;
  invoice: Record<string, unknown>;
}): Promise<void> {
  const apiBase = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${apiBase}/api/invoices/pdf`, {
    method: "POST",
    headers: {
      ...getApiPostHeaders(opts.accessToken),
      Accept: "application/pdf",
    },
    body: JSON.stringify({ invoice: opts.invoice }),
  });
  if (!res.ok) {
    let msg = "Impossible de générer le PDF";
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const inv = opts.invoice as {
    invoice_number?: string;
    client_name?: string;
    invoice_date?: string;
  };
  const date = (inv.invoice_date || new Date().toISOString()).slice(0, 10);
  const safeName = (inv.client_name || "brouillon")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 60) || "brouillon";
  const num = String(inv.invoice_number ?? "facture").replace(/[^\w.-]+/g, "_");
  triggerBrowserPdfDownload(blob, `facture-${num}-${safeName}-${date}.pdf`);
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
