import { useState, useMemo, useEffect } from "react";
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
  MoreVertical, Copy, Building, Trash2, RefreshCw, Clock, Mail,
  ChevronLeft, ChevronRight,
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
  onGoToProjects: (chantierId: string) => void;
  onSendEmail: (quote: SupabaseQuote) => void;
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

const PAGE_SIZE = 10;

const STATUS_TRANSITIONS: Record<string, QuoteStatus[]> = {
  brouillon: ["envoyé"],
  envoyé: ["accepté", "refusé"],
  accepté: ["validé"],
  refusé: ["brouillon"],
  expiré: ["brouillon"],
  validé: [],
  signé: [],
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
  onSendEmail,
}: QuoteListProps) {
  const chantierMap = new Map(chantiers.map((c) => [c.id, c.nom]));
  const [deleteTarget, setDeleteTarget] = useState<SupabaseQuote | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const paginatedQuotes = useMemo(
    () => filteredQuotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredQuotes, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, projectFilter, filteredQuotes.length]);

  return (
    <>
      <header className="bg-black/20  border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1">
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
      <div className="w-full min-w-0 p-2 sm:p-4 pt-0">
        <main className="space-y-6">
          <Card className="bg-white/80 dark:bg-gray-800/80  border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl">
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
                <>
                  {/* Vue Mobile Simple - Liste */}
                  <div className="md:hidden space-y-2">
                    {paginatedQuotes.map((q) => {
                      const expDate = getExpirationDate(q);
                      const expired = isExpired(q);
                      const transitions = STATUS_TRANSITIONS[q.status] ?? [];
                      return (
                        <div
                          key={q.id}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                N° {getQuoteDisplayNumber(quotes, q.id) || "—"}
                              </p>
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {q.client_name || "—"}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                q.status === "validé" || q.status === "accepté" || q.status === "signé"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs shrink-0"
                                  : q.status === "refusé" || q.status === "expiré"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs shrink-0"
                                    : q.status === "envoyé"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs shrink-0"
                                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs shrink-0"
                              }
                            >
                              {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs mb-2">
                            <span className="text-gray-600 dark:text-gray-400">
                              {q.chantier_id ? chantierMap.get(q.chantier_id) || "—" : "—"}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(q.total_ttc)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {q.status === "accepté" || q.status === "validé" || q.status === "signé" ? (
                                <span>—</span>
                              ) : expired ? (
                                <span className="text-red-600">Expiré</span>
                              ) : (
                                <span>{expDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
                              )}
                            </span>
                            <div className="flex gap-1">
                              {q.status !== "validé" && q.status !== "accepté" && q.status !== "signé" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-violet-500 hover:bg-violet-500/10"
                                  onClick={() => onEditQuote(q.id)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-violet-500 hover:bg-violet-500/10"
                                onClick={() => onDownloadPdf(q)}
                                title="Télécharger"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => onDuplicateQuote(q)}>
                                    <Copy className="h-3 w-3 mr-2" />
                                    <span className="text-xs">Dupliquer</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onSendEmail(q)}>
                                    <Mail className="h-3 w-3 mr-2" />
                                    <span className="text-xs">Envoyer</span>
                                  </DropdownMenuItem>
                                  {q.chantier_id && (
                                    <DropdownMenuItem onClick={() => onGoToProjects(q.chantier_id!)}>
                                      <ExternalLink className="h-3 w-3 mr-2" />
                                      <span className="text-xs">Projet</span>
                                    </DropdownMenuItem>
                                  )}
                                  {transitions.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="text-xs">
                                          <RefreshCw className="h-3 w-3 mr-2" />
                                          Statut
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          {transitions.map((s) => (
                                            <DropdownMenuItem key={s} className="text-xs" onClick={() => onChangeStatus(q.id, s)}>
                                              {QUOTE_STATUS_LABELS[s] ?? s}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 text-xs"
                                    onClick={() => setDeleteTarget(q)}
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vue Desktop - Tableau */}
                  <div className="hidden md:block rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <Table className="min-w-[900px]">
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
                        {paginatedQuotes.map((q) => {
                          const expDate = getExpirationDate(q);
                          const expired = isExpired(q);
                          const transitions = STATUS_TRANSITIONS[q.status] ?? [];
                          return (
                            <TableRow
                              key={q.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                              onClick={() => {
                                if (q.status !== "validé" && q.status !== "accepté" && q.status !== "signé") {
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
                                    q.status === "validé" || q.status === "accepté" || q.status === "signé"
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
                                {q.status === "accepté" || q.status === "validé" || q.status === "signé" ? (
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
                                    {q.status !== "validé" && q.status !== "accepté" && q.status !== "signé" && (
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
                                    <DropdownMenuItem onClick={() => onSendEmail(q)}>
                                      <Mail className="h-4 w-4 mr-2" />
                                      Envoyer par email
                                    </DropdownMenuItem>
                                    {q.chantier_id && (
                                      <DropdownMenuItem onClick={() => onGoToProjects(q.chantier_id!)}>
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredQuotes.length)} sur {filteredQuotes.length} devis
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                          Page {currentPage} sur {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
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
