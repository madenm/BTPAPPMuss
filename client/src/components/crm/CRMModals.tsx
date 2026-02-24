import { useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, X } from "lucide-react"
import type { Prospect } from "@/lib/supabaseProspects"
import type { SupabaseQuote } from "@/lib/supabaseQuotes"
import type { InvoiceWithPayments } from "@/lib/supabaseInvoices"

/* ────────────────────────── Quote Modal ────────────────────────── */

interface QuoteModalProps {
  open: boolean
  prospect: Prospect | null
  pdfFile: File | null
  selectedQuote: SupabaseQuote | null
  quotes: SupabaseQuote[]
  quotesLoading: boolean
  dragOver: boolean
  customMessage: string
  sending: boolean
  defaultMessage: string
  onPdfFileChange: (file: File | null) => void
  onSelectedQuoteChange: (quote: SupabaseQuote | null) => void
  onDragOverChange: (v: boolean) => void
  onCustomMessageChange: (v: string) => void
  onCustomMessageBlur: () => void
  onConfirm: () => void
  onClose: () => void
}

export function QuoteModal({
  open,
  prospect,
  pdfFile,
  selectedQuote,
  quotes,
  quotesLoading,
  dragOver,
  customMessage,
  sending,
  defaultMessage,
  onPdfFileChange,
  onSelectedQuoteChange,
  onDragOverChange,
  onCustomMessageChange,
  onCustomMessageBlur,
  onConfirm,
  onClose,
}: QuoteModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open || !prospect) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
        <CardHeader>
          <CardTitle>Visualisation du Devis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Destinataire</p>
            <p className="text-sm">{prospect.name} ({prospect.email})</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Devis à envoyer</p>
            <div className="space-y-3">
              <div>
                <Label className="text-white/80 text-xs">Fichier PDF</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && file.type === "application/pdf") {
                      onPdfFileChange(file)
                      onSelectedQuoteChange(null)
                    }
                    e.target.value = ""
                  }}
                />
                <div
                  className={`mt-1 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
                    dragOver ? "border-white/40 bg-white/10" : "border-white/20 bg-black/20"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); onDragOverChange(true) }}
                  onDragLeave={() => onDragOverChange(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    onDragOverChange(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file && file.type === "application/pdf") {
                      onPdfFileChange(file)
                      onSelectedQuoteChange(null)
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {pdfFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-white/90">{pdfFile.name}</span>
                      <Button type="button" variant="ghost" size="sm" className="text-white/70 hover:text-white shrink-0" onClick={(e) => { e.stopPropagation(); onPdfFileChange(null) }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-6 w-6 text-white/60 mb-1" />
                      <p className="text-white/70">Glissez votre PDF ici ou cliquez pour parcourir</p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-white/80 text-xs">Devis de l'application</Label>
                {quotesLoading ? (
                  <p className="text-sm text-white/60 mt-2">Chargement des devis...</p>
                ) : quotes.length === 0 ? (
                  <p className="text-sm text-white/60 mt-2">Aucun devis. Créez-en un depuis le Générateur de Devis.</p>
                ) : (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
                    {quotes.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                          selectedQuote?.id === q.id ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
                        }`}
                        onClick={() => { onSelectedQuoteChange(q); onPdfFileChange(null) }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium truncate">{q.client_name ?? "Sans nom"}</span>
                          <span className="text-white/60 shrink-0">{q.total_ttc.toFixed(2)} € TTC</span>
                        </div>
                        {q.created_at && (
                          <div className="text-white/50 text-xs mt-0.5">{new Date(q.created_at).toLocaleDateString("fr-FR")}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-white/80 text-sm font-medium">Message personnalisé</Label>
            <p className="text-xs text-white/50 mb-1">Ce message sera affiché dans l'email envoyé au prospect.</p>
            <Textarea
              value={customMessage}
              onChange={(e) => onCustomMessageChange(e.target.value)}
              onBlur={onCustomMessageBlur}
              placeholder={defaultMessage}
              className="mt-1 min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/40 resize-y"
              rows={4}
            />
          </div>

          <div className="border border-white/10 rounded-lg p-4 bg-black/20 backdrop-blur-md">
            <p className="text-sm font-medium mb-2">Aperçu</p>
            {pdfFile ? (
              <p className="text-sm text-white/70">Fichier : {pdfFile.name}</p>
            ) : selectedQuote ? (
              <div className="space-y-1 text-sm text-white/70">
                <p>{selectedQuote.client_name ?? "—"} — {selectedQuote.project_type ?? "—"}</p>
                <p className="font-medium text-white">Total TTC : {selectedQuote.total_ttc.toFixed(2)} €</p>
              </div>
            ) : (
              <p className="text-sm text-white/50">Choisissez un devis existant ou déposez un PDF.</p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={onClose}>Annuler</Button>
            <Button
              onClick={onConfirm}
              disabled={sending || (!pdfFile && !selectedQuote)}
              className="bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Envoyer le Devis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ────────────────────────── Invoice Modal ────────────────────────── */

interface InvoiceModalProps {
  open: boolean
  prospect: Prospect | null
  invoices: InvoiceWithPayments[]
  selectedInvoice: InvoiceWithPayments | null
  loading: boolean
  customMessage: string
  sending: boolean
  defaultMessage: string
  onSelectedInvoiceChange: (inv: InvoiceWithPayments | null) => void
  onCustomMessageChange: (v: string) => void
  onCustomMessageBlur: () => void
  onConfirm: () => void
  onClose: () => void
}

export function InvoiceModal({
  open,
  prospect,
  invoices,
  selectedInvoice,
  loading,
  customMessage,
  sending,
  defaultMessage,
  onSelectedInvoiceChange,
  onCustomMessageChange,
  onCustomMessageBlur,
  onConfirm,
  onClose,
}: InvoiceModalProps) {
  if (!open || !prospect) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
        <CardHeader>
          <CardTitle>Envoi de la facture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Destinataire</p>
            <p className="text-sm">{prospect.name} ({prospect.email})</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Facture à envoyer</p>
            {loading ? (
              <p className="text-sm text-white/60 mt-2">Chargement des factures...</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-white/60 mt-2">Aucune facture. Créez-en une depuis la page Factures.</p>
            ) : (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
                {invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                      selectedInvoice?.id === inv.id ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => onSelectedInvoiceChange(inv)}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">{inv.invoice_number}</span>
                      <span className="text-white/60 shrink-0">{inv.total_ttc.toFixed(2)} € TTC</span>
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">
                      {inv.client_name ?? "—"} — {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-white/80 text-sm font-medium">Message personnalisé</Label>
            <p className="text-xs text-white/50 mb-1">Ce message sera affiché dans l'email envoyé au prospect.</p>
            <Textarea
              value={customMessage}
              onChange={(e) => onCustomMessageChange(e.target.value)}
              onBlur={onCustomMessageBlur}
              placeholder={defaultMessage}
              className="mt-1 min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/40 resize-y"
              rows={4}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={onClose}>Annuler</Button>
            <Button
              onClick={onConfirm}
              disabled={sending || !selectedInvoice}
              className="bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Envoyer la facture
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ────────────────────────── Followup Modal ────────────────────────── */

interface FollowupModalProps {
  open: boolean
  prospect: Prospect | null
  message: string
  sending: boolean
  onMessageChange: (v: string) => void
  onMessageBlur: () => void
  onConfirm: () => void
  onClose: () => void
}

export function FollowupModal({
  open,
  prospect,
  message,
  sending,
  onMessageChange,
  onMessageBlur,
  onConfirm,
  onClose,
}: FollowupModalProps) {
  if (!open || !prospect) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl m-4 text-white">
        <CardHeader>
          <CardTitle>Message de Relance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Destinataire:</p>
            <p className="text-sm">{prospect.name} ({prospect.email})</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block" htmlFor="followup-message">
              Message (modifiable, enregistré pour cette étape):
            </label>
            <textarea
              id="followup-message"
              name="followupMessage"
              className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 min-h-[150px]"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              onBlur={onMessageBlur}
              placeholder="Message de relance..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={onClose}>Annuler</Button>
            <Button onClick={onConfirm} disabled={sending} className="bg-white/20 text-white border border-white/10 hover:bg-white/30">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Envoyer la Relance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
