import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Mail, Phone, Plus, Loader2, Upload, X } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { useUserSettings } from "@/context/UserSettingsContext"
import {
  type Prospect,
  fetchProspectsForUser,
  insertProspect,
  updateProspect,
} from "@/lib/supabaseProspects"
import { fetchQuotesForUser, updateQuoteStatus, type SupabaseQuote } from "@/lib/supabaseQuotes"
import { fetchInvoicesForUser, type InvoiceWithPayments } from "@/lib/supabaseInvoices"
import { getQuotePdfBase64, fetchLogoDataUrl, buildQuoteEmailHtml, buildContactBlockHtml, type QuotePdfParams } from "@/lib/quotePdf"
import { getInvoicePdfBase64, buildInvoiceEmailHtml } from "@/lib/invoicePdf"
import { toast } from "@/hooks/use-toast"

interface Column {
  id: string
  name: string
  items: Prospect[]
}

const COLUMN_DEFS: { id: string; name: string }[] = [
  { id: "all", name: "Tous les prospects" },
  { id: "quote", name: "Envoi du devis" },
  { id: "quote_followup1", name: "Relance devis 1" },
  { id: "quote_followup2", name: "Relance devis 2" },
  { id: "invoice", name: "Envoi de la facture" },
  { id: "invoice_followup1", name: "Relance facture 1" },
  { id: "invoice_followup2", name: "Relance facture 2" },
]

const DEFAULT_THEME_COLOR = "#8b5cf6"

export function CRMPipeline() {
  const { user } = useAuth()
  const { profile, logoUrl, themeColor } = useUserSettings()
  const accentColor = themeColor || DEFAULT_THEME_COLOR
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newProspect, setNewProspect] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  })
  const [adding, setAdding] = useState(false)

  const [draggedItem, setDraggedItem] = useState<{ prospect: Prospect; columnId: string } | null>(null)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string>("")
  const [updatingStage, setUpdatingStage] = useState(false)

  const [quoteModalPdfFile, setQuoteModalPdfFile] = useState<File | null>(null)
  const [quoteModalSelectedQuote, setQuoteModalSelectedQuote] = useState<SupabaseQuote | null>(null)
  const [quoteModalQuotes, setQuoteModalQuotes] = useState<SupabaseQuote[]>([])
  const [quoteModalQuotesLoading, setQuoteModalQuotesLoading] = useState(false)
  const [quoteModalDragOver, setQuoteModalDragOver] = useState(false)
  const quoteModalFileInputRef = useRef<HTMLInputElement>(null)

  const DEFAULT_QUOTE_FOLLOWUP_MESSAGE = "Bonjour, je souhaite faire un suivi concernant notre échange précédent et le devis que je vous ai transmis. N'hésitez pas à me recontacter pour en discuter. Cordialement."
  const DEFAULT_INVOICE_FOLLOWUP_MESSAGE = "Bonjour, je souhaite faire un suivi concernant la facture que je vous ai transmise. N'hésitez pas à me recontacter pour régler ou en discuter. Cordialement."
  const [followupMessage, setFollowupMessage] = useState(DEFAULT_QUOTE_FOLLOWUP_MESSAGE)

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceModalInvoices, setInvoiceModalInvoices] = useState<InvoiceWithPayments[]>([])
  const [invoiceModalSelectedInvoice, setInvoiceModalSelectedInvoice] = useState<InvoiceWithPayments | null>(null)
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false)

  const columns = useMemo<Column[]>(() => {
    return COLUMN_DEFS.map((col) => ({
      ...col,
      items: prospects.filter((p) => {
        const stage = p.stage
        if (col.id === "all") return stage === "all"
        if (col.id === "quote") return stage === "quote"
        if (col.id === "quote_followup1") return stage === "quote_followup1" || stage === "followup1"
        if (col.id === "quote_followup2") return stage === "quote_followup2" || stage === "followup2"
        if (col.id === "invoice") return stage === "invoice"
        if (col.id === "invoice_followup1") return stage === "invoice_followup1" || stage === "followup3"
        if (col.id === "invoice_followup2") return stage === "invoice_followup2" || stage === "followup4"
        return false
      }),
    }))
  }, [prospects])

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      setProspects([])
      return
    }
    setLoading(true)
    setError(null)
    fetchProspectsForUser(user.id)
      .then(setProspects)
      .catch((err) => {
        console.error(err)
        setError("Impossible de charger les prospects.")
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (!showQuoteModal || !user?.id) return
    setQuoteModalPdfFile(null)
    setQuoteModalSelectedQuote(null)
    setQuoteModalQuotesLoading(true)
    const prospect = selectedProspect
    fetchQuotesForUser(user.id)
      .then((quotes) => {
        setQuoteModalQuotes(quotes)
        // Pré-sélectionner le devis qui correspond au prospect (même email client)
        if (prospect && quotes.length > 0) {
          const norm = (s: string) => (s ?? "").trim().toLowerCase()
          const match = quotes.find(
            (q) => norm(q.client_email ?? "") === norm(prospect.email)
          )
          if (match) setQuoteModalSelectedQuote(match)
        }
      })
      .catch(() => setQuoteModalQuotes([]))
      .finally(() => setQuoteModalQuotesLoading(false))
  }, [showQuoteModal, user?.id, selectedProspect?.id])

  useEffect(() => {
    if (!showInvoiceModal || !user?.id) return
    setInvoiceModalSelectedInvoice(null)
    setInvoiceModalLoading(true)
    const prospect = selectedProspect
    fetchInvoicesForUser(user.id)
      .then((invoices) => {
        setInvoiceModalInvoices(invoices)
        if (prospect && invoices.length > 0) {
          const norm = (s: string) => (s ?? "").trim().toLowerCase()
          const match = invoices.find(
            (inv) => norm(inv.client_email ?? "") === norm(prospect.email)
          )
          if (match) setInvoiceModalSelectedInvoice(match)
        }
      })
      .catch(() => setInvoiceModalInvoices([]))
      .finally(() => setInvoiceModalLoading(false))
  }, [showInvoiceModal, user?.id, selectedProspect?.id])

  const refreshAfterUpdate = (updated: Prospect) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const handleAddProspect = async () => {
    if (!user?.id || !newProspect.name.trim() || !newProspect.email.trim()) {
      toast({ title: "Nom et email requis", variant: "destructive" })
      return
    }
    setAdding(true)
    try {
      const created = await insertProspect(user.id, {
        name: newProspect.name.trim(),
        email: newProspect.email.trim(),
        phone: newProspect.phone.trim() || undefined,
        company: newProspect.company.trim() || undefined,
        notes: newProspect.notes.trim() || undefined,
      })
      setProspects((prev) => [created, ...prev])
      setNewProspect({ name: "", email: "", phone: "", company: "", notes: "" })
      setAddDialogOpen(false)
      toast({ title: "Prospect ajouté" })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur lors de l'ajout", variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  const handleDragStart = (prospect: Prospect, columnId: string) => {
    setDraggedItem({ prospect, columnId })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const sendFollowupEmailAndMove = async (
    prospect: Prospect,
    columnId: string,
    type: "quote" | "invoice"
  ) => {
    if (!user?.id) return
    setUpdatingStage(true)
    try {
      const isQuote = type === "quote"
      const relanceLabel =
        columnId === "quote_followup1"
          ? "Relance devis 1"
          : columnId === "quote_followup2"
            ? "Relance devis 2"
            : columnId === "invoice_followup1"
              ? "Relance facture 1"
              : "Relance facture 2"
      const defaultMsg = isQuote ? DEFAULT_QUOTE_FOLLOWUP_MESSAGE : DEFAULT_INVOICE_FOLLOWUP_MESSAGE
      const subjectSuffix = isQuote ? "Votre devis" : "Votre facture"
      const contactBlock = buildContactBlockHtml({
        contactName: profile?.full_name,
        phone: profile?.company_phone,
        email: profile?.company_email,
        address: profile?.company_address,
        cityPostal: profile?.company_city_postal,
      })
      const htmlContent = `<p>${defaultMsg.replace(/\n/g, "</p><p>")}</p>${contactBlock}`
      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: prospect.email,
          subject: `${relanceLabel} - ${subjectSuffix}`,
          htmlContent,
        }),
      })
      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }
      const updated = await updateProspect(user.id, prospect.id, { stage: columnId })
      refreshAfterUpdate(updated)
      toast({ title: "Relance envoyée", description: `L'email de relance a été envoyé à ${prospect.email}.` })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la relance.", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedItem || !user?.id) return

    const { prospect, columnId: sourceColumnId } = draggedItem
    if (sourceColumnId === targetColumnId) {
      setDraggedItem(null)
      return
    }

    if (targetColumnId === "quote") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetColumnId)
      setShowQuoteModal(true)
      setDraggedItem(null)
      return
    }

    if (targetColumnId === "quote_followup1" || targetColumnId === "quote_followup2") {
      setDraggedItem(null)
      sendFollowupEmailAndMove(prospect, targetColumnId, "quote")
      return
    }

    if (targetColumnId === "invoice") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetColumnId)
      setShowInvoiceModal(true)
      setDraggedItem(null)
      return
    }

    if (targetColumnId === "invoice_followup1" || targetColumnId === "invoice_followup2") {
      setDraggedItem(null)
      sendFollowupEmailAndMove(prospect, targetColumnId, "invoice")
      return
    }

    setUpdatingStage(true)
    try {
      const updated = await updateProspect(user.id, prospect.id, { stage: targetColumnId })
      refreshAfterUpdate(updated)
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur lors du déplacement", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
    setDraggedItem(null)
  }

  function quoteToPdfParams(quote: SupabaseQuote): QuotePdfParams {
    const items = (quote.items ?? []).map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
      subItems: i.subItems?.map((s) => ({
        description: s.description,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        total: s.total,
      })),
    }))
    const subtotal = quote.total_ht
    const total = quote.total_ttc
    const tva = total - subtotal
    return {
      clientInfo: {
        name: quote.client_name ?? "",
        email: quote.client_email ?? "",
        phone: quote.client_phone ?? "",
        address: quote.client_address ?? "",
      },
      projectType: quote.project_type ?? "",
      projectDescription: quote.project_description ?? "",
      validityDays: String(quote.validity_days ?? 30),
      items,
      subtotal,
      tva,
      total,
    }
  }

  const handleQuoteConfirm = async () => {
    if (!user?.id || !selectedProspect) return
    const hasPdf = !!quoteModalPdfFile
    const hasQuote = !!quoteModalSelectedQuote
    if (!hasPdf && !hasQuote) {
      toast({ title: "Choisissez un devis ou déposez un PDF", variant: "destructive" })
      return
    }

    setUpdatingStage(true)
    try {
      let pdfBase64: string
      let fileName = "devis.pdf"
      if (hasQuote && quoteModalSelectedQuote) {
        const params = quoteToPdfParams(quoteModalSelectedQuote)
        params.themeColor = accentColor
        params.companyName = profile?.full_name ?? undefined
        params.companyAddress = profile?.company_address ?? undefined
        params.companyCityPostal = profile?.company_city_postal ?? undefined
        params.companyPhone = profile?.company_phone ?? undefined
        params.companyEmail = profile?.company_email ?? undefined
        params.companySiret = profile?.company_siret ?? undefined
        if (logoUrl) {
          const logoDataUrl = await fetchLogoDataUrl(logoUrl)
          if (logoDataUrl) params.logoDataUrl = logoDataUrl
        }
        pdfBase64 = getQuotePdfBase64(params)
        const safeName = (quoteModalSelectedQuote.client_name || "devis").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
        fileName = `devis-${safeName}.pdf`
      } else if (hasPdf && quoteModalPdfFile) {
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => {
            const dataUrl = fr.result as string
            resolve(dataUrl.split(",")[1] ?? "")
          }
          fr.onerror = () => reject(fr.error)
          fr.readAsDataURL(quoteModalPdfFile)
        })
        fileName = quoteModalPdfFile.name || "devis.pdf"
      } else {
        setUpdatingStage(false)
        return
      }

      const htmlContent =
        quoteModalSelectedQuote != null
          ? buildQuoteEmailHtml({
              clientName: quoteModalSelectedQuote.client_name ?? "",
              clientAddress: quoteModalSelectedQuote.client_address ?? undefined,
              clientPhone: quoteModalSelectedQuote.client_phone ?? undefined,
              clientEmail: quoteModalSelectedQuote.client_email ?? undefined,
              total: quoteModalSelectedQuote.total_ttc ?? 0,
              subtotal: quoteModalSelectedQuote.total_ht ?? undefined,
              tva: (quoteModalSelectedQuote.total_ttc ?? 0) - (quoteModalSelectedQuote.total_ht ?? 0),
              validityDays: String(quoteModalSelectedQuote.validity_days ?? 30),
              companyName: profile?.full_name ?? undefined,
              quoteNumber: undefined,
              items: (quoteModalSelectedQuote.items ?? []).map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.total,
                subItems: i.subItems,
              })),
              contactBlock: {
                contactName: profile?.full_name,
                phone: profile?.company_phone,
                email: profile?.company_email,
                address: profile?.company_address,
                cityPostal: profile?.company_city_postal,
              },
            })
          : undefined

      const emailRes = await fetch("/api/send-quote-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedProspect.email,
          pdfBase64,
          fileName,
          htmlContent: htmlContent ?? undefined,
        }),
      })

      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email.", variant: "destructive" })
        return
      }

      // Mettre à jour le statut du devis à "validé" si un devis a été sélectionné (validation automatique lors de l'envoi)
      if (quoteModalSelectedQuote && user?.id) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'CRMPipeline.tsx:sendQuoteEmail:before-status-update', message: 'Updating quote status to validé', data: { quoteId: quoteModalSelectedQuote.id, currentStatus: quoteModalSelectedQuote.status }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'F' }) }).catch(() => {});
        // #endregion
        try {
          await updateQuoteStatus(quoteModalSelectedQuote.id, user.id, 'validé');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'CRMPipeline.tsx:sendQuoteEmail:after-status-update', message: 'Quote status updated to validé', data: { quoteId: quoteModalSelectedQuote.id }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'F' }) }).catch(() => {});
          // #endregion
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'CRMPipeline.tsx:sendQuoteEmail:status-update-error', message: 'Error updating quote status', data: { error: err instanceof Error ? err.message : String(err) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'F' }) }).catch(() => {});
          // #endregion
          console.error('Error updating quote status:', err);
          // Ne pas bloquer le processus si la mise à jour du statut échoue
        }
      }

      const updated = await updateProspect(user.id, selectedProspect.id, { stage: "quote" })
      refreshAfterUpdate(updated)
      setShowQuoteModal(false)
      setSelectedProspect(null)
      setDraggedItem(null)
      setQuoteModalPdfFile(null)
      setQuoteModalSelectedQuote(null)
      toast({ title: "Email envoyé", description: "Le devis a été envoyé au prospect." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer l'email.", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  const closeQuoteModal = () => {
    setShowQuoteModal(false)
    setSelectedProspect(null)
    setDraggedItem(null)
    setQuoteModalPdfFile(null)
    setQuoteModalSelectedQuote(null)
  }

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false)
    setSelectedProspect(null)
    setDraggedItem(null)
    setInvoiceModalSelectedInvoice(null)
  }

  const handleInvoiceConfirm = async () => {
    if (!user?.id || !selectedProspect || !invoiceModalSelectedInvoice) return
    if (!invoiceModalSelectedInvoice.client_email?.trim()) {
      toast({ title: "Erreur", description: "Cette facture n'a pas d'email client.", variant: "destructive" })
      return
    }
    setUpdatingStage(true)
    try {
      const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : null
      const pdfBase64 = getInvoicePdfBase64({
        invoice: invoiceModalSelectedInvoice,
        companyName: profile?.full_name || "",
        companyAddress: profile?.company_address || "",
        companyCityPostal: profile?.company_city_postal || "",
        companyPhone: profile?.company_phone || "",
        companyEmail: profile?.company_email || "",
        companySiret: profile?.company_siret || "",
        logoDataUrl,
      })
      const invoiceHtml = buildInvoiceEmailHtml({
        clientName: invoiceModalSelectedInvoice.client_name ?? "",
        invoiceNumber: invoiceModalSelectedInvoice.invoice_number ?? "",
        total: invoiceModalSelectedInvoice.total_ttc ?? 0,
        dueDate: invoiceModalSelectedInvoice.due_date ?? new Date().toISOString(),
        paymentTerms: invoiceModalSelectedInvoice.payment_terms ?? "",
        companyName: profile?.full_name ?? undefined,
        contactBlock: {
          contactName: profile?.full_name,
          phone: profile?.company_phone,
          email: profile?.company_email,
          address: profile?.company_address,
          cityPostal: profile?.company_city_postal,
        },
      })
      const emailRes = await fetch(
        `/api/invoices/${invoiceModalSelectedInvoice.id}/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            to: selectedProspect.email,
            subject: `Facture ${invoiceModalSelectedInvoice.invoice_number}`,
            pdfBase64,
            message: invoiceHtml,
          }),
        }
      )
      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({
          title: "Erreur d'envoi",
          description: data.message || "Impossible d'envoyer la facture par email.",
          variant: "destructive",
        })
        return
      }
      const updated = await updateProspect(user.id, selectedProspect.id, { stage: "invoice" })
      refreshAfterUpdate(updated)
      closeInvoiceModal()
      toast({ title: "Facture envoyée", description: "La facture a été envoyée au prospect." })
    } catch (err) {
      console.error(err)
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'envoyer la facture.",
        variant: "destructive",
      })
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleFollowupConfirm = async () => {
    if (!user?.id || !selectedProspect || !selectedColumn) return

    setUpdatingStage(true)
    try {
      const contactBlock = buildContactBlockHtml({
        contactName: profile?.full_name,
        phone: profile?.company_phone,
        email: profile?.company_email,
        address: profile?.company_address,
        cityPostal: profile?.company_city_postal,
      })
      const baseHtml = followupMessage.trim().includes("<")
        ? followupMessage.trim()
        : `<p>${followupMessage.trim().replace(/\n/g, "</p><p>")}</p>`
      const htmlContent = baseHtml + contactBlock

      const relanceLabel =
        selectedColumn === "quote_followup1"
          ? "Relance devis 1"
          : selectedColumn === "quote_followup2"
            ? "Relance devis 2"
            : selectedColumn === "invoice_followup1"
              ? "Relance facture 1"
              : "Relance facture 2"
      const subjectSuffix =
        selectedColumn.startsWith("quote_") ? "Votre devis" : "Votre facture"
      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedProspect.email,
          subject: `${relanceLabel} - ${subjectSuffix}`,
          htmlContent,
        }),
      })

      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }

      const updated = await updateProspect(user.id, selectedProspect.id, { stage: selectedColumn })
      refreshAfterUpdate(updated)
      setShowFollowupModal(false)
      setSelectedProspect(null)
      setSelectedColumn("")
      setDraggedItem(null)
      setFollowupMessage(DEFAULT_QUOTE_FOLLOWUP_MESSAGE)
      toast({ title: "Relance envoyée", description: "L'email de relance a été envoyé au prospect." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la relance.", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-center text-white/70">
        Connectez-vous pour gérer vos prospects.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-center text-white">
        <p className="text-red-400">{error}</p>
        <Button
          variant="outline"
          className="mt-4 text-white border-white/20 hover:bg-white/10"
          onClick={() => {
            if (!user?.id) return
            setError(null)
            setLoading(true)
            fetchProspectsForUser(user.id)
              .then(setProspects)
              .catch((err) => {
                console.error(err)
                setError("Impossible de charger les prospects.")
              })
              .finally(() => setLoading(false))
          }}
        >
          Réessayer
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un prospect
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Nouveau prospect</DialogTitle>
              <DialogDescription className="text-white/70">
                Ajoutez un prospect à votre pipeline. Il apparaîtra dans &quot;Tous les prospects&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-white">Nom</Label>
                <Input
                  value={newProspect.name}
                  onChange={(e) => setNewProspect((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nom du prospect"
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white">Email</Label>
                <Input
                  type="email"
                  value={newProspect.email}
                  onChange={(e) => setNewProspect((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemple.com"
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white">Téléphone</Label>
                <Input
                  value={newProspect.phone}
                  onChange={(e) => setNewProspect((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="06 12 34 56 78"
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white">Entreprise</Label>
                <Input
                  value={newProspect.company}
                  onChange={(e) => setNewProspect((p) => ({ ...p, company: e.target.value }))}
                  placeholder="Nom de l'entreprise"
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white">Notes</Label>
                <Textarea
                  value={newProspect.notes}
                  onChange={(e) => setNewProspect((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Notes..."
                  rows={3}
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
                onClick={() => setAddDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddProspect}
                disabled={adding || !newProspect.name.trim() || !newProspect.email.trim()}
                className="bg-white/20 text-white border border-white/10 hover:bg-white/30"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {columns.map((column) => (
          <Card
            key={column.id}
            className="bg-black/20 backdrop-blur-xl border border-white/10 text-white"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            <CardHeader>
              <CardTitle className="text-sm">{column.name}</CardTitle>
              <Badge variant="secondary" className="mt-2">
                {column.items.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] space-y-2">
                {column.items.map((prospect) => (
                  <motion.div
                    key={prospect.id}
                    draggable
                    onDragStart={() => handleDragStart(prospect, column.id)}
                    className="p-3 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg cursor-move hover:bg-white/10 transition-all text-white"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{prospect.name}</p>
                      <div className="flex items-center gap-1 text-xs text-white/70">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{prospect.email}</span>
                      </div>
                      {prospect.phone && (
                        <div className="flex items-center gap-1 text-xs text-white/70">
                          <Phone className="h-3 w-3" />
                          <span>{prospect.phone}</span>
                        </div>
                      )}
                      {prospect.company && (
                        <p className="text-xs text-white/70">{prospect.company}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {column.items.length === 0 && (
                  <p className="text-xs text-white/70 text-center py-8">Aucun prospect</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showQuoteModal && selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
            <CardHeader>
              <CardTitle>Visualisation du Devis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Destinataire</p>
                <p className="text-sm">
                  {selectedProspect.name} ({selectedProspect.email})
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Devis à envoyer</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-white/80 text-xs">Fichier PDF</Label>
                    <input
                      ref={quoteModalFileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file && file.type === "application/pdf") {
                          setQuoteModalPdfFile(file)
                          setQuoteModalSelectedQuote(null)
                        }
                        e.target.value = ""
                      }}
                    />
                    <div
                      className={`mt-1 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
                        quoteModalDragOver
                          ? "border-white/40 bg-white/10"
                          : "border-white/20 bg-black/20"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setQuoteModalDragOver(true)
                      }}
                      onDragLeave={() => setQuoteModalDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setQuoteModalDragOver(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type === "application/pdf") {
                          setQuoteModalPdfFile(file)
                          setQuoteModalSelectedQuote(null)
                        }
                      }}
                      onClick={() => quoteModalFileInputRef.current?.click()}
                    >
                      {quoteModalPdfFile ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-white/90">{quoteModalPdfFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-white/70 hover:text-white shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setQuoteModalPdfFile(null)
                            }}
                          >
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
                    <Label className="text-white/80 text-xs">Devis de l’application</Label>
                    {quoteModalQuotesLoading ? (
                      <p className="text-sm text-white/60 mt-2">Chargement des devis...</p>
                    ) : quoteModalQuotes.length === 0 ? (
                      <p className="text-sm text-white/60 mt-2">Aucun devis. Créez-en un depuis le Générateur de Devis.</p>
                    ) : (
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
                        {quoteModalQuotes.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                              quoteModalSelectedQuote?.id === q.id
                                ? "bg-white/20 text-white"
                                : "text-white/80 hover:bg-white/10"
                            }`}
                            onClick={() => {
                              setQuoteModalSelectedQuote(q)
                              setQuoteModalPdfFile(null)
                            }}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium truncate">{q.client_name ?? "Sans nom"}</span>
                              <span className="text-white/60 shrink-0">{q.total_ttc.toFixed(2)} € TTC</span>
                            </div>
                            {q.created_at && (
                              <div className="text-white/50 text-xs mt-0.5">
                                {new Date(q.created_at).toLocaleDateString("fr-FR")}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-lg p-4 bg-black/20 backdrop-blur-md">
                <p className="text-sm font-medium mb-2">Aperçu</p>
                {quoteModalPdfFile ? (
                  <p className="text-sm text-white/70">Fichier : {quoteModalPdfFile.name}</p>
                ) : quoteModalSelectedQuote ? (
                  <div className="space-y-1 text-sm text-white/70">
                    <p>
                      {quoteModalSelectedQuote.client_name ?? "—"} —{" "}
                      {quoteModalSelectedQuote.project_type ?? "—"}
                    </p>
                    <p className="font-medium text-white">
                      Total TTC : {quoteModalSelectedQuote.total_ttc.toFixed(2)} €
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-white/50">Choisissez un devis existant ou déposez un PDF.</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                  onClick={closeQuoteModal}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleQuoteConfirm}
                  disabled={updatingStage || (!quoteModalPdfFile && !quoteModalSelectedQuote)}
                  className="bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                >
                  {updatingStage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Envoyer le Devis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showInvoiceModal && selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
            <CardHeader>
              <CardTitle>Envoi de la facture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Destinataire</p>
                <p className="text-sm">
                  {selectedProspect.name} ({selectedProspect.email})
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Facture à envoyer</p>
                {invoiceModalLoading ? (
                  <p className="text-sm text-white/60 mt-2">Chargement des factures...</p>
                ) : invoiceModalInvoices.length === 0 ? (
                  <p className="text-sm text-white/60 mt-2">Aucune facture. Créez-en une depuis la page Factures.</p>
                ) : (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
                    {invoiceModalInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                          invoiceModalSelectedInvoice?.id === inv.id
                            ? "bg-white/20 text-white"
                            : "text-white/80 hover:bg-white/10"
                        }`}
                        onClick={() => setInvoiceModalSelectedInvoice(inv)}
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
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                  onClick={closeInvoiceModal}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleInvoiceConfirm}
                  disabled={updatingStage || !invoiceModalSelectedInvoice}
                  className="bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                >
                  {updatingStage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Envoyer la facture
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showFollowupModal && selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl m-4 text-white">
            <CardHeader>
              <CardTitle>Message de Relance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Destinataire:</p>
                <p className="text-sm">
                  {selectedProspect.name} ({selectedProspect.email})
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Message (modifiable):</label>
                <textarea
                  className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 min-h-[150px]"
                  value={followupMessage}
                  onChange={(e) => setFollowupMessage(e.target.value)}
                  placeholder="Message de relance..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                  onClick={() => {
                    setShowFollowupModal(false)
                    setSelectedProspect(null)
                    setSelectedColumn("")
                    setDraggedItem(null)
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleFollowupConfirm}
                  disabled={updatingStage}
                  className="bg-white/20 text-white border border-white/10 hover:bg-white/30"
                >
                  {updatingStage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Envoyer la Relance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
