import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Pencil } from "lucide-react"
import type { Prospect, ProspectStage } from "@/lib/supabaseClients"
import type { SupabaseQuote } from "@/lib/supabaseQuotes"
import { getQuoteDisplayNumber } from "@/lib/supabaseQuotes"
import { ProspectCard } from "./ProspectCard"
import { toast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"

interface PipelineColumnProps {
  id: string
  name: string
  items: Prospect[]
  removingId: string | null
  editingColumnId: string | null
  editDraft: string
  defaultMessage: string
  userId: string | null
  prospectStatuses: Record<string, { isSigned: boolean; isExpired: boolean }>
  daysBeforeFollowup?: number
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragStart: (prospect: Prospect, columnId: string) => void
  onRemove: (prospect: Prospect, e: React.MouseEvent) => void
  onOpenDetail: (prospect: Prospect) => void
  onMoveToStage: (prospect: Prospect, stage: ProspectStage) => void
  onEditColumnOpen: (columnId: string, currentMessage: string) => void
  onEditColumnClose: () => void
  onEditDraftChange: (value: string) => void
  onSaveMessage: (columnId: string, message: string) => void
  onSaveDelay?: (columnId: string, days: number) => void
  onRelance?: (prospect: Prospect) => void
  allQuotes?: SupabaseQuote[]
}

export function PipelineColumn({
  id,
  name,
  items,
  removingId,
  editingColumnId,
  editDraft,
  defaultMessage,
  prospectStatuses,
  daysBeforeFollowup,
  onDragOver,
  onDrop,
  onDragStart,
  onRemove,
  onOpenDetail,
  onMoveToStage,
  onEditColumnOpen,
  onEditColumnClose,
  onEditDraftChange,
  onSaveMessage,
  onSaveDelay,
  onRelance,
  allQuotes,
}: PipelineColumnProps) {
  const isTerminal = id === 'terminal'
  const showMessageEditor = id !== 'all' && !isTerminal
  const showDelayEditor = id === 'quote' // Uniquement pour la colonne "Devis envoyé"
  
  const [delayDraft, setDelayDraft] = useState(daysBeforeFollowup ?? 7)

  useEffect(() => {
    if (daysBeforeFollowup !== undefined) {
      setDelayDraft(daysBeforeFollowup)
    }
  }, [daysBeforeFollowup])

  const borderColor = isTerminal
    ? 'border-purple-500/30'
    : 'border-white/10'

  const headerAccent = isTerminal
    ? 'text-purple-300'
    : 'text-white'

  return (
    <Card
      className={`bg-black/20 backdrop-blur-xl border ${borderColor} text-white w-80 h-[calc(100vh-12rem)] flex-shrink-0 snap-start overflow-hidden flex flex-col`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardHeader className="p-4 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div>
              <CardTitle className={`text-sm font-semibold ${headerAccent} break-words leading-snug`} title={name}>
                {name}
              </CardTitle>
              <Badge variant="secondary" className="mt-1.5 text-white/80 rounded-full">
                {items.length}
              </Badge>
            </div>
          </div>
          {showMessageEditor && (
            <Popover
              open={editingColumnId === id}
              onOpenChange={(open) => {
                if (open) {
                  onEditColumnOpen(id, defaultMessage)
                } else {
                  onEditColumnClose()
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-white/70 hover:text-white" title="Personnaliser le message">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px]" align="end">
                <p className="text-sm font-medium mb-2">Configuration : {name}</p>
                
                {showDelayEditor && onSaveDelay && (
                  <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                    <label className="text-xs font-medium text-white/80 block mb-2">
                      Délai avant relance (jours)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={delayDraft}
                      onChange={(e) => setDelayDraft(parseInt(e.target.value) || 7)}
                      className="w-full"
                    />
                    <p className="text-[10px] text-white/50 mt-1">
                      Les prospects passeront en "À relancer" après {delayDraft} jour{delayDraft > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
                
                <p className="text-xs font-medium text-white/80 mb-2">Message personnalisé</p>
                <Textarea
                  value={editingColumnId === id ? editDraft : ""}
                  onChange={(e) => onEditDraftChange(e.target.value)}
                  rows={5}
                  className="mb-3 resize-none"
                  placeholder="Message personnalisé..."
                />
                
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onSaveMessage(id, editDraft)
                    if (showDelayEditor && onSaveDelay) {
                      onSaveDelay(id, delayDraft)
                    }
                    toast({ title: "Configuration enregistrée" })
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
          {items.map((prospect) => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              columnId={id}
              onDragStart={() => onDragStart(prospect, id)}
              onRemove={(e) => onRemove(prospect, e)}
              onOpenDetail={() => onOpenDetail(prospect)}
              onMoveToStage={(stage) => onMoveToStage(prospect, stage)}
              removing={removingId === prospect.id}
              isSigned={prospectStatuses[prospect.id]?.isSigned || false}
              isExpired={prospectStatuses[prospect.id]?.isExpired || false}
              showRelanceButton={id === "followup"}
              onRelance={onRelance ? () => onRelance(prospect) : undefined}
              quoteNumber={prospect.linkedQuoteId && allQuotes ? getQuoteDisplayNumber(allQuotes, prospect.linkedQuoteId) : undefined}
              quoteAmount={prospect.linkedQuoteId && allQuotes ? allQuotes.find(q => q.id === prospect.linkedQuoteId)?.total_ttc : undefined}
            />
          ))}
          {items.length === 0 && (
            <p className={`text-sm text-center py-10 ${isTerminal ? 'text-white/40' : 'text-white/50'}`}>
              Aucun prospect
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
