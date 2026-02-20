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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Mail, Phone, Plus, Loader2, Upload, X, Search, User, Trash2, Pencil } from "lucide-react"
import { motion } from "framer-motion"
import { getApiPostHeaders } from "@/lib/apiHeaders"
import { useAuth } from "@/context/AuthContext"
import { useTeamEffectiveUserId } from "@/context/TeamEffectiveUserIdContext"
import { useUserSettings } from "@/context/UserSettingsContext"
import { useChantiers } from "@/context/ChantiersContext"
import {
  type Prospect,
  fetchProspectsForUser,
  insertProspect,
  updateProspect,
  deleteProspect,
} from "@/lib/supabaseProspects"
import { fetchQuotesForUser, updateQuoteStatus, type SupabaseQuote } from "@/lib/supabaseQuotes"
import { fetchInvoicesForUser, createInvoiceFromQuote, type InvoiceWithPayments } from "@/lib/supabaseInvoices"
import { getQuotePdfBase64, fetchLogoDataUrl, buildQuoteEmailHtml, buildContactBlockHtml, type QuotePdfParams } from "@/lib/quotePdf"
import { buildInvoiceEmailHtml } from "@/lib/invoicePdf"
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

const DEFAULT_QUOTE_EMAIL_MESSAGE =
  "Bonjour,\n\nVeuillez trouver ci-joint notre devis. N'hésitez pas à nous contacter pour toute question.\n\nCordialement"

const DEFAULT_INVOICE_EMAIL_MESSAGE =
  "Bonjour,\n\nVeuillez trouver ci-joint notre facture. N'hésitez pas à nous contacter pour toute question.\n\nCordialement"

const DEFAULT_QUOTE_FOLLOWUP = "Bonjour, je souhaite faire un suivi concernant notre échange précédent et le devis que je vous ai transmis. N'hésitez pas à me recontacter pour en discuter. Cordialement."
const DEFAULT_INVOICE_FOLLOWUP = "Bonjour, je souhaite faire un suivi concernant la facture que je vous ai transmise. N'hésitez pas à me recontacter pour régler ou en discuter. Cordialement."

function getDefaultMessageForColumn(columnId: string): string {
  if (columnId === "quote") return DEFAULT_QUOTE_EMAIL_MESSAGE
  if (columnId === "invoice") return DEFAULT_INVOICE_EMAIL_MESSAGE
  if (columnId.startsWith("quote_")) return DEFAULT_QUOTE_FOLLOWUP
  if (columnId.startsWith("invoice_")) return DEFAULT_INVOICE_FOLLOWUP
  return ""
}

const PIPELINE_MESSAGES_STORAGE_KEY = "crm_pipeline_messages"

function getStoredPipelineMessages(userId: string | null): Record<string, string> {
  if (!userId || typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(`${PIPELINE_MESSAGES_STORAGE_KEY}_${userId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function setStoredPipelineMessage(userId: string | null, key: string, value: string): void {
  if (!userId || typeof window === "undefined") return
  try {
    const prev = getStoredPipelineMessages(userId)
    const next = { ...prev, [key]: value }
    localStorage.setItem(`${PIPELINE_MESSAGES_STORAGE_KEY}_${userId}`, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function CRMPipeline() {
  const { user, session } = useAuth()
  const effectiveUserId = useTeamEffectiveUserId()
  const userId = effectiveUserId ?? user?.id ?? null
  const { profile, logoUrl, themeColor } = useUserSettings()
  const { clients } = useChantiers()
  const accentColor = themeColor || DEFAULT_THEME_COLOR
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
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
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [prospectToRemove, setProspectToRemove] = useState<Prospect | null>(null)

  const [quoteModalPdfFile, setQuoteModalPdfFile] = useState<File | null>(null)
  const [quoteModalSelectedQuote, setQuoteModalSelectedQuote] = useState<SupabaseQuote | null>(null)
  const [quoteModalQuotes, setQuoteModalQuotes] = useState<SupabaseQuote[]>([])
  const [quoteModalQuotesLoading, setQuoteModalQuotesLoading] = useState(false)
  const [quoteModalDragOver, setQuoteModalDragOver] = useState(false)
  const [quoteModalCustomMessage, setQuoteModalCustomMessage] = useState("")
  const quoteModalFileInputRef = useRef<HTMLInputElement>(null)

  const DEFAULT_QUOTE_FOLLOWUP_MESSAGE = "Bonjour, je souhaite faire un suivi concernant notre échange précédent et le devis que je vous ai transmis. N'hésitez pas à me recontacter pour en discuter. Cordialement."
  const DEFAULT_INVOICE_FOLLOWUP_MESSAGE = "Bonjour, je souhaite faire un suivi concernant la facture que je vous ai transmise. N'hésitez pas à me recontacter pour régler ou en discuter. Cordialement."
  const [followupMessage, setFollowupMessage] = useState(DEFAULT_QUOTE_FOLLOWUP_MESSAGE)

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceModalInvoices, setInvoiceModalInvoices] = useState<InvoiceWithPayments[]>([])
  const [invoiceModalSelectedInvoice, setInvoiceModalSelectedInvoice] = useState<InvoiceWithPayments | null>(null)
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false)
  const [invoiceModalCustomMessage, setInvoiceModalCustomMessage] = useState("")
  const [pipelineMessageEditColumnId, setPipelineMessageEditColumnId] = useState<string | null>(null)
  const [pipelineMessageEditDraft, setPipelineMessageEditDraft] = useState("")

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

  const quoteColumns = useMemo(
    () => columns.filter((c) => ["all", "quote", "quote_followup1", "quote_followup2"].includes(c.id)),
    [columns]
  )
  const invoiceColumns = useMemo(
    () => columns.filter((c) => ["invoice", "invoice_followup1", "invoice_followup2"].includes(c.id)),
    [columns]
  )

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      setProspects([])
      return
    }
    setLoading(true)
    setError(null)
    fetchProspectsForUser(userId)
      .then(setProspects)
      .catch((err) => {
        console.error(err)
        setError("Impossible de charger les prospects.")
      })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!showQuoteModal || !userId) return
    setQuoteModalPdfFile(null)
    setQuoteModalSelectedQuote(null)
    const stored = getStoredPipelineMessages(userId)
    setQuoteModalCustomMessage(stored["quote"] ?? DEFAULT_QUOTE_EMAIL_MESSAGE)
    setQuoteModalQuotesLoading(true)
    const prospect = selectedProspect
    fetchQuotesForUser(userId)
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
  }, [showQuoteModal, userId, selectedProspect?.id])

  useEffect(() => {
    if (!showFollowupModal || !selectedColumn || !userId) return
    const stored = getStoredPipelineMessages(userId)
    const defaultMsg =
      selectedColumn.startsWith("quote_") ? DEFAULT_QUOTE_FOLLOWUP_MESSAGE : DEFAULT_INVOICE_FOLLOWUP_MESSAGE
    setFollowupMessage(stored[selectedColumn] ?? defaultMsg)
  }, [showFollowupModal, selectedColumn, userId])

  useEffect(() => {
    if (!showInvoiceModal || !userId) return
    setInvoiceModalSelectedInvoice(null)
    const stored = getStoredPipelineMessages(userId)
    setInvoiceModalCustomMessage(stored["invoice"] ?? DEFAULT_INVOICE_EMAIL_MESSAGE)
    setInvoiceModalLoading(true)
    const prospect = selectedProspect
    fetchInvoicesForUser(userId)
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
  }, [showInvoiceModal, userId, selectedProspect?.id])

  const refreshAfterUpdate = (updated: Prospect) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const handleRemoveProspectClick = (prospect: Prospect, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setProspectToRemove(prospect)
  }

  const handleConfirmRemoveProspect = async () => {
    if (!userId || !prospectToRemove) return
    setRemovingId(prospectToRemove.id)
    try {
      await deleteProspect(userId, prospectToRemove.id)
      setProspects((prev) => prev.filter((p) => p.id !== prospectToRemove.id))
      setProspectToRemove(null)
      toast({ title: "Prospect retiré", description: `${prospectToRemove.name} a été retiré du pipeline.` })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: "Impossible de retirer le prospect.", variant: "destructive" })
    } finally {
      setRemovingId(null)
    }
  }

  const handleSelectClient = (client: { name: string; email: string; phone?: string | null }) => {
    setNewProspect({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      company: "",
      notes: "",
    })
    setClientSearchQuery("")
  }

  const handleAddProspect = async () => {
    if (!userId || !newProspect.name.trim() || !newProspect.email.trim()) {
      toast({ title: "Nom et email requis", variant: "destructive" })
      return
    }
    setAdding(true)
    try {
      const created = await insertProspect(userId, {
        name: newProspect.name.trim(),
        email: newProspect.email.trim(),
        phone: newProspect.phone.trim() || undefined,
        company: newProspect.company.trim() || undefined,
        notes: newProspect.notes.trim() || undefined,
      })
      setProspects((prev) => [created, ...prev])
      setNewProspect({ name: "", email: "", phone: "", company: "", notes: "" })
      setClientSearchQuery("")
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
    if (!userId) return
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
      const subjectSuffix = isQuote ? "Votre devis" : "Votre facture"
      const contactBlock = buildContactBlockHtml({
        contactName: profile?.full_name,
        phone: profile?.company_phone,
        email: profile?.company_email,
        address: profile?.company_address,
        cityPostal: profile?.company_city_postal,
      })
      const stored = getStoredPipelineMessages(userId)
      const defaultMsg = isQuote ? DEFAULT_QUOTE_FOLLOWUP_MESSAGE : DEFAULT_INVOICE_FOLLOWUP_MESSAGE
      const messageText = stored[columnId]?.trim() || defaultMsg
      const htmlContent = `<p>${messageText.replace(/\n/g, "</p><p>")}</p>${contactBlock}`
      const bodyPayload = { to: prospect.email, subject: `${relanceLabel} - ${subjectSuffix}`, htmlContent }
      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify(bodyPayload),
      })
      const resText = await emailRes.text()
      const data = resText ? (() => { try { return JSON.parse(resText) } catch { return {} } })() : {}
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }
      const updated = await updateProspect(userId, prospect.id, { stage: columnId })
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
    if (!draggedItem || !userId) return

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
      const updated = await updateProspect(userId, prospect.id, { stage: targetColumnId })
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
    if (!userId || !selectedProspect) return
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

      const builtHtml =
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
          : ""

      const customMessageHtml = quoteModalCustomMessage.trim()
        ? "<p>" + quoteModalCustomMessage.trim().replace(/\n/g, "</p><p>") + "</p>"
        : ""
      const htmlContent = (customMessageHtml + builtHtml).trim() || undefined

      setStoredPipelineMessage(userId, "quote", quoteModalCustomMessage)

      const emailRes = await fetch("/api/send-quote-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
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
      if (quoteModalSelectedQuote && userId) {
        try {
          await updateQuoteStatus(quoteModalSelectedQuote.id, userId, 'validé');
          await createInvoiceFromQuote(userId, quoteModalSelectedQuote);
        } catch (err) {
          console.error('Error updating quote status:', err);
          // Ne pas bloquer le processus si la mise à jour du statut échoue
        }
      }

      const updated = await updateProspect(userId, selectedProspect.id, { stage: "quote" })
      refreshAfterUpdate(updated)
      setShowQuoteModal(false)
      setSelectedProspect(null)
      setDraggedItem(null)
      setQuoteModalPdfFile(null)
      setQuoteModalSelectedQuote(null)
      setQuoteModalCustomMessage("")
      toast({
        title: "Email envoyé",
        description: "Le devis a été envoyé au prospect." + (quoteModalSelectedQuote && userId ? " La facture correspondante a été créée dans la page Factures." : ""),
      })
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
    setQuoteModalCustomMessage("")
  }

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false)
    setSelectedProspect(null)
    setDraggedItem(null)
    setInvoiceModalSelectedInvoice(null)
  }

  const handleInvoiceConfirm = async () => {
    if (!userId || !selectedProspect || !invoiceModalSelectedInvoice) return
    if (!invoiceModalSelectedInvoice.client_email?.trim()) {
      toast({ title: "Erreur", description: "Cette facture n'a pas d'email client.", variant: "destructive" })
      return
    }
    setUpdatingStage(true)
    try {
      const builtInvoiceHtml = buildInvoiceEmailHtml({
        clientName: invoiceModalSelectedInvoice.client_name ?? "",
        clientEmail: invoiceModalSelectedInvoice.client_email,
        clientPhone: invoiceModalSelectedInvoice.client_phone,
        clientAddress: invoiceModalSelectedInvoice.client_address,
        invoiceNumber: invoiceModalSelectedInvoice.invoice_number ?? "",
        items: invoiceModalSelectedInvoice.items ?? [],
        subtotalHt: invoiceModalSelectedInvoice.subtotal_ht ?? 0,
        tvaAmount: invoiceModalSelectedInvoice.tva_amount ?? 0,
        total: invoiceModalSelectedInvoice.total_ttc ?? 0,
        dueDate: invoiceModalSelectedInvoice.due_date ?? new Date().toISOString(),
        paymentTerms: invoiceModalSelectedInvoice.payment_terms ?? "",
        companyName: profile?.full_name ?? undefined,
        companyAddress: profile?.company_address != null ? profile.company_address : undefined,
        companyCityPostal: profile?.company_city_postal != null ? profile.company_city_postal : undefined,
        companyPhone: profile?.company_phone != null ? profile.company_phone : undefined,
        companyEmail: profile?.company_email != null ? profile.company_email : undefined,
        contactBlock: {
          contactName: profile?.full_name,
          phone: profile?.company_phone,
          email: profile?.company_email,
          address: profile?.company_address,
          cityPostal: profile?.company_city_postal,
        },
      })
      const customInvoiceHtml = invoiceModalCustomMessage.trim()
        ? "<p>" + invoiceModalCustomMessage.trim().replace(/\n/g, "</p><p>") + "</p>"
        : ""
      const invoiceHtml = (customInvoiceHtml + builtInvoiceHtml).trim() || builtInvoiceHtml

      setStoredPipelineMessage(userId, "invoice", invoiceModalCustomMessage)

      const emailRes = await fetch(
        `/api/invoices/${invoiceModalSelectedInvoice.id}/send-email`,
        {
          method: "POST",
          headers: getApiPostHeaders(session?.access_token),
          body: JSON.stringify({
            userId,
            to: selectedProspect.email,
            subject: `Facture ${invoiceModalSelectedInvoice.invoice_number}`,
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
      const updated = await updateProspect(userId, selectedProspect.id, { stage: "invoice" })
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
    if (!userId || !selectedProspect || !selectedColumn) return

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
      const bodyPayload2 = { to: selectedProspect.email, subject: `${relanceLabel} - ${subjectSuffix}`, htmlContent }
      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify(bodyPayload2),
      })
      const resText2 = await emailRes.text()
      const data = resText2 ? (() => { try { return JSON.parse(resText2) } catch { return {} } })() : {}
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }

      setStoredPipelineMessage(userId, selectedColumn, followupMessage)

      const updated = await updateProspect(userId, selectedProspect.id, { stage: selectedColumn })
      refreshAfterUpdate(updated)
      setShowFollowupModal(false)
      setSelectedProspect(null)
      setSelectedColumn("")
      setDraggedItem(null)
      toast({ title: "Relance envoyée", description: "L'email de relance a été envoyé au prospect." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la relance.", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  if (!userId) {
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
            if (!userId) return
            setError(null)
            setLoading(true)
            fetchProspectsForUser(userId)
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
          <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Nouveau prospect</DialogTitle>
              <DialogDescription className="text-white/70">
                Ajoutez un prospect à votre pipeline. Il apparaîtra dans &quot;Tous les prospects&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 pr-2">
              {clients.length > 0 && (
                <div className="space-y-2 py-2">
                  <Label className="text-white text-sm">Sélectionner un client (recherche optionnelle)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                    <Input
                      placeholder="Rechercher un client (nom, email, téléphone)..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>
                  {(() => {
                    const q = clientSearchQuery.trim().toLowerCase()
                    const filtered = q
                      ? clients.filter(
                          (c) =>
                            c.name?.toLowerCase().includes(q) ||
                            c.email?.toLowerCase().includes(q) ||
                            (c.phone ?? "").includes(q)
                        )
                      : clients
                    return filtered.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 rounded-lg p-2 bg-black/10">
                        {filtered.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className="w-full text-left p-2 rounded-md border border-white/10 bg-black/20 hover:bg-white/10 transition-colors flex flex-col gap-1"
                          >
                            <span className="font-medium text-white text-sm">{client.name}</span>
                            <span className="text-xs text-white/70 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </span>
                            {client.phone && (
                              <span className="text-xs text-white/70 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.phone}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-white/50 py-2">Aucun client trouvé</p>
                    )
                  })()}
                </div>
              )}
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
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
                onClick={() => {
                  setAddDialogOpen(false)
                  setClientSearchQuery("")
                }}
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

      <div className="space-y-6 w-full">
        {/* Ligne 1 : Devis */}
        <div>
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Devis</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-md:flex max-md:overflow-x-auto max-md:gap-4 max-md:snap-x max-md:snap-mandatory max-md:pb-2 max-md:overflow-y-visible">
            {quoteColumns.map((column) => (
              <Card
                key={column.id}
                className="bg-black/20 backdrop-blur-xl border border-white/10 text-white min-w-0 overflow-hidden flex flex-col max-md:min-w-[280px] max-md:snap-start max-md:flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
                <CardHeader className="p-4 pb-2 flex-shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold text-white break-words leading-snug" title={column.name}>{column.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1.5 text-white/80 rounded-full">
                        {column.items.length}
                      </Badge>
                    </div>
                    {column.id !== "all" && (
                      <Popover
                        open={pipelineMessageEditColumnId === column.id}
                        onOpenChange={(open) => {
                          if (open) {
                            setPipelineMessageEditColumnId(column.id)
                            setPipelineMessageEditDraft(getStoredPipelineMessages(userId)[column.id] ?? getDefaultMessageForColumn(column.id))
                          } else {
                            setPipelineMessageEditColumnId(null)
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-white/70 hover:text-white" title="Personnaliser le message">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px]" align="end">
                          <p className="text-sm font-medium mb-2">Message pour : {column.name}</p>
                          <Textarea
                            value={pipelineMessageEditColumnId === column.id ? pipelineMessageEditDraft : ""}
                            onChange={(e) => setPipelineMessageEditDraft(e.target.value)}
                            rows={5}
                            className="mb-3 resize-none"
                            placeholder="Message personnalisé..."
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              if (pipelineMessageEditColumnId) {
                                setStoredPipelineMessage(userId, pipelineMessageEditColumnId, pipelineMessageEditDraft)
                                setPipelineMessageEditColumnId(null)
                                toast({ title: "Message enregistré" })
                              }
                            }}
                          >
                            Enregistrer
                          </Button>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 min-w-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                  <div className="min-h-[120px] grid grid-cols-1 auto-rows-min gap-2 min-w-0 overflow-y-auto overflow-x-hidden flex-1 content-start">
                    {column.items.map((prospect) => (
                      <motion.div
                        key={prospect.id}
                        draggable
                        onDragStart={() => handleDragStart(prospect, column.id)}
                        className="group relative shrink-0 p-4 pr-10 bg-black/30 border border-white/10 rounded-xl cursor-move hover:bg-white/10 transition-colors text-white overflow-hidden min-w-0"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 max-md:h-11 max-md:min-h-[44px] max-md:min-w-[44px] max-md:w-11 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 disabled:opacity-100 hover:bg-white/10 text-white/70 hover:text-white transition-opacity"
                          onClick={(e) => handleRemoveProspectClick(prospect, e)}
                          disabled={removingId === prospect.id}
                          title="Retirer du pipeline"
                        >
                          {removingId === prospect.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                        <div className="space-y-2 min-w-0 break-words">
                          <p className="font-semibold text-sm text-white break-words leading-tight">{prospect.name}</p>
                          <div className="flex items-start gap-1.5 text-xs text-white/70 min-w-0">
                            <Mail className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="break-all min-w-0">{prospect.email}</span>
                          </div>
                          {prospect.phone && (
                            <div className="flex items-start gap-1.5 text-xs text-white/70 min-w-0">
                              <Phone className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="break-all min-w-0">{prospect.phone}</span>
                            </div>
                          )}
                          {prospect.company && (
                            <p className="text-xs text-white/60 break-words min-w-0">{prospect.company}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {column.items.length === 0 && (
                      <p className="text-sm text-white/50 text-center py-10">Aucun prospect</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Ligne 2 : Factures */}
        <div>
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Factures</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-md:flex max-md:overflow-x-auto max-md:gap-4 max-md:snap-x max-md:snap-mandatory max-md:pb-2 max-md:overflow-y-visible">
            {invoiceColumns.map((column) => (
              <Card
                key={column.id}
                className="bg-black/20 backdrop-blur-xl border border-white/10 text-white min-w-0 overflow-hidden flex flex-col max-md:min-w-[280px] max-md:snap-start max-md:flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
                <CardHeader className="p-4 pb-2 flex-shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold text-white break-words leading-snug" title={column.name}>{column.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1.5 text-white/80 rounded-full">
                        {column.items.length}
                      </Badge>
                    </div>
                    <Popover
                      open={pipelineMessageEditColumnId === column.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setPipelineMessageEditColumnId(column.id)
                          setPipelineMessageEditDraft(getStoredPipelineMessages(userId)[column.id] ?? getDefaultMessageForColumn(column.id))
                        } else {
                          setPipelineMessageEditColumnId(null)
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-white/70 hover:text-white" title="Personnaliser le message">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px]" align="end">
                        <p className="text-sm font-medium mb-2">Message pour : {column.name}</p>
                        <Textarea
                          value={pipelineMessageEditColumnId === column.id ? pipelineMessageEditDraft : ""}
                          onChange={(e) => setPipelineMessageEditDraft(e.target.value)}
                          rows={5}
                          className="mb-3 resize-none"
                          placeholder="Message personnalisé..."
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (pipelineMessageEditColumnId) {
                              setStoredPipelineMessage(userId, pipelineMessageEditColumnId, pipelineMessageEditDraft)
                              setPipelineMessageEditColumnId(null)
                              toast({ title: "Message enregistré" })
                            }
                          }}
                        >
                          Enregistrer
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 min-w-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                  <div className="min-h-[120px] grid grid-cols-1 auto-rows-min gap-2 min-w-0 overflow-y-auto overflow-x-hidden flex-1 content-start">
                    {column.items.map((prospect) => (
                      <motion.div
                        key={prospect.id}
                        draggable
                        onDragStart={() => handleDragStart(prospect, column.id)}
                        className="group relative shrink-0 p-4 pr-10 bg-black/30 border border-white/10 rounded-xl cursor-move hover:bg-white/10 transition-colors text-white overflow-hidden min-w-0"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 max-md:h-11 max-md:min-h-[44px] max-md:min-w-[44px] max-md:w-11 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 disabled:opacity-100 hover:bg-white/10 text-white/70 hover:text-white transition-opacity"
                          onClick={(e) => handleRemoveProspectClick(prospect, e)}
                          disabled={removingId === prospect.id}
                          title="Retirer du pipeline"
                        >
                          {removingId === prospect.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                        <div className="space-y-2 min-w-0 break-words">
                          <p className="font-semibold text-sm text-white break-words leading-tight">{prospect.name}</p>
                          <div className="flex items-start gap-1.5 text-xs text-white/70 min-w-0">
                            <Mail className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="break-all min-w-0">{prospect.email}</span>
                          </div>
                          {prospect.phone && (
                            <div className="flex items-start gap-1.5 text-xs text-white/70 min-w-0">
                              <Phone className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="break-all min-w-0">{prospect.phone}</span>
                            </div>
                          )}
                          {prospect.company && (
                            <p className="text-xs text-white/60 break-words min-w-0">{prospect.company}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {column.items.length === 0 && (
                      <p className="text-sm text-white/50 text-center py-10">Aucun prospect</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
                      id="quote-modal-pdf"
                      name="quotePdf"
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

              <div>
                <Label className="text-white/80 text-sm font-medium">Message personnalisé</Label>
                <p className="text-xs text-white/50 mb-1">Ce message sera affiché dans l’email envoyé au prospect.</p>
                <Textarea
                  value={quoteModalCustomMessage}
                  onChange={(e) => setQuoteModalCustomMessage(e.target.value)}
                  onBlur={() => userId && setStoredPipelineMessage(userId, "quote", quoteModalCustomMessage)}
                  placeholder={DEFAULT_QUOTE_EMAIL_MESSAGE}
                  className="mt-1 min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/40 resize-y"
                  rows={4}
                />
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
              <div>
                <Label className="text-white/80 text-sm font-medium">Message personnalisé</Label>
                <p className="text-xs text-white/50 mb-1">Ce message sera affiché dans l’email envoyé au prospect.</p>
                <Textarea
                  value={invoiceModalCustomMessage}
                  onChange={(e) => setInvoiceModalCustomMessage(e.target.value)}
                  onBlur={() => userId && setStoredPipelineMessage(userId, "invoice", invoiceModalCustomMessage)}
                  placeholder={DEFAULT_INVOICE_EMAIL_MESSAGE}
                  className="mt-1 min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/40 resize-y"
                  rows={4}
                />
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
                <label className="text-sm font-medium mb-2 block" htmlFor="followup-message">Message (modifiable, enregistré pour cette étape):</label>
                <textarea
                  id="followup-message"
                  name="followupMessage"
                  className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 min-h-[150px]"
                  value={followupMessage}
                  onChange={(e) => setFollowupMessage(e.target.value)}
                  onBlur={() => userId && selectedColumn && setStoredPipelineMessage(userId, selectedColumn, followupMessage)}
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

      <AlertDialog open={!!prospectToRemove} onOpenChange={(open) => !open && setProspectToRemove(null)}>
        <AlertDialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Retirer le prospect du pipeline ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Êtes-vous sûr de vouloir retirer {prospectToRemove ? (
                <>« {prospectToRemove.name} » ({prospectToRemove.email})</>
              ) : null} du pipeline CRM ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRemoveProspect()
              }}
              disabled={removingId !== null}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {prospectToRemove && removingId === prospectToRemove.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
