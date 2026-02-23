import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserAccountButton } from "@/components/UserAccountButton";
import { QUOTE_STATUS_LABELS } from "@/lib/quoteConstants";
import type { SupabaseQuote } from "@/lib/supabaseQuotes";
import { FileText, Plus, Loader2, Download, Pencil, ExternalLink, Search } from "lucide-react";

export interface QuoteListProps {
  quotes: SupabaseQuote[];
  loading: boolean;
  statusFilter: string;
  searchQuery: string;
  onStatusFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  filteredQuotes: SupabaseQuote[];
  getQuoteDisplayNumber: (quotes: SupabaseQuote[], id: string) => string | undefined;
  onNewQuote: () => void;
  onEditQuote: (quoteId: string) => void;
  onDownloadPdf: (quote: SupabaseQuote) => void;
  onGoToProjects: () => void;
}

export function QuoteList({
  quotes,
  loading,
  statusFilter,
  searchQuery,
  onStatusFilterChange,
  onSearchQueryChange,
  filteredQuotes,
  getQuoteDisplayNumber,
  onNewQuote,
  onEditQuote,
  onDownloadPdf,
  onGoToProjects,
}: QuoteListProps) {
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
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right rounded-tr-xl">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((q) => (
                        <TableRow
                          key={q.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                          onClick={() => onEditQuote(q.id)}
                        >
                          <TableCell className="font-mono text-sm">
                            {getQuoteDisplayNumber(quotes, q.id) || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            {q.client_name || "—"}
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
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onEditQuote(q.id)}
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onDownloadPdf(q)}
                                title="Télécharger le PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {q.chantier_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={onGoToProjects}
                                  title="Voir le projet"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
