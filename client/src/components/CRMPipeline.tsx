import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
import { Mail, Phone, Plus, Loader2, Search } from "lucide-react"
import { getApiPostHeaders } from "@/lib/apiHeaders"
import { useAuth } from "@/context/AuthContext"
import { useTeamEffectiveUserId } from "@/context/TeamEffectiveUserIdContext"
import { useUserSettings } from "@/context/UserSettingsContext"
import { useChantiers } from "@/context/ChantiersContext"
import {
  type Prospect,
  type ProspectStage,
  type ProspectUpdatePayload,
  fetchProspectsForUser,
  insertProspect,
  updateProspect,
  deleteProspect,
} from "@/lib/supabaseProspects"
import { fetchQuotesForUser, updateQuoteStatus, type SupabaseQuote } from "@/lib/supabaseQuotes"
import { fetchInvoicesForUser, type InvoiceWithPayments } from "@/lib/supabaseInvoices"
import { getQuotePdfBase64, fetchLogoDataUrl, buildQuoteEmailHtml, buildContactBlockHtml, type QuotePdfParams } from "@/lib/quotePdf"
import { buildInvoiceEmailHtml } from "@/lib/invoicePdf"
import { toast } from "@/hooks/use-toast"

import { PipelineColumn } from "./crm/PipelineColumn"
import { ProspectDetailPanel } from "./crm/ProspectDetailPanel"
import { QuoteModal, InvoiceModal, FollowupModal } from "./crm/CRMModals"

/* ────────────── Column definitions ────────────── */

interface ColumnDef { id: string; name: string }

const QUOTE_COLUMNS: ColumnDef[] = [
  { id: "all", name: "Nouveau prospect" },
  { id: "quote", name: "Devis envoyé" },
  { id: "quote_followup1", name: "Relance devis 1" },
  { id: "quote_followup2", name: "Relance devis 2" },
]

const INVOICE_COLUMNS: ColumnDef[] = [
  { id: "invoice", name: "Facture envoyée" },
  { id: "invoice_followup1", name: "Relance facture 1" },
  { id: "invoice_followup2", name: "Relance facture 2" },
]

const TERMINAL_COLUMNS: ColumnDef[] = [
  { id: "won", name: "Gagné" },
  { id: "lost", name: "Perdu" },
]

const ALL_COLUMNS = [...QUOTE_COLUMNS, ...INVOICE_COLUMNS, ...TERMINAL_COLUMNS]

/* ────────────── Message storage ────────────── */

const DEFAULT_THEME_COLOR = "#8b5cf6"

const DEFAULT_QUOTE_EMAIL_MESSAGE =
  "Bonjour,\n\nVeuillez trouver ci-joint notre devis. N'hésitez pas à nous contacter pour toute question.\n\nCordialement"
const DEFAULT_INVOICE_EMAIL_MESSAGE =
  "Bonjour,\n\nVeuillez trouver ci-joint notre facture. N'hésitez pas à nous contacter pour toute question.\n\nCordialement"
const DEFAULT_QUOTE_FOLLOWUP =
  "Bonjour, je souhaite faire un suivi concernant notre échange précédent et le devis que je vous ai transmis. N'hésitez pas à me recontacter pour en discuter. Cordialement."
const DEFAULT_INVOICE_FOLLOWUP =
  "Bonjour, je souhaite faire un suivi concernant la facture que je vous ai transmise. N'hésitez pas à me recontacter pour régler ou en discuter. Cordialement."

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
  } catch { return {} }
}

function setStoredPipelineMessage(userId: string | null, key: string, value: string): void {
  if (!userId || typeof window === "undefined") return
  try {
    const prev = getStoredPipelineMessages(userId)
    localStorage.setItem(`${PIPELINE_MESSAGES_STORAGE_KEY}_${userId}`, JSON.stringify({ ...prev, [key]: value }))
  } catch { /* ignore */ }
}

/* ────────────── Main Component ────────────── */

export function CRMPipeline() {
  const { user, session } = useAuth()
  const effectiveUserId = useTeamEffectiveUserId()
  const userId = effectiveUserId ?? user?.id ?? null
  const { profile, logoUrl, themeColor } = useUserSettings()
  const { clients } = useChantiers()
  const accentColor = themeColor || DEFAULT_THEME_COLOR
  const userReplyToEmail = profile?.company_email || user?.email || null

  // ─── Data ───
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Add dialog ───
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
  const [newProspect, setNewProspect] = useState({ name: "", email: "", phone: "", company: "", notes: "" })
  const [adding, setAdding] = useState(false)

  // ─── Drag & drop ───
  const [draggedItem, setDraggedItem] = useState<{ prospect: Prospect; columnId: string } | null>(null)

  // ─── Modals ───
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [selectedColumn, setSelectedColumn] = useState("")
  const [updatingStage, setUpdatingStage] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [prospectToRemove, setProspectToRemove] = useState<Prospect | null>(null)

  // ─── Quote modal state ───
  const [quoteModalPdfFile, setQuoteModalPdfFile] = useState<File | null>(null)
  const [quoteModalSelectedQuote, setQuoteModalSelectedQuote] = useState<SupabaseQuote | null>(null)
  const [quoteModalQuotes, setQuoteModalQuotes] = useState<SupabaseQuote[]>([])
  const [quoteModalQuotesLoading, setQuoteModalQuotesLoading] = useState(false)
  const [quoteModalDragOver, setQuoteModalDragOver] = useState(false)
  const [quoteModalCustomMessage, setQuoteModalCustomMessage] = useState("")

  // ─── Invoice modal state ───
  const [invoiceModalInvoices, setInvoiceModalInvoices] = useState<InvoiceWithPayments[]>([])
  const [invoiceModalSelectedInvoice, setInvoiceModalSelectedInvoice] = useState<InvoiceWithPayments | null>(null)
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false)
  const [invoiceModalCustomMessage, setInvoiceModalCustomMessage] = useState("")

  // ─── Followup modal state ───
  const [followupMessage, setFollowupMessage] = useState(DEFAULT_QUOTE_FOLLOWUP)

  // ─── Column message editor ───
  const [pipelineMessageEditColumnId, setPipelineMessageEditColumnId] = useState<string | null>(null)
  const [pipelineMessageEditDraft, setPipelineMessageEditDraft] = useState("")

  // ─── Detail panel ───
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Linked documents for detail panel ───
  const [allQuotes, setAllQuotes] = useState<SupabaseQuote[]>([])
  const [allInvoices, setAllInvoices] = useState<InvoiceWithPayments[]>([])

  /* ────────────── Computed columns ────────────── */

  const columnsMap = useMemo(() => {
    const map: Record<string, Prospect[]> = {}
    for (const col of ALL_COLUMNS) map[col.id] = []

    for (const p of prospects) {
      const stage = p.stage
      if (stage === "followup1") { map["quote_followup1"]?.push(p); continue }
      if (stage === "followup2") { map["quote_followup2"]?.push(p); continue }
      if (stage === "followup3") { map["invoice_followup1"]?.push(p); continue }
      if (stage === "followup4") { map["invoice_followup2"]?.push(p); continue }
      if (map[stage]) map[stage].push(p)
      else map["all"].push(p)
    }
    return map
  }, [prospects])

  /* ────────────── Data loading ────────────── */

  const loadProspects = useCallback(async () => {
    if (!userId) { setLoading(false); setProspects([]); return }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProspectsForUser(userId)
      setProspects(data)
    } catch (err) {
      console.error(err)
      setError("Impossible de charger les prospects.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadProspects() }, [loadProspects])

  useEffect(() => {
    if (!userId) return
    fetchQuotesForUser(userId).then(setAllQuotes).catch(() => setAllQuotes([]))
    fetchInvoicesForUser(userId).then(setAllInvoices).catch(() => setAllInvoices([]))
  }, [userId])

  /* ────────────── Modal data loading ────────────── */

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
        setAllQuotes(quotes)
        if (prospect && quotes.length > 0) {
          const norm = (s: string) => (s ?? "").trim().toLowerCase()
          const match = quotes.find((q) => norm(q.client_email ?? "") === norm(prospect.email))
          if (match) setQuoteModalSelectedQuote(match)
        }
      })
      .catch(() => setQuoteModalQuotes([]))
      .finally(() => setQuoteModalQuotesLoading(false))
  }, [showQuoteModal, userId, selectedProspect?.id])

  useEffect(() => {
    if (!showFollowupModal || !selectedColumn || !userId) return
    const stored = getStoredPipelineMessages(userId)
    const defaultMsg = selectedColumn.startsWith("quote_") ? DEFAULT_QUOTE_FOLLOWUP : DEFAULT_INVOICE_FOLLOWUP
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
        setAllInvoices(invoices)
        if (prospect && invoices.length > 0) {
          const norm = (s: string) => (s ?? "").trim().toLowerCase()
          const match = invoices.find((inv) => norm(inv.client_email ?? "") === norm(prospect.email))
          if (match) setInvoiceModalSelectedInvoice(match)
        }
      })
      .catch(() => setInvoiceModalInvoices([]))
      .finally(() => setInvoiceModalLoading(false))
  }, [showInvoiceModal, userId, selectedProspect?.id])

  /* ────────────── Helpers ────────────── */

  const refreshAfterUpdate = (updated: Prospect) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (detailProspect?.id === updated.id) setDetailProspect(updated)
  }

  /* ────────────── Prospect CRUD ────────────── */

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
    setNewProspect({ name: client.name, email: client.email, phone: client.phone || "", company: "", notes: "" })
    setClientSearchQuery("")
  }

  /* ────────────── Stage movement ────────────── */

  const moveProspectToStage = async (prospect: Prospect, targetStage: ProspectStage) => {
    if (!userId) return

    if (targetStage === "quote") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetStage)
      setShowQuoteModal(true)
      return
    }
    if (targetStage === "invoice") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetStage)
      setShowInvoiceModal(true)
      return
    }
    if (targetStage === "quote_followup1" || targetStage === "quote_followup2") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetStage)
      setShowFollowupModal(true)
      return
    }
    if (targetStage === "invoice_followup1" || targetStage === "invoice_followup2") {
      setSelectedProspect(prospect)
      setSelectedColumn(targetStage)
      setShowFollowupModal(true)
      return
    }

    setUpdatingStage(true)
    try {
      const updates: ProspectUpdatePayload = {
        stage: targetStage,
        last_action_at: new Date().toISOString(),
        last_action_type: targetStage === 'won' ? 'Marqué gagné' : targetStage === 'lost' ? 'Marqué perdu' : 'Déplacé',
      }
      const updated = await updateProspect(userId, prospect.id, updates)
      refreshAfterUpdate(updated)
      if (targetStage === 'won') toast({ title: "Prospect gagné !", description: `${prospect.name} a été marqué comme gagné.` })
      else if (targetStage === 'lost') toast({ title: "Prospect perdu", description: `${prospect.name} a été marqué comme perdu.` })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur lors du déplacement", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  /* ────────────── Drag & drop ────────────── */

  const handleDragStart = (prospect: Prospect, columnId: string) => {
    setDraggedItem({ prospect, columnId })
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedItem || !userId) return
    const { prospect, columnId: sourceColumnId } = draggedItem
    setDraggedItem(null)
    if (sourceColumnId === targetColumnId) return
    await moveProspectToStage(prospect, targetColumnId as ProspectStage)
  }

  /* ────────────── Email sending ────────────── */

  function quoteToPdfParams(quote: SupabaseQuote): QuotePdfParams {
    const items = (quote.items ?? []).map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
      subItems: i.subItems?.map((s) => ({ description: s.description, quantity: s.quantity, unitPrice: s.unitPrice, total: s.total })),
    }))
    return {
      clientInfo: { name: quote.client_name ?? "", email: quote.client_email ?? "", phone: quote.client_phone ?? "", address: quote.client_address ?? "" },
      projectType: quote.project_type ?? "",
      projectDescription: quote.project_description ?? "",
      validityDays: String(quote.validity_days ?? 30),
      items,
      subtotal: quote.total_ht,
      tva: quote.total_ttc - quote.total_ht,
      total: quote.total_ttc,
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
        params.companyName = profile?.company_name || profile?.full_name || undefined
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
          fr.onload = () => resolve((fr.result as string).split(",")[1] ?? "")
          fr.onerror = () => reject(fr.error)
          fr.readAsDataURL(quoteModalPdfFile)
        })
        fileName = quoteModalPdfFile.name || "devis.pdf"
      } else { setUpdatingStage(false); return }

      const builtHtml = quoteModalSelectedQuote
        ? buildQuoteEmailHtml({
            clientName: quoteModalSelectedQuote.client_name ?? "",
            clientAddress: quoteModalSelectedQuote.client_address ?? undefined,
            clientPhone: quoteModalSelectedQuote.client_phone ?? undefined,
            clientEmail: quoteModalSelectedQuote.client_email ?? undefined,
            total: quoteModalSelectedQuote.total_ttc ?? 0,
            subtotal: quoteModalSelectedQuote.total_ht ?? undefined,
            tva: (quoteModalSelectedQuote.total_ttc ?? 0) - (quoteModalSelectedQuote.total_ht ?? 0),
            validityDays: String(quoteModalSelectedQuote.validity_days ?? 30),
            companyName: profile?.company_name || profile?.full_name || undefined,
            quoteNumber: undefined,
            items: (quoteModalSelectedQuote.items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, subItems: i.subItems })),
            contactBlock: { contactName: profile?.full_name, phone: profile?.company_phone, email: profile?.company_email, address: profile?.company_address, cityPostal: profile?.company_city_postal },
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
        body: JSON.stringify({ to: selectedProspect.email, pdfBase64, fileName, htmlContent, replyTo: userReplyToEmail }),
      })
      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email.", variant: "destructive" })
        return
      }

      if (quoteModalSelectedQuote && userId) {
        try {
          await updateQuoteStatus(quoteModalSelectedQuote.id, userId, 'validé')
          // Note: La facture ne sera créée que manuellement quand le devis est confirmé par le client
          // (via le bouton "Valider le devis" dans ProjectsPage ou manuellement dans Factures)
        } catch (err) { console.error('Error updating quote status:', err) }
      }

      const prospectUpdates: ProspectUpdatePayload = {
        stage: "quote",
        last_action_at: new Date().toISOString(),
        last_action_type: "Devis envoyé",
      }
      if (quoteModalSelectedQuote) prospectUpdates.linked_quote_id = quoteModalSelectedQuote.id

      const updated = await updateProspect(userId, selectedProspect.id, prospectUpdates)
      refreshAfterUpdate(updated)
      setShowQuoteModal(false)
      setSelectedProspect(null)
      setDraggedItem(null)
      setQuoteModalPdfFile(null)
      setQuoteModalSelectedQuote(null)
      setQuoteModalCustomMessage("")
      toast({
        title: "Email envoyé",
        description: "Le devis a été envoyé au prospect." + (quoteModalSelectedQuote ? " La facture correspondante a été créée dans la page Factures." : ""),
      })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer l'email.", variant: "destructive" })
    } finally { setUpdatingStage(false) }
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
        companyName: profile?.company_name || profile?.full_name || undefined,
        companyAddress: profile?.company_address != null ? profile.company_address : undefined,
        companyCityPostal: profile?.company_city_postal != null ? profile.company_city_postal : undefined,
        companyPhone: profile?.company_phone != null ? profile.company_phone : undefined,
        companyEmail: profile?.company_email != null ? profile.company_email : undefined,
        contactBlock: { contactName: profile?.full_name, phone: profile?.company_phone, email: profile?.company_email, address: profile?.company_address, cityPostal: profile?.company_city_postal },
      })
      const customInvoiceHtml = invoiceModalCustomMessage.trim()
        ? "<p>" + invoiceModalCustomMessage.trim().replace(/\n/g, "</p><p>") + "</p>"
        : ""
      const invoiceHtml = (customInvoiceHtml + builtInvoiceHtml).trim() || builtInvoiceHtml

      setStoredPipelineMessage(userId, "invoice", invoiceModalCustomMessage)

      const toEmail = (selectedProspect.email?.trim() || invoiceModalSelectedInvoice.client_email?.trim()) ?? ""
      const emailRes = await fetch(`/api/invoices/${invoiceModalSelectedInvoice.id}/send-email`, {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({ userId, to: toEmail, subject: `Facture ${invoiceModalSelectedInvoice.invoice_number}`, message: invoiceHtml, replyTo: userReplyToEmail }),
      })
      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer la facture par email.", variant: "destructive" })
        return
      }

      const prospectUpdates: ProspectUpdatePayload = {
        stage: "invoice",
        last_action_at: new Date().toISOString(),
        last_action_type: "Facture envoyée",
        linked_invoice_id: invoiceModalSelectedInvoice.id,
      }
      const updated = await updateProspect(userId, selectedProspect.id, prospectUpdates)
      refreshAfterUpdate(updated)
      closeInvoiceModal()
      toast({ title: "Facture envoyée", description: "La facture a été envoyée au prospect." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la facture.", variant: "destructive" })
    } finally { setUpdatingStage(false) }
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
        selectedColumn === "quote_followup1" ? "Relance devis 1" :
        selectedColumn === "quote_followup2" ? "Relance devis 2" :
        selectedColumn === "invoice_followup1" ? "Relance facture 1" : "Relance facture 2"
      const subjectSuffix = selectedColumn.startsWith("quote_") ? "Votre devis" : "Votre facture"

      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({ to: selectedProspect.email, subject: `${relanceLabel} - ${subjectSuffix}`, htmlContent, replyTo: userReplyToEmail }),
      })
      const resText = await emailRes.text()
      const data = resText ? (() => { try { return JSON.parse(resText) } catch { return {} } })() : {}
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }

      setStoredPipelineMessage(userId, selectedColumn, followupMessage)

      const prospectUpdates: ProspectUpdatePayload = {
        stage: selectedColumn,
        last_action_at: new Date().toISOString(),
        last_action_type: relanceLabel,
      }
      const updated = await updateProspect(userId, selectedProspect.id, prospectUpdates)
      refreshAfterUpdate(updated)
      setShowFollowupModal(false)
      setSelectedProspect(null)
      setSelectedColumn("")
      setDraggedItem(null)
      toast({ title: "Relance envoyée", description: "L'email de relance a été envoyé au prospect." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la relance.", variant: "destructive" })
    } finally { setUpdatingStage(false) }
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

  /* ────────────── Detail panel ────────────── */

  const handleOpenDetail = (prospect: Prospect) => {
    setDetailProspect(prospect)
    setDetailOpen(true)
  }

  const handleDetailSave = async (updates: Record<string, string>) => {
    if (!userId || !detailProspect) return
    const updated = await updateProspect(userId, detailProspect.id, {
      ...updates,
      last_action_at: new Date().toISOString(),
      last_action_type: "Mise à jour",
    })
    refreshAfterUpdate(updated)
    toast({ title: "Prospect mis à jour" })
  }

  const linkedQuoteForDetail = useMemo(() => {
    if (!detailProspect?.linkedQuoteId) return null
    return allQuotes.find((q) => q.id === detailProspect.linkedQuoteId) ?? null
  }, [detailProspect?.linkedQuoteId, allQuotes])

  const linkedInvoiceForDetail = useMemo(() => {
    if (!detailProspect?.linkedInvoiceId) return null
    return allInvoices.find((inv) => inv.id === detailProspect.linkedInvoiceId) ?? null
  }, [detailProspect?.linkedInvoiceId, allInvoices])

  /* ────────────── Column message helpers ────────────── */

  const handleEditColumnOpen = (columnId: string, currentMessage: string) => {
    setPipelineMessageEditColumnId(columnId)
    setPipelineMessageEditDraft(getStoredPipelineMessages(userId)[columnId] ?? currentMessage)
  }

  const handleSaveColumnMessage = (columnId: string, message: string) => {
    setStoredPipelineMessage(userId, columnId, message)
    setPipelineMessageEditColumnId(null)
  }

  /* ────────────── Render helpers ────────────── */

  const renderColumnGroup = (label: string, columns: ColumnDef[], gridCols: string, isTerminal?: boolean) => (
    <div>
      <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">{label}</p>
      <div className={`grid grid-cols-1 ${gridCols} gap-4 max-md:flex max-md:overflow-x-auto max-md:gap-4 max-md:snap-x max-md:snap-mandatory max-md:pb-2 max-md:overflow-y-visible`}>
        {columns.map((col) => (
          <PipelineColumn
            key={col.id}
            id={col.id}
            name={col.name}
            items={columnsMap[col.id] || []}
            removingId={removingId}
            editingColumnId={pipelineMessageEditColumnId}
            editDraft={pipelineMessageEditDraft}
            defaultMessage={getDefaultMessageForColumn(col.id)}
            userId={userId}
            isTerminal={isTerminal}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
            onDragStart={handleDragStart}
            onRemove={handleRemoveProspectClick}
            onOpenDetail={handleOpenDetail}
            onMoveToStage={(prospect, stage) => moveProspectToStage(prospect, stage)}
            onEditColumnOpen={handleEditColumnOpen}
            onEditColumnClose={() => setPipelineMessageEditColumnId(null)}
            onEditDraftChange={setPipelineMessageEditDraft}
            onSaveMessage={handleSaveColumnMessage}
          />
        ))}
      </div>
    </div>
  )

  /* ────────────── Guards ────────────── */

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
        <Button variant="outline" className="mt-4 text-white border-white/20 hover:bg-white/10" onClick={loadProspects}>
          Réessayer
        </Button>
      </div>
    )
  }

  /* ────────────── Main render ────────────── */

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
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
                Ajoutez un prospect à votre pipeline. Il apparaîtra dans &quot;Nouveau prospect&quot;.
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
                      ? clients.filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || (c.phone ?? "").includes(q))
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
                              <Mail className="h-3 w-3" />{client.email}
                            </span>
                            {client.phone && (
                              <span className="text-xs text-white/70 flex items-center gap-1">
                                <Phone className="h-3 w-3" />{client.phone}
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
                  <Input value={newProspect.name} onChange={(e) => setNewProspect((p) => ({ ...p, name: e.target.value }))} placeholder="Nom du prospect" className="bg-black/20 border-white/10 text-white placeholder:text-white/50" />
                </div>
                <div>
                  <Label className="text-white">Email</Label>
                  <Input type="email" value={newProspect.email} onChange={(e) => setNewProspect((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.com" className="bg-black/20 border-white/10 text-white placeholder:text-white/50" />
                </div>
                <div>
                  <Label className="text-white">Téléphone</Label>
                  <Input value={newProspect.phone} onChange={(e) => setNewProspect((p) => ({ ...p, phone: e.target.value }))} placeholder="06 12 34 56 78" className="bg-black/20 border-white/10 text-white placeholder:text-white/50" />
                </div>
                <div>
                  <Label className="text-white">Entreprise</Label>
                  <Input value={newProspect.company} onChange={(e) => setNewProspect((p) => ({ ...p, company: e.target.value }))} placeholder="Nom de l'entreprise" className="bg-black/20 border-white/10 text-white placeholder:text-white/50" />
                </div>
                <div>
                  <Label className="text-white">Notes</Label>
                  <Textarea value={newProspect.notes} onChange={(e) => setNewProspect((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes..." rows={3} className="bg-black/20 border-white/10 text-white placeholder:text-white/50" />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={() => { setAddDialogOpen(false); setClientSearchQuery("") }}>
                Annuler
              </Button>
              <Button onClick={handleAddProspect} disabled={adding || !newProspect.name.trim() || !newProspect.email.trim()} className="bg-white/20 text-white border border-white/10 hover:bg-white/30">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline columns */}
      <div className="space-y-6 w-full">
        {renderColumnGroup("Devis", QUOTE_COLUMNS, "sm:grid-cols-2 lg:grid-cols-4")}
        {renderColumnGroup("Factures", INVOICE_COLUMNS, "sm:grid-cols-3")}
        {renderColumnGroup("Résultat", TERMINAL_COLUMNS, "sm:grid-cols-2", true)}
      </div>

      {/* Modals */}
      <QuoteModal
        open={showQuoteModal}
        prospect={selectedProspect}
        pdfFile={quoteModalPdfFile}
        selectedQuote={quoteModalSelectedQuote}
        quotes={quoteModalQuotes}
        quotesLoading={quoteModalQuotesLoading}
        dragOver={quoteModalDragOver}
        customMessage={quoteModalCustomMessage}
        sending={updatingStage}
        defaultMessage={DEFAULT_QUOTE_EMAIL_MESSAGE}
        onPdfFileChange={setQuoteModalPdfFile}
        onSelectedQuoteChange={setQuoteModalSelectedQuote}
        onDragOverChange={setQuoteModalDragOver}
        onCustomMessageChange={setQuoteModalCustomMessage}
        onCustomMessageBlur={() => userId && setStoredPipelineMessage(userId, "quote", quoteModalCustomMessage)}
        onConfirm={handleQuoteConfirm}
        onClose={closeQuoteModal}
      />

      <InvoiceModal
        open={showInvoiceModal}
        prospect={selectedProspect}
        invoices={invoiceModalInvoices}
        selectedInvoice={invoiceModalSelectedInvoice}
        loading={invoiceModalLoading}
        customMessage={invoiceModalCustomMessage}
        sending={updatingStage}
        defaultMessage={DEFAULT_INVOICE_EMAIL_MESSAGE}
        onSelectedInvoiceChange={setInvoiceModalSelectedInvoice}
        onCustomMessageChange={setInvoiceModalCustomMessage}
        onCustomMessageBlur={() => userId && setStoredPipelineMessage(userId, "invoice", invoiceModalCustomMessage)}
        onConfirm={handleInvoiceConfirm}
        onClose={closeInvoiceModal}
      />

      <FollowupModal
        open={showFollowupModal}
        prospect={selectedProspect}
        message={followupMessage}
        sending={updatingStage}
        onMessageChange={setFollowupMessage}
        onMessageBlur={() => userId && selectedColumn && setStoredPipelineMessage(userId, selectedColumn, followupMessage)}
        onConfirm={handleFollowupConfirm}
        onClose={() => { setShowFollowupModal(false); setSelectedProspect(null); setSelectedColumn(""); setDraggedItem(null) }}
      />

      {/* Detail panel */}
      <ProspectDetailPanel
        prospect={detailProspect}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSave={handleDetailSave}
        linkedQuote={linkedQuoteForDetail}
        linkedInvoice={linkedInvoiceForDetail}
      />

      {/* Delete confirmation */}
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
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmRemoveProspect() }}
              disabled={removingId !== null}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {prospectToRemove && removingId === prospectToRemove.id ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Suppression...</>
              ) : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
