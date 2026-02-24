import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Pencil, Trophy, XCircle } from "lucide-react"
import type { Prospect, ProspectStage } from "@/lib/supabaseProspects"
import { ProspectCard } from "./ProspectCard"
import { toast } from "@/hooks/use-toast"

interface PipelineColumnProps {
  id: string
  name: string
  items: Prospect[]
  removingId: string | null
  editingColumnId: string | null
  editDraft: string
  defaultMessage: string
  userId: string | null
  isTerminal?: boolean
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
}

export function PipelineColumn({
  id,
  name,
  items,
  removingId,
  editingColumnId,
  editDraft,
  defaultMessage,
  isTerminal,
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
}: PipelineColumnProps) {
  const isWon = id === 'won'
  const isLost = id === 'lost'
  const showMessageEditor = id !== 'all' && !isWon && !isLost

  const borderColor = isWon
    ? 'border-green-500/30'
    : isLost
      ? 'border-red-500/30'
      : 'border-white/10'

  const headerAccent = isWon
    ? 'text-green-400'
    : isLost
      ? 'text-red-400'
      : 'text-white'

  return (
    <Card
      className={`bg-black/20 backdrop-blur-xl border ${borderColor} text-white min-w-0 overflow-hidden flex flex-col max-md:min-w-[280px] max-md:snap-start max-md:flex-shrink-0`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardHeader className="p-4 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            {isWon && <Trophy className="h-4 w-4 text-green-400 shrink-0" />}
            {isLost && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
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
                <p className="text-sm font-medium mb-2">Message pour : {name}</p>
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
                    toast({ title: "Message enregistré" })
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
            />
          ))}
          {items.length === 0 && (
            <p className={`text-sm text-center py-10 ${isTerminal ? 'text-white/40' : 'text-white/50'}`}>
              {isWon ? 'Aucun prospect gagné' : isLost ? 'Aucun prospect perdu' : 'Aucun prospect'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
