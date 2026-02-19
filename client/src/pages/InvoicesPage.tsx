import { useState, useEffect, useMemo } from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserAccountButton } from '@/components/UserAccountButton';
import { useAuth } from '@/context/AuthContext';
import { useTeamEffectiveUserId } from '@/context/TeamEffectiveUserIdContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Plus,
  Search,
  Edit,
  Mail,
  Download,
  X,
  Calendar,
  Building,
  User,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Euro,
} from 'lucide-react';
import {
  fetchInvoicesForUser,
  type InvoiceWithPayments,
  type SupabaseInvoice,
} from '@/lib/supabaseInvoices';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { InvoiceDetailDialog } from '@/components/InvoiceDetailDialog';

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-500',
  envoyée: 'bg-blue-500',
  payée: 'bg-green-500',
  partiellement_payée: 'bg-yellow-500',
  annulée: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyée: 'En attente de paiement',
  payée: 'Payée',
  partiellement_payée: 'Partiellement payée',
  annulée: 'Annulée',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const effectiveUserId = useTeamEffectiveUserId();
  const userId = effectiveUserId ?? user?.id ?? null;
  const { clients, chantiers } = useChantiers();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [filterChantierId, setFilterChantierId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithPayments | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithPayments | null>(null);

  // Générer les années disponibles (année courante et 2 ans avant)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => currentYear - i);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const loadInvoices = async () => {
      setLoading(true);
      try {
        const filters: any = {};
        if (filterClientId !== 'all') filters.clientId = filterClientId;
        if (filterChantierId !== 'all') filters.chantierId = filterChantierId;
        if (filterStatus !== 'all') filters.status = filterStatus;
        if (filterYear !== 'all') filters.year = parseInt(filterYear);

        const data = await fetchInvoicesForUser(userId, filters);
        setInvoices(data);
      } catch (error) {
        console.error('Error loading invoices:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les factures',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [userId, filterClientId, filterChantierId, filterStatus, filterYear, toast]);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;

    const query = searchQuery.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.client_name.toLowerCase().includes(query)
    );
  }, [invoices, searchQuery]);

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleEditInvoice = (invoice: InvoiceWithPayments) => {
    setEditingInvoice(invoice);
    setIsInvoiceDialogOpen(true);
  };

  const handleViewInvoice = (invoice: InvoiceWithPayments) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailOpen(true);
  };

  const handleInvoiceSaved = () => {
    setIsInvoiceDialogOpen(false);
    setEditingInvoice(null);
    // Recharger les factures
    if (userId) {
      const loadInvoices = async () => {
        try {
          const filters: any = {};
          if (filterClientId !== 'all') filters.clientId = filterClientId;
          if (filterChantierId !== 'all') filters.chantierId = filterChantierId;
          if (filterStatus !== 'all') filters.status = filterStatus;
          if (filterYear !== 'all') filters.year = parseInt(filterYear);

          const data = await fetchInvoicesForUser(userId, filters);
          setInvoices(data);
        } catch (error) {
          console.error('Error reloading invoices:', error);
        }
      };
      loadInvoices();
    }
  };

  return (
    <PageWrapper>
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0 sm:flex-nowrap">
          <div className="min-w-0 w-full sm:flex-1 max-md:pl-16">
            <h1 className="text-lg sm:text-3xl font-bold text-white sm:truncate">Factures</h1>
            <p className="text-white/70 mt-1 text-xs sm:text-base sm:truncate">Gérez vos factures et paiements</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 w-full sm:w-auto flex-wrap">
            <Button
              onClick={handleCreateInvoice}
              className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 max-md:min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle facture
            </Button>
            <UserAccountButton variant="inline" />
          </div>
        </div>

        {/* Filtres */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 w-full min-w-0"
                />
              </div>
              <Select value={filterClientId} onValueChange={setFilterClientId}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white w-full min-w-0">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterChantierId} onValueChange={setFilterChantierId}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white w-full min-w-0">
                  <SelectValue placeholder="Chantier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les chantiers</SelectItem>
                  {chantiers.map((chantier) => (
                    <SelectItem key={chantier.id} value={chantier.id}>
                      {chantier.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white w-full min-w-0">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="envoyée">En attente de paiement</SelectItem>
                  <SelectItem value="payée">Payée</SelectItem>
                  <SelectItem value="partiellement_payée">Partiellement payée</SelectItem>
                  <SelectItem value="annulée">Annulée</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white w-full min-w-0">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les années</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tableau des factures */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-white/70">Chargement...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-white/70">
                Aucune facture trouvée
              </div>
            ) : (
              <>
                {/* Vue cartes - mobile uniquement */}
                <div className="max-md:block md:hidden space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const paidAmount = invoice.paidAmount || 0;
                    const totalTtc = invoice.total_ttc;
                    const remainingAmount = invoice.remainingAmount || totalTtc;
                    const paidPercentage = totalTtc > 0 ? Math.min((paidAmount / totalTtc) * 100, 100) : 0;
                    const statusIcon = invoice.status === 'payée' ? CheckCircle :
                                      invoice.status === 'partiellement_payée' ? AlertCircle :
                                      invoice.status === 'envoyée' ? Clock :
                                      invoice.status === 'annulée' ? XCircle : FileText;
                    const StatusIcon = statusIcon;
                    return (
                      <div
                        key={invoice.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleViewInvoice(invoice)}
                        onKeyDown={(e) => e.key === 'Enter' && handleViewInvoice(invoice)}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-all duration-200 text-white"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-white/50" />
                            <span className="font-medium truncate">{invoice.invoice_number}</span>
                          </div>
                          <Badge
                            className={`${STATUS_COLORS[invoice.status] || 'bg-gray-500'} text-white px-2 py-1 text-xs flex items-center gap-1 shrink-0`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {STATUS_LABELS[invoice.status] || invoice.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-white/80 flex items-center gap-2 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-white/50 shrink-0" />
                          {formatDate(invoice.invoice_date)}
                        </div>
                        <div className="text-sm text-white/90 flex items-center gap-2 mb-2">
                          <User className="h-3.5 w-3.5 text-white/50 shrink-0" />
                          <span className="truncate">{invoice.client_name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm mb-2">
                          <span className="text-white/70">Montant TTC</span>
                          <span className="font-semibold flex items-center gap-1">
                            <Euro className="h-3.5 w-3.5" />
                            {formatCurrency(totalTtc)}
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Payé: {formatCurrency(paidAmount)}</span>
                            <span className="text-white/80">Reste: {formatCurrency(remainingAmount)}</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                paidPercentage >= 100 ? 'bg-green-500' :
                                paidPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-500'
                              }`}
                              style={{ width: `${paidPercentage}%` }}
                            />
                          </div>
                        </div>
                        {(invoice.status === 'brouillon' || (invoice.status === 'envoyée' && remainingAmount > 0)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }}
                            className="w-full min-h-[44px] text-white border-white/20 hover:bg-white/10"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tableau - desktop */}
                <div className="max-md:hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 bg-white/5">
                        <TableHead className="text-white font-semibold">Numéro</TableHead>
                        <TableHead className="text-white font-semibold">Date</TableHead>
                        <TableHead className="text-white font-semibold">Client</TableHead>
                        <TableHead className="text-white font-semibold">Chantier</TableHead>
                        <TableHead className="text-white text-right font-semibold">Montant TTC</TableHead>
                        <TableHead className="text-white text-right font-semibold">Payé / Restant</TableHead>
                        <TableHead className="text-white font-semibold">Statut</TableHead>
                        <TableHead className="text-white text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice, index) => {
                        const paidAmount = invoice.paidAmount || 0;
                        const totalTtc = invoice.total_ttc;
                        const remainingAmount = invoice.remainingAmount || totalTtc;
                        const paidPercentage = totalTtc > 0 ? Math.min((paidAmount / totalTtc) * 100, 100) : 0;
                        const statusIcon = invoice.status === 'payée' ? CheckCircle :
                                          invoice.status === 'partiellement_payée' ? AlertCircle :
                                          invoice.status === 'envoyée' ? Clock :
                                          invoice.status === 'annulée' ? XCircle : FileText;
                        const StatusIcon = statusIcon;
                        
                        return (
                          <TableRow
                            key={invoice.id}
                            className={`border-white/10 hover:bg-white/10 cursor-pointer transition-all duration-200 ${index % 2 === 0 ? 'bg-white/2' : ''}`}
                            onClick={() => handleViewInvoice(invoice)}
                          >
                            <TableCell className="text-white font-medium p-6">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-white/50" />
                                {invoice.invoice_number}
                              </div>
                            </TableCell>
                            <TableCell className="text-white/80 p-6">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-white/50" />
                                {formatDate(invoice.invoice_date)}
                              </div>
                            </TableCell>
                            <TableCell className="text-white p-6">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-white/50" />
                                {invoice.client_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-white/70 p-6">
                              {invoice.chantier_id
                                ? chantiers.find((c) => c.id === invoice.chantier_id)?.nom || '—'
                                : '—'}
                            </TableCell>
                            <TableCell className="text-white text-right p-6">
                              <div className="flex items-center justify-end gap-2">
                                <Euro className="h-4 w-4 text-white/50" />
                                <span className="text-lg font-semibold">{formatCurrency(totalTtc)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-white/90 text-right p-6">
                              <div className="space-y-2 min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 text-sm">
                                  <span className="text-white/70">Payé:</span>
                                  <span className="font-medium">{formatCurrency(paidAmount)}</span>
                                </div>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      paidPercentage >= 100 ? 'bg-green-500' :
                                      paidPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-500'
                                    }`}
                                    style={{ width: `${paidPercentage}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-white/60">Reste:</span>
                                  <span className="text-white/80">{formatCurrency(remainingAmount)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="p-6">
                              <Badge
                                className={`${STATUS_COLORS[invoice.status] || 'bg-gray-500'} text-white px-3 py-1.5 shadow-sm flex items-center gap-1.5 w-fit`}
                              >
                                <StatusIcon className="h-3.5 w-3.5" />
                                {STATUS_LABELS[invoice.status] || invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right p-6">
                              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                {(invoice.status === 'brouillon' ||
                                  (invoice.status === 'envoyée' && remainingAmount > 0)) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="text-white hover:bg-white/10 transition-colors"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialogues */}
        <InvoiceDialog
          open={isInvoiceDialogOpen}
          onOpenChange={setIsInvoiceDialogOpen}
          invoice={editingInvoice}
          onSaved={handleInvoiceSaved}
        />

        {selectedInvoice && (
          <InvoiceDetailDialog
            open={isInvoiceDetailOpen}
            onOpenChange={setIsInvoiceDetailOpen}
            invoice={selectedInvoice}
            onUpdated={handleInvoiceSaved}
          />
        )}
      </main>
    </PageWrapper>
  );
}
