import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, FileText, Pencil, MoreVertical, Copy, Archive, RefreshCw, Receipt, Check } from 'lucide-react';
import type { Chantier } from '@/context/ChantiersContext';
import type { TeamMember } from '@/lib/supabase';

const TYPE_CHANTIER_LABELS: Record<string, string> = {
  piscine: 'Piscine & Spa',
  paysage: 'Aménagement Paysager',
  menuiserie: 'Menuiserie Sur-Mesure',
  renovation: 'Rénovation',
  plomberie: 'Plomberie',
  maconnerie: 'Maçonnerie',
  terrasse: 'Terrasse & Patio',
  chauffage: 'Chauffage & Climatisation',
  isolation: 'Isolation de la charpente',
  electricite: 'Électricité',
  peinture: 'Peinture & Revêtements',
  autre: 'Autre',
};

function formatDateToDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (y == null || m == null || d == null || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function formatMontantEuro(value?: number | null): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

export interface QuoteCountInfo {
  total: number;
  pending: number;
  validated: number;
}

interface ProjectCardProps {
  chantier: Chantier;
  enRetard: boolean;
  assignees: TeamMember[];
  imageIndex: number;
  quoteCounts: QuoteCountInfo;
  invoiceCount: number;
  onImageIndexChange: (chantierId: string, newIndex: number) => void;
  onEdit: (chantier: Chantier) => void;
  onEditDevis: (chantier: Chantier) => void;
  onDuplicate: (chantier: Chantier) => void;
  onQuickStatusChange: (chantier: Chantier, status: Chantier['statut']) => void;
  onArchive: (chantier: Chantier) => void;
}

export function ProjectCard({
  chantier,
  enRetard,
  assignees,
  imageIndex,
  quoteCounts,
  invoiceCount,
  onImageIndexChange,
  onEdit,
  onEditDevis,
  onDuplicate,
  onQuickStatusChange,
  onArchive,
}: ProjectCardProps) {
  const hasMultipleImages = chantier.images.length > 1;

  return (
    <Card
      className={`bg-black/20 backdrop-blur-xl border text-white hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer rounded-lg overflow-hidden ${
        enRetard
          ? 'border-l-4 border-l-red-500 border-white/10'
          : chantier.statut === 'en cours'
            ? 'border-l-4 border-l-yellow-500 border-white/10'
            : chantier.statut === 'terminé'
              ? 'border-l-4 border-l-green-500 border-white/10'
              : 'border-l-4 border-l-blue-500 border-white/10'
      }`}
    >
      <div onClick={() => onEdit(chantier)}>
        {chantier.images.length > 0 && (
          <div className="relative h-48 overflow-hidden rounded-t-lg group">
            <img
              src={chantier.images[imageIndex]}
              alt={chantier.nom}
              className="w-full h-full object-cover"
            />
            {hasMultipleImages && (
              <>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {chantier.images.slice(0, 5).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${i === imageIndex ? 'bg-white' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                  {imageIndex + 1} / {chantier.images.length}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageIndexChange(chantier.id, Math.max(0, imageIndex - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-opacity"
                  aria-label="Photo précédente"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageIndexChange(chantier.id, Math.min(chantier.images.length - 1, imageIndex + 1));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-opacity"
                  aria-label="Photo suivante"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        )}
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{chantier.nom}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <User className="h-4 w-4 shrink-0" />
            {chantier.clientName}
          </div>
          {chantier.typeChantier && (
            <div className="text-xs text-white/50 mt-0.5">
              {TYPE_CHANTIER_LABELS[chantier.typeChantier] ?? chantier.typeChantier}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {formatDateToDDMMYYYY(chantier.dateDebut)}
            {chantier.dateFin && (
              <span className="text-white/50"> → {formatDateToDDMMYYYY(chantier.dateFin)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock className="h-4 w-4 shrink-0" />
            {chantier.duree}
          </div>
          {chantier.montantDevis != null && chantier.montantDevis > 0 && (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <FileText className="h-4 w-4 shrink-0" />
              {formatMontantEuro(chantier.montantDevis)}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`px-2 py-1 rounded text-xs ${
              chantier.statut === 'planifié' ? 'bg-blue-500/20 text-blue-300' :
              chantier.statut === 'en cours' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-green-500/20 text-green-300'
            }`}>
              {chantier.statut}
            </span>
            {enRetard && (
              <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">
                En retard
              </span>
            )}
          </div>
          {assignees.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-white/60 mt-2">
              <User className="h-3.5 w-3.5 shrink-0" />
              {assignees.slice(0, 2).map((m) => m.name).join(', ')}
              {assignees.length > 2 && ` +${assignees.length - 2}`}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-xs text-white/50">
              {quoteCounts.total > 0 && (
                <span className="flex items-center gap-1" title="Devis">
                  <FileText className="h-3 w-3" />
                  {quoteCounts.total}
                  {quoteCounts.pending > 0 && (
                    <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1 rounded">
                      {quoteCounts.pending} en attente
                    </span>
                  )}
                  {quoteCounts.validated > 0 && (
                    <Check className="h-3 w-3 text-green-400" />
                  )}
                </span>
              )}
              {invoiceCount > 0 && (
                <span className="flex items-center gap-1" title="Factures">
                  <Receipt className="h-3 w-3" />
                  {invoiceCount}
                </span>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => onEdit(chantier)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditDevis(chantier)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Voir les devis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(chantier)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Dupliquer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Changer le statut
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(['planifié', 'en cours', 'terminé'] as const).filter((s) => s !== chantier.statut).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => onQuickStatusChange(chantier, s)}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${s === 'planifié' ? 'bg-blue-400' : s === 'en cours' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-amber-400 focus:text-amber-400"
                  onClick={() => onArchive(chantier)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
