import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Mail,
  Phone,
  MoreVertical,
  Trash2,
  FileText,
  Receipt,
  Clock,
  CalendarDays,
  AlertTriangle,
  Trophy,
  XCircle,
  Eye,
  ArrowRight,
} from "lucide-react"
import { motion } from "framer-motion"
import type { Prospect, ProspectStage } from "@/lib/supabaseClients"
import { STAGE_LABELS } from "@/lib/supabaseClients"

interface ProspectCardProps {
  prospect: Prospect
  columnId: string
  onDragStart: () => void
  onRemove: (e: React.MouseEvent) => void
  onOpenDetail: () => void
  onMoveToStage: (stage: ProspectStage) => void
  removing: boolean
  isSigned: boolean
  isExpired: boolean
  showRelanceButton?: boolean
  onRelance?: () => void
  quoteNumber?: string
  quoteAmount?: number
}

const STAGE_ORDER: ProspectStage[] = [
  'all', 'quote', 'quote_followup1', 'quote_followup2',
  'won', 'lost',
]

function getDaysInStage(prospect: Prospect): number {
  const ref = prospect.lastActionAt || prospect.createdAt
  if (!ref) return 0
  const diff = Date.now() - new Date(ref).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getStagnationLevel(days: number): 'ok' | 'warning' | 'danger' {
  if (days >= 14) return 'danger'
  if (days >= 7) return 'warning'
  return 'ok'
}

export function ProspectCard({
  prospect,
  columnId,
  onDragStart,
  onRemove,
  onOpenDetail,
  onMoveToStage,
  removing,
  isSigned,
  isExpired,
  showRelanceButton,
  onRelance,
  quoteNumber,
  quoteAmount,
}: ProspectCardProps) {
  const daysInStage = useMemo(() => getDaysInStage(prospect), [prospect])
  const stagnation = getStagnationLevel(daysInStage)

  const stagnationBorder =
    stagnation === 'danger'
      ? 'border-l-red-500'
      : stagnation === 'warning'
        ? 'border-l-amber-500'
        : 'border-l-transparent'

  const availableStages = STAGE_ORDER.filter((s) => s !== columnId)

  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      className={`group relative shrink-0 p-3 pr-9 bg-black/30 border border-white/10 border-l-2 ${stagnationBorder} rounded-xl cursor-move hover:bg-white/10 transition-colors text-white overflow-hidden min-w-0`}
      layout
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-white/10 text-white/70 hover:text-white transition-opacity"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onOpenDetail}>
            <Eye className="h-4 w-4 mr-2" />
            Voir la fiche
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRight className="h-4 w-4 mr-2" />
              Déplacer vers
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {availableStages.map((stage) => (
                <DropdownMenuItem key={stage} onClick={() => onMoveToStage(stage)}>
                  {stage === 'won' && <Trophy className="h-4 w-4 mr-2 text-green-400" />}
                  {stage === 'lost' && <XCircle className="h-4 w-4 mr-2 text-red-400" />}
                  {STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-400 focus:text-red-400"
            onClick={(e) => onRemove(e as unknown as React.MouseEvent)}
            disabled={removing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="space-y-1.5 min-w-0 break-words" onClick={onOpenDetail} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenDetail()}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-white break-words leading-tight">{prospect.name}</p>
          {quoteAmount !== undefined && (
            <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">
              {quoteAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          )}
        </div>
        {quoteNumber && (
          <div className="text-[11px] font-medium text-violet-300">Devis #{quoteNumber}</div>
        )}

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

        {/* Visual indicators */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {isSigned && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-300 border-green-400/30">
              ✓ Signé
            </Badge>
          )}
          {isExpired && !isSigned && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-300 border-red-400/30">
              ⏰ Expiré
            </Badge>
          )}
          {(prospect.relanceCount ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-300 border-orange-400/30">
              📢 Rel.{prospect.relanceCount}
            </Badge>
          )}
          {prospect.linkedQuoteId && !quoteNumber && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400/30 text-blue-300 gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    Devis
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Devis lié</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {prospect.linkedInvoiceId && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400/30 text-emerald-300 gap-1">
                    <Receipt className="h-2.5 w-2.5" />
                    Facture
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Facture liée</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] text-white/50">
                  <CalendarDays className="h-2.5 w-2.5" />
                  {new Date(prospect.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Ajouté le {new Date(prospect.createdAt).toLocaleDateString('fr-FR')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {columnId !== 'all' && daysInStage > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1 text-[10px] ${
                    stagnation === 'danger' ? 'text-red-400' :
                    stagnation === 'warning' ? 'text-amber-400' :
                    'text-white/50'
                  }`}>
                    {stagnation === 'danger' ? (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    ) : (
                      <Clock className="h-2.5 w-2.5" />
                    )}
                    {daysInStage}j
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {daysInStage} jour{daysInStage > 1 ? 's' : ''} dans cette étape
                  {stagnation === 'danger' && ' — Action requise !'}
                  {stagnation === 'warning' && ' — Pensez à relancer'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Bouton Relancer */}
        {showRelanceButton && onRelance && (
          <Button
            size="sm"
            className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={(e) => {
              e.stopPropagation()
              onRelance()
            }}
          >
            📧 Relancer
          </Button>
        )}
      </div>
    </motion.div>
  )
}
