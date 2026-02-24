import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserAccountButton } from "@/components/UserAccountButton";
import { QUOTE_STATUS_LABELS } from "@/lib/quoteConstants";
import type { SupabaseQuote } from "@/lib/supabaseQuotes";
import {
  FileText, Plus, Loader2, Download, Pencil, ExternalLink, Search,
  MoreVertical, Copy, Building, Trash2, RefreshCw, Clock,
} from "lucide-react";

export interface QuoteListChantier {
  id: string;
  nom: string;
}

type QuoteStatus = SupabaseQuote["status"];

export interface QuoteListProps {
  quotes: SupabaseQuote[];
  loading: boolean;
  statusFilter: string;
  searchQuery: string;
  projectFilter?: string;
  chantiers: QuoteListChantier[];
  onStatusFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onProjectFilterChange?: (value: string) => void;
  filteredQuotes: SupabaseQuote[];
  getQuoteDisplayNumber: (quotes: SupabaseQuote[], id: string) => string | undefined;
  onNewQuote: () => void;
  onEditQuote: (quoteId: string) => void;
  onDownloadPdf: (quote: SupabaseQuote) => void;
  onDuplicateQuote: (quote: SupabaseQuote) => void;
  onDeleteQuote: (quoteId: string) => void;
  onChangeStatus: (quoteId: string, status: QuoteStatus) => void;
  onGoToProjects: () => void;
}

function getExpirationDate(quote: SupabaseQuote): Date {
  const created = new Date(quote.created_at);
  const days = quote.validity_days ?? 30;
  return new Date(created.getTime() + days * 86400000);
}

function isExpired(quote: SupabaseQuote): boolean {
  if (quote.status === "accepté" || quote.status === "validé" || quote.status === "refusé" || quote.status === "expiré") return false;
  return getExpirationDate(quote) < new Date();
}

const STATUS_TRANSITIONS: Record<string, QuoteStatus[]> = {
  brouillon: ["envoyé"],
  envoyé: ["accepté", "refusé"],
  accepté: ["validé"],
  refusé: ["brouillon"],
  expiré: ["brouillon"],
  validé: [],
};

export function QuoteList({
  quotes,
  loading,
  statusFilter,
  searchQuery,
  projectFilter,
  onStatusFilterChange,
  onSearchQueryChange,
  onProjectFilterChange,
  filteredQuotes,
  getQuoteDisplayNumber,
  chantiers,
  onNewQuote,
  onEditQuote,
  onDownloadPdf,
  onDuplicateQuote,
  onDeleteQuote,
  onChangeStatus,
  onGoToProjects,
}: QuoteListProps) {
  const chantierMap = new Map(chantiers.map((c) => [c.id, c.nom]));
  const [deleteTarget, setDeleteTarget] = useState<SupabaseQuote | null>(null);

  return (
    <>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Devis</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Liste de vos devis · Créer ou modifier un devis
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end w-full sm:w-auto">
            <Button
              size="sm"
              className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white max-md:min-h-[44px]"
              onClick={onNewQuote}
              data-testid="button-new-quote"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau devis
            </Button>
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-hidden">
        <main className="space-y-6 py-4 sm:py-6">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl">
            <CardHeader className="space-y-0">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <CardTitle className="text-gray-900 dark:text-white font-light flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-500" />
                  Tous les devis
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher (client, n°)..."
                      value={searchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                    <SelectTrigger className="w-[160px] rounded-xl border-gray-200 dark:border-gray-700">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {onProjectFilterChange && chantiers.length > 0 && (
                    <Select value={projectFilter || 'all'} onValueChange={onProjectFilterChange}>
                      <SelectTrigger className="w-[180px] rounded-xl border-gray-200 dark:border-gray-700">
                        <Building className="h-4 w-4 mr-1 text-violet-400 shrink-0" />
                        <SelectValue placeholder="Projet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les projets</SelectItem>
                        {chantiers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  Chargement des devis...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun devis</p>
                  <p className="text-sm mt-1">Créez votre premier devis avec le bouton ci-dessus.</p>
                  <Button
                    className="mt-4 rounded-xl bg-violet-500 hover:bg-violet-600 text-white"
                    onClick={onNewQuote}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau devis
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="rounded-tl-xl">N°</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Projet</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead className="text-right rounded-tr-xl">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((q) => {
                        const expDate = getExpirationDate(q);
                        const expired = isExpired(q);
                        const transitions = STATUS_TRANSITIONS[q.status] ?? [];
                        return (
                          <TableRow
                            key={q.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                            onClick={() => {
                              if (q.status !== "validé" && q.status !== "accepté") {
                                onEditQuote(q.id);
                              }
                            }}
                          >
                            <TableCell className="font-mono text-sm">
                              {getQuoteDisplayNumber(quotes, q.id) || "—"}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900 dark:text-white">
                              {q.client_name || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                              {q.chantier_id ? (
                                <span className="inline-flex items-center gap-1">
                                  <Building className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                                  <span className="truncate max-w-[150px]">{chantierMap.get(q.chantier_id) || "—"}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(q.total_ttc)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  q.status === "validé" || q.status === "accepté"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : q.status === "refusé" || q.status === "expiré"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                      : q.status === "envoyé"
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                }
                              >
                                {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-500 dark:text-gray-400 text-sm">
                              {new Date(q.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-sm">
                              {q.status === "accepté" || q.status === "validé" ? (
                                <span className="text-green-600 dark:text-green-400">—</span>
                              ) : expired ? (
                                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Expiré
                                </Badge>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {expDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {q.status !== "validé" && q.status !== "accepté" && (
                                    <DropdownMenuItem onClick={() => onEditQuote(q.id)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => onDuplicateQuote(q)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Dupliquer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDownloadPdf(q)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Télécharger le PDF
                                  </DropdownMenuItem>
                                  {q.chantier_id && (
                                    <DropdownMenuItem onClick={onGoToProjects}>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Voir le projet
                                    </DropdownMenuItem>
                                  )}
                                  {transitions.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          Changer le statut
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          {transitions.map((s) => (
                                            <DropdownMenuItem key={s} onClick={() => onChangeStatus(q.id, s)}>
                                              {QUOTE_STATUS_LABELS[s] ?? s}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => setDeleteTarget(q)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {deleteTarget ? getQuoteDisplayNumber(quotes, deleteTarget.id) || "" : ""} pour {deleteTarget?.client_name || "ce client"} sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteQuote(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
