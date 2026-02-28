import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
import { Loader2 } from "lucide-react"
import { getApiPostHeaders } from "@/lib/apiHeaders"
import { useAuth } from "@/context/AuthContext"
import { useTeamEffectiveUserId } from "@/context/TeamEffectiveUserIdContext"
import { useUserSettings } from "@/context/UserSettingsContext"
import {
  type Prospect,
  type ProspectStage,
  type ProspectUpdatePayload,
  fetchProspectsForUser,
  insertProspect,
  updateProspect,
  deleteProspect,
} from "@/lib/supabaseClients"
import { fetchQuotesForUser, updateQuoteStatus, type SupabaseQuote, hasQuoteBeenSigned, isQuoteValidityExpired, generateSignatureLink } from "@/lib/supabaseQuotes"
import { getQuotePdfBase64, getSignatureRectangleCoordinates, fetchLogoDataUrl, buildQuoteEmailHtml, buildContactBlockHtml, type QuotePdfParams } from "@/lib/quotePdf"
import { toast } from "@/hooks/use-toast"

import { PipelineColumn } from "./crm/PipelineColumn"
import { ProspectDetailPanel } from "./crm/ProspectDetailPanel"
import { QuoteModal } from "./crm/CRMModals"

/* ────────────── Column definitions ────────────── */

interface ColumnDef { id: string; name: string; isTerminal?: boolean }

const QUOTE_COLUMNS: ColumnDef[] = [
  { id: "quote", name: "📬 Devis envoyé" },
  { id: "followup", name: "📢 À relancer" },
]

const TERMINAL_COLUMNS: ColumnDef[] = [
  { id: "terminal", name: "✅ Terminé", isTerminal: true },
]

const ALL_COLUMNS = [...QUOTE_COLUMNS, ...TERMINAL_COLUMNS]

/* ────────────── Message storage ────────────── */

const DEFAULT_THEME_COLOR = "#8b5cf6"

const DEFAULT_QUOTE_EMAIL_MESSAGE =
  "Bonjour,\n\nVeuillez trouver ci-joint notre devis. N'hésitez pas à nous contacter pour toute question.\n\nCordialement"
const DEFAULT_QUOTE_FOLLOWUP =
  "Bonjour,\n\nJe me permets de revenir vers vous concernant le devis que je vous ai envoyé.\n\nSouhaitez-vous avoir des précisions ou modifier certains éléments ?\n\nJe reste à votre disposition.\n\nCordialement"

function getDefaultMessageForColumn(columnId: string): string {
  if (columnId === "quote") return DEFAULT_QUOTE_EMAIL_MESSAGE
  if (columnId === "followup") return DEFAULT_QUOTE_FOLLOWUP
  return ""
}

const PIPELINE_MESSAGES_STORAGE_KEY = "crm_pipeline_messages"
const PIPELINE_DELAYS_STORAGE_KEY = "crm_pipeline_delays"
const DEFAULT_DAYS_BEFORE_FOLLOWUP = 7

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

function getStoredPipelineDelays(userId: string | null): Record<string, number> {
  if (!userId || typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(`${PIPELINE_DELAYS_STORAGE_KEY}_${userId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch { return {} }
}

function setStoredPipelineDelay(userId: string | null, key: string, value: number): void {
  if (!userId || typeof window === "undefined") return
  try {
    const prev = getStoredPipelineDelays(userId)
    localStorage.setItem(`${PIPELINE_DELAYS_STORAGE_KEY}_${userId}`, JSON.stringify({ ...prev, [key]: value }))
  } catch { /* ignore */ }
}

function getDaysBeforeFollowup(userId: string | null, columnId: string): number {
  const delays = getStoredPipelineDelays(userId)
  return delays[columnId] ?? DEFAULT_DAYS_BEFORE_FOLLOWUP
}

/* ────────────── Main Component ────────────── */

export function CRMPipeline() {
  const { user, session } = useAuth()
  const effectiveUserId = useTeamEffectiveUserId()
  const userId = effectiveUserId ?? user?.id ?? null
  const { profile, logoUrl, themeColor } = useUserSettings()
  const accentColor = themeColor || DEFAULT_THEME_COLOR
  const userReplyToEmail = profile?.company_email || user?.email || null

  // ─── Data ───
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  // ─── Drag & drop ───
  const [draggedItem, setDraggedItem] = useState<{ prospect: Prospect; columnId: string } | null>(null)

  // ─── Modals ───
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
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

  // ─── Column message editor ───
  const [pipelineMessageEditColumnId, setPipelineMessageEditColumnId] = useState<string | null>(null)
  const [pipelineMessageEditDraft, setPipelineMessageEditDraft] = useState("")

  // ─── Detail panel ───
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Linked documents for detail panel ───
  const [allQuotes, setAllQuotes] = useState<SupabaseQuote[]>([])

  /* ────────────── Computed columns ────────────── */

  const columnsMap = useMemo(() => {
    const map: Record<string, Prospect[]> = {}
    for (const col of ALL_COLUMNS) map[col.id] = []

    for (const p of prospects) {
      const stage = p.stage
      // Route to followup column if in either followup stage
      if (stage === "quote_followup1" || stage === "quote_followup2") { 
        map["followup"]?.push(p); 
        continue 
      }
      // Route to terminal column if won or lost
      if (stage === "won" || stage === "lost") { 
        map["terminal"]?.push(p); 
        continue 
      }
      // Default: route quote and all to quote column
      if (stage === "quote" || stage === "all") { 
        map["quote"]?.push(p); 
        continue 
      }
      // Fallback
      if (map[stage]) map[stage].push(p)
      else map["quote"]?.push(p)
    }
    return map
  }, [prospects])

  /* ────────────── Prospect statuses (signed/expired) ────────────── */

  const prospectStatuses = useMemo(() => {
    const statuses: Record<string, { isSigned: boolean; isExpired: boolean }> = {}
    
    for (const prospect of prospects) {
      if (!prospect.linkedQuoteId) {
        statuses[prospect.id] = { isSigned: false, isExpired: false }
        continue
      }
      
      const quote = allQuotes.find(q => q.id === prospect.linkedQuoteId)
      if (!quote) {
        statuses[prospect.id] = { isSigned: false, isExpired: false }
        continue
      }
      
      const isSigned = quote.status === "signé" || quote.status === "accepté"
      const isExpired = isQuoteValidityExpired(quote)
      
      statuses[prospect.id] = { isSigned, isExpired }
    }
    
    return statuses
  }, [prospects, allQuotes])

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
  }, [userId])

  /* ────────────── Auto-update prospects based on quote status and delays ────────────── */

  useEffect(() => {
    if (!userId || prospects.length === 0) return

    const checkAndUpdateProspects = async () => {
      const updates: Array<{ prospect: Prospect; updates: ProspectUpdatePayload }> = []
      const now = new Date()
      const daysBeforeFollowup = getDaysBeforeFollowup(userId, "quote")

      for (const prospect of prospects) {
        // Auto-move from "Devis envoyé" to "À relancer" after delay
        if (prospect.stage === "quote" && prospect.lastEmailSentAt) {
          const lastEmailDate = new Date(prospect.lastEmailSentAt)
          const daysSinceEmail = Math.floor((now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysSinceEmail >= daysBeforeFollowup) {
            const relanceCount = (prospect.relanceCount ?? 0) + 1
            const newStage = relanceCount === 1 ? "quote_followup1" : "quote_followup2"
            
            updates.push({
              prospect,
              updates: {
                stage: newStage,
                last_action_at: new Date().toISOString(),
                last_action_type: `Passage automatique en relance ${relanceCount}`,
              },
            })
          }
        }

        // Check quote status if linked
        if (prospect.linkedQuoteId && allQuotes.length > 0) {
          const quote = allQuotes.find((q) => q.id === prospect.linkedQuoteId)
          if (quote) {
            // Check if quote is signed or has a signature
            let shouldUpdateToWon = false
            if (quote.status === "signé" || quote.status === "accepté") {
              shouldUpdateToWon = true
            } else {
              const isSigned = await hasQuoteBeenSigned(quote.id)
              if (isSigned) {
                shouldUpdateToWon = true
              }
            }

            // Check if quote validity has expired
            const hasExpired = isQuoteValidityExpired(quote)

            if (shouldUpdateToWon && prospect.stage !== "won") {
              updates.push({
                prospect,
                updates: {
                  stage: "won",
                  last_action_at: new Date().toISOString(),
                  last_action_type: "Devis signé automatiquement détecté",
                },
              })
            } else if (hasExpired && prospect.stage !== "lost" && prospect.stage !== "won") {
              updates.push({
                prospect,
                updates: {
                  stage: "lost",
                  last_action_at: new Date().toISOString(),
                  last_action_type: "Validité du devis dépassée",
                },
              })
            }
          }
        }
      }

      // Apply all updates
      for (const { prospect, updates: updatePayload } of updates) {
        try {
          const updated = await updateProspect(userId, prospect.id, updatePayload)
          refreshAfterUpdate(updated)
        } catch (err) {
          console.error("Error updating prospect:", err)
        }
      }
    }

    checkAndUpdateProspects()
  }, [userId, prospects, allQuotes])

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
          // Utiliser contact_id au lieu de comparer les emails
          const match = quotes.find((q) => q.contact_id === prospect.id)
          if (match) setQuoteModalSelectedQuote(match)
        }
      })
      .catch(() => setQuoteModalQuotes([]))
      .finally(() => setQuoteModalQuotesLoading(false))
  }, [showQuoteModal, userId, selectedProspect?.id])

  /* ────────────── Helpers ────────────── */

  const refreshAfterUpdate = (updated: Prospect) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (detailProspect?.id === updated.id) setDetailProspect(updated)
  }

  /* ────────────── Prospect CRUD ────────────── */

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

  /* ────────────── Stage movement ────────────── */

  const moveProspectToStage = async (prospect: Prospect, targetStage: ProspectStage) => {
    if (!userId) return

    if (targetStage === "quote") {
      setSelectedProspect(prospect)
      setShowQuoteModal(true)
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

    // Handle terminal column (Won/Lost)
    if (targetColumnId === "terminal") {
      const choice = window.confirm(
        `Marquer "${prospect.name}" comme gagné ? Cliquez OK pour gagné, ou Annuler pour perdu.`
      )
      const finalStage: ProspectStage = choice ? "won" : "lost"
      await moveProspectToStage(prospect, finalStage)
      return
    }

    // Handle drag to "followup" (À relancer) - mettre en Relance 1 directement
    if (targetColumnId === "followup") {
      await moveProspectToStage(prospect, "quote_followup1")
      toast({ 
        title: "Prospect en À relancer", 
        description: "Cliquez sur le bouton 📧 Relancer pour envoyer l'email.",
      })
      return
    }

    // Allow dragging back to "quote" (Devis envoyé)
    if (targetColumnId === "quote") {
      await moveProspectToStage(prospect, "quote")
      return
    }

    // Regular stage movement
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
      let rectCoords: { x: number; y: number; width: number; height: number } | undefined = undefined
      if (hasQuote && quoteModalSelectedQuote) {
        const params = quoteToPdfParams(quoteModalSelectedQuote)
        // Utiliser les données du contact au lieu du devis
        params.clientInfo = {
          name: selectedProspect.name ?? "",
          email: selectedProspect.email ?? "",
          phone: selectedProspect.phone ?? "",
          address: selectedProspect.street_address ?? ""
        }
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
        rectCoords = getSignatureRectangleCoordinates(params)
        const safeName = (selectedProspect.name || "devis").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
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
            clientName: selectedProspect.name ?? "",
            clientAddress: selectedProspect.street_address ?? undefined,
            clientPhone: selectedProspect.phone ?? undefined,
            clientEmail: selectedProspect.email ?? undefined,
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
      // N'envoyer que le message personnalisé, pas les détails du devis (qui sont dans le PDF)
      const htmlContent = customMessageHtml.trim() || undefined

      setStoredPipelineMessage(userId, "quote", quoteModalCustomMessage)

      let apiBody: Record<string, any> = { 
        to: selectedProspect.email, 
        pdfBase64, 
        fileName, 
        htmlContent, 
        replyTo: userReplyToEmail,
        quoteId: quoteModalSelectedQuote?.id,
        userId: userId
      }
      
      // Ajouter les coordonnées du rectangle si c'est un devis (pour la signature)
      if (hasQuote && quoteModalSelectedQuote && rectCoords) {
        apiBody.signatureRectCoords = rectCoords
      }

      const emailRes = await fetch("/api/send-quote-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify(apiBody),
      })
      const data = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email.", variant: "destructive" })
        return
      }

      if (quoteModalSelectedQuote && userId) {
        try {
          await updateQuoteStatus(quoteModalSelectedQuote.id, userId, 'envoyé')
          // La facture sera créée uniquement quand le devis sera signé ou validé manuellement
        } catch (err) { console.error('Error updating quote status:', err) }
      }

      const prospectUpdates: ProspectUpdatePayload = {
        stage: "quote",
        last_action_at: new Date().toISOString(),
        last_action_type: "Devis envoyé",
        last_email_sent_at: new Date().toISOString(),
        relance_count: 0,
      }
      if (quoteModalSelectedQuote) prospectUpdates.linked_quote_id = quoteModalSelectedQuote.id

      // Si le prospect a déjà un devis lié DIFFÉRENT, créer un nouveau prospect pour ce devis
      const existingLinkedQuoteId = selectedProspect.linkedQuoteId
      const newQuoteId = quoteModalSelectedQuote?.id
      const needsNewCard = existingLinkedQuoteId && newQuoteId && existingLinkedQuoteId !== newQuoteId

      let updated: Prospect
      if (needsNewCard) {
        // Créer une nouvelle carte CRM pour ce devis
        const newProspect = await insertProspect(userId, {
          name: selectedProspect.name,
          email: selectedProspect.email,
          phone: selectedProspect.phone,
          company: selectedProspect.company,
        })
        updated = await updateProspect(userId, newProspect.id, prospectUpdates)
        setProspects((prev) => [...prev, updated])
      } else {
        updated = await updateProspect(userId, selectedProspect.id, prospectUpdates)
        refreshAfterUpdate(updated)
      }
      setShowQuoteModal(false)
      setSelectedProspect(null)
      setDraggedItem(null)
      setQuoteModalPdfFile(null)
      setQuoteModalSelectedQuote(null)
      setQuoteModalCustomMessage("")
      toast({
        title: "Email envoyé",
        description: "Le devis a été envoyé au prospect.",
      })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer l'email.", variant: "destructive" })
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

  /* ────────────── Relance handler (direct from card button) ────────────── */

  const handleRelance = async (prospect: Prospect) => {
    if (!userId) return
    setUpdatingStage(true)
    try {
      // Récupérer le message de relance personnalisé
      const stored = getStoredPipelineMessages(userId)
      const relanceMessage = stored["followup"] ?? DEFAULT_QUOTE_FOLLOWUP

      // Trouver le devis lié : priorité à linkedQuoteId, sinon chercher par contact_id
      let linkedQuoteId = prospect.linkedQuoteId

      // Si le linkedQuoteId est périmé/supprimé, on le considère comme absent
      if (linkedQuoteId && allQuotes.length > 0) {
        const stillExists = allQuotes.some(q => q.id === linkedQuoteId)
        if (!stillExists) {
          console.warn("⚠️ linkedQuoteId introuvable dans allQuotes, tentative de résolution via contact_id")
          linkedQuoteId = undefined
        }
      }
      
      if (!linkedQuoteId && allQuotes.length > 0) {
        const matchingQuote = allQuotes.find(q => q.contact_id === prospect.id)
        if (matchingQuote) {
          linkedQuoteId = matchingQuote.id
          console.log("📋 Devis trouvé via contact_id:", linkedQuoteId)
          
          // Mettre à jour le linkedQuoteId dans le prospect pour les prochaines fois
          try {
            await updateProspect(userId, prospect.id, { linked_quote_id: linkedQuoteId })
          } catch (err) {
            console.warn("⚠️ Impossible de mettre à jour linked_quote_id:", err)
          }
        }
      }

      // Générer un lien de signature si le prospect a un devis lié
      let signatureLink = ""
      
      if (linkedQuoteId && user?.id) {
        try {
          // Essayer d'abord via l'API backend si le token est disponible
          if (session?.access_token) {
            const signatureRes = await fetch("/api/generate-quote-signature-link", {
              method: "POST",
              headers: getApiPostHeaders(session.access_token),
              body: JSON.stringify({ quoteId: linkedQuoteId, expirationDays: 30 }),
            })

            if (signatureRes.ok) {
              const signatureData = await signatureRes.json()
              if (signatureData?.signatureLink) {
                signatureLink = signatureData.signatureLink
              }
            }
          }

          // Fallback client-side si token n'est pas disponible ou API échoue
          if (!signatureLink) {
            signatureLink = (await generateSignatureLink(linkedQuoteId, user.id, 30, session)) || ''
          }
        } catch (err) {
          console.error("Erreur génération lien signature:", err)
          // Essayer le fallback client-side
          if (user?.id) {
            try {
              signatureLink = (await generateSignatureLink(linkedQuoteId, user.id, 30, session)) || ''
            } catch (fallbackErr) {
              console.error("Erreur fallback génération lien signature:", fallbackErr)
            }
          }
        }
      }

      if (linkedQuoteId && !signatureLink) {
        toast({
          title: "Erreur lien signature",
          description: "Impossible de générer un lien de signature valide. Réessayez dans quelques secondes.",
          variant: "destructive",
        })
        return
      }

      const contactBlock = buildContactBlockHtml({
        contactName: profile?.full_name,
        phone: profile?.company_phone,
        email: profile?.company_email,
        address: profile?.company_address,
        cityPostal: profile?.company_city_postal,
      })
      const baseHtml = relanceMessage.trim().includes("<")
        ? relanceMessage.trim()
        : `<p>${relanceMessage.trim().replace(/\n/g, "</p><p>")}</p>`
      
      // Ajouter le lien de signature au message si disponible
      const signatureLinkHtml = signatureLink
        ? `<div style="margin: 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
             <p style="margin: 0 0 12px 0; font-weight: 600; color: #374151;">Pour signer votre devis en ligne :</p>
             <a href="${signatureLink}" style="display: inline-block; padding: 12px 24px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">✍️ Signer le devis</a>
           </div>`
        : ""
      
      console.log("📧 Construction email - signatureLink:", signatureLink)
      console.log("📧 signatureLinkHtml:", signatureLinkHtml ? "Présent" : "Absent")
      
      const htmlContent = baseHtml + signatureLinkHtml + contactBlock
      console.log("📧 HTML final longueur:", htmlContent.length, "caractères")

      const currentRelanceCount = prospect.relanceCount ?? 0
      const newRelanceCount = currentRelanceCount + 1
      const relanceLabel = `Relance devis ${newRelanceCount}`

      const emailRes = await fetch("/api/send-followup-email", {
        method: "POST",
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({ 
          to: prospect.email, 
          subject: `${relanceLabel} - Votre devis`, 
          htmlContent, 
          replyTo: userReplyToEmail 
        }),
      })
      const resText = await emailRes.text()
      const data = resText ? (() => { try { return JSON.parse(resText) } catch { return {} } })() : {}
      if (!emailRes.ok) {
        toast({ title: "Erreur d'envoi", description: data.message || "Impossible d'envoyer l'email de relance.", variant: "destructive" })
        return
      }

      // Remettre le prospect en "Devis envoyé" avec compteur incrémenté
      const prospectUpdates: ProspectUpdatePayload = {
        stage: "quote",
        last_action_at: new Date().toISOString(),
        last_action_type: relanceLabel,
        relance_count: newRelanceCount,
        last_email_sent_at: new Date().toISOString(),
      }
      const updated = await updateProspect(userId, prospect.id, prospectUpdates)
      refreshAfterUpdate(updated)
      toast({ title: "Relance envoyée", description: "L'email de relance a été envoyé et le prospect est retourné dans 'Devis envoyé'." })
    } catch (err) {
      console.error(err)
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'envoyer la relance.", variant: "destructive" })
    } finally { setUpdatingStage(false) }
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
    <>
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
            prospectStatuses={prospectStatuses}
            daysBeforeFollowup={getDaysBeforeFollowup(userId, col.id)}
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
            onSaveDelay={(columnId, days) => setStoredPipelineDelay(userId, columnId, days)}
            onRelance={handleRelance}
            allQuotes={allQuotes}
          />
        ))}
    </>
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

      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
        {renderColumnGroup("📬 Devis", QUOTE_COLUMNS, "sm:grid-cols-1 lg:grid-cols-2")}
        {renderColumnGroup("✅ Résultat", TERMINAL_COLUMNS, "sm:grid-cols-1 lg:grid-cols-1")}
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

      {/* Detail panel */}
      <ProspectDetailPanel
        prospect={detailProspect}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSave={handleDetailSave}
        linkedQuote={linkedQuoteForDetail}
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
