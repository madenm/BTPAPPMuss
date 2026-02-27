import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  Phone,
  Building2,
  CalendarDays,
  FileText,
  Clock,
  Save,
  Loader2,
  Trophy,
  XCircle,
  ExternalLink,
} from "lucide-react"
import type { Prospect, ProspectStage } from "@/lib/supabaseClients"
import { STAGE_LABELS } from "@/lib/supabaseClients"
import type { SupabaseQuote } from "@/lib/supabaseQuotes"

interface ProspectDetailPanelProps {
  prospect: Prospect | null
  open: boolean
  onClose: () => void
  onSave: (updates: {
    name?: string
    email?: string
    phone?: string
    company?: string
    notes?: string
    stage?: string
  }) => Promise<void>
  linkedQuote: SupabaseQuote | null
}

const STAGE_COLORS: Record<string, string> = {
  all: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  quote: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  quote_followup1: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  quote_followup2: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  won: 'bg-green-500/20 text-green-300 border-green-400/30',
  lost: 'bg-red-500/20 text-red-300 border-red-400/30',
}

function getDaysInStage(prospect: Prospect): number {
  const ref = prospect.lastActionAt || prospect.createdAt
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
}

function getDaysSinceCreation(prospect: Prospect): number {
  if (!prospect.createdAt) return 0
  return Math.floor((Date.now() - new Date(prospect.createdAt).getTime()) / (1000 * 60 * 60 * 24))
}

export function ProspectDetailPanel({
  prospect,
  open,
  onClose,
  onSave,
  linkedQuote,
}: ProspectDetailPanelProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    stage: '' as string,
  })

  useEffect(() => {
    if (prospect && open) {
      setForm({
        name: prospect.name || '',
        email: prospect.email || '',
        phone: prospect.phone || '',
        company: prospect.company || '',
        notes: prospect.notes || '',
        stage: prospect.stage || 'all',
      })
      setEditing(false)
    }
  }, [prospect?.id, open])

  if (!prospect) return null

  const daysInStage = getDaysInStage(prospect)
  const totalDays = getDaysSinceCreation(prospect)
  const stageColor = STAGE_COLORS[prospect.stage] || STAGE_COLORS.all

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: Record<string, string> = {}
      if (form.name !== prospect.name) updates.name = form.name
      if (form.email !== prospect.email) updates.email = form.email
      if (form.phone !== (prospect.phone || '')) updates.phone = form.phone
      if (form.company !== (prospect.company || '')) updates.company = form.company
      if (form.notes !== (prospect.notes || '')) updates.notes = form.notes
      if (form.stage !== prospect.stage) updates.stage = form.stage
      if (Object.keys(updates).length > 0) {
        await onSave(updates)
      }
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {prospect.stage === 'won' && <Trophy className="h-5 w-5 text-green-400" />}
            {prospect.stage === 'lost' && <XCircle className="h-5 w-5 text-red-400" />}
            {editing ? 'Modifier le prospect' : prospect.name}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {/* Stage & Timeline */}
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger className="w-48 bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STAGE_LABELS) as [ProspectStage, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className={`${stageColor} text-xs`}>
                {STAGE_LABELS[prospect.stage as ProspectStage] || prospect.stage}
              </Badge>
            )}
            <span className="text-xs text-white/50 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Créé le {new Date(prospect.createdAt).toLocaleDateString('fr-FR')}
              <span className="text-white/40">({totalDays}j)</span>
            </span>
            {prospect.stage !== 'all' && daysInStage > 0 && (
              <span className="text-xs text-white/50 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysInStage}j dans cette étape
              </span>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider">Contact</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-white/80 text-xs">Nom</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-black/30 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-white/80 text-xs">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-black/30 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-white/80 text-xs">Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="bg-black/30 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-white/80 text-xs">Entreprise</Label>
                  <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className="bg-black/30 border-white/10 text-white" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-white/50 shrink-0" />
                  <a href={`mailto:${prospect.email}`} className="text-blue-300 hover:underline break-all">{prospect.email}</a>
                </div>
                {prospect.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-white/50 shrink-0" />
                    <a href={`tel:${prospect.phone}`} className="text-white/80 hover:underline">{prospect.phone}</a>
                  </div>
                )}
                {prospect.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-white/50 shrink-0" />
                    <span className="text-white/80">{prospect.company}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Linked Documents */}
          {linkedQuote && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider">Documents liés</h3>
              <div className="space-y-2">
                {linkedQuote && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10 border border-blue-400/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          Devis — {linkedQuote.client_name || 'Sans nom'}
                        </p>
                        <p className="text-xs text-white/60">
                          {linkedQuote.total_ttc?.toFixed(2)} € TTC
                          {linkedQuote.created_at && ` — ${new Date(linkedQuote.created_at).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                    </div>
                    <a href="/devis" className="text-blue-300 hover:text-blue-200">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider">Notes</h3>
            {editing ? (
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={4}
                className="bg-black/30 border-white/10 text-white placeholder:text-white/40 resize-y"
                placeholder="Notes sur ce prospect..."
              />
            ) : (
              <div className="p-3 rounded-lg bg-black/20 border border-white/10 min-h-[60px]">
                {prospect.notes ? (
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{prospect.notes}</p>
                ) : (
                  <p className="text-sm text-white/40 italic">Aucune note</p>
                )}
              </div>
            )}
          </div>

          {/* Activity history */}
          {prospect.lastActionAt && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider">Dernière action</h3>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Clock className="h-3.5 w-3.5 text-white/50" />
                <span>
                  {prospect.lastActionType || 'Mise à jour'} — {new Date(prospect.lastActionAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-white/10 flex-shrink-0">
          {editing ? (
            <>
              <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={() => setEditing(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-white/20 text-white border border-white/10 hover:bg-white/30">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Enregistrer
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} className="bg-white/20 text-white border border-white/10 hover:bg-white/30">
              Modifier
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
