import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/context/AuthContext';
import { useTeamEffectiveUserId } from '@/context/TeamEffectiveUserIdContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, X, Calendar as CalendarIcon, FileDown } from 'lucide-react';
import {
  insertInvoice,
  updateInvoice,
  type InvoiceItem,
  type InvoiceWithPayments,
  type NewInvoicePayload,
} from '@/lib/supabaseInvoices';
import { fetchQuoteById } from '@/lib/supabaseQuotes';
import { downloadInvoicePdf, fetchLogoDataUrl } from '@/lib/invoicePdf';
import { useUserSettings } from '@/context/UserSettingsContext';
import type { SupabaseInvoice } from '@/lib/supabaseInvoices';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: InvoiceWithPayments | null;
  quoteId?: string | null;
  chantierId?: string | null;
  clientId?: string | null;
  onSaved: () => void;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateToDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (y == null || m == null || d == null || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function calculateDueDate(invoiceDate: string, paymentTerms: string): string {
  const date = new Date(invoiceDate);
  if (paymentTerms.includes('réception') || paymentTerms.includes('Réception')) {
    date.setDate(date.getDate() + 0);
  } else if (paymentTerms.includes('30')) {
    date.setDate(date.getDate() + 30);
  } else if (paymentTerms.includes('45')) {
    date.setDate(date.getDate() + 45);
  } else if (paymentTerms.includes('60')) {
    date.setDate(date.getDate() + 60);
  } else {
    date.setDate(date.getDate() + 30);
  }
  return dateToISO(date);
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  quoteId,
  chantierId,
  clientId,
  onSaved,
}: InvoiceDialogProps) {
  const { user } = useAuth();
  const effectiveUserId = useTeamEffectiveUserId();
  const userId = effectiveUserId ?? user?.id ?? null;
  const { clients, chantiers } = useChantiers();
  const { logoUrl, profile, themeColor } = useUserSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedChantierId, setSelectedChantierId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState(dateToISO(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Paiement à 30 jours (net)');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [invoiceDatePickerOpen, setInvoiceDatePickerOpen] = useState(false);
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (invoice) {
        // Mode édition (normaliser les anciennes conditions de paiement)
        const termsMap: Record<string, string> = {
          '30 jours net': 'Paiement à 30 jours (net)',
          '45 jours net': 'Paiement à 45 jours (net)',
          '60 jours net': 'Paiement à 60 jours (net)',
          'Acompte 30%': 'Acompte 30 % à la commande',
          'Acompte 50%': 'Acompte 50 % à la commande',
        };
        const paymentTermsValue = termsMap[invoice.payment_terms] ?? invoice.payment_terms;
        setSelectedClientId(invoice.client_id || '');
        setSelectedChantierId(invoice.chantier_id || '');
        setInvoiceDate(invoice.invoice_date);
        setDueDate(invoice.due_date);
        setPaymentTerms(paymentTermsValue);
        setItems(invoice.items || [{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setNotes(invoice.notes || '');
      } else if (quoteId) {
        // Mode création depuis devis
        const loadQuote = async () => {
          if (!userId) return;
          try {
            const quote = await fetchQuoteById(userId, quoteId);
            if (quote) {
              setSelectedClientId(quote.chantier_id ? chantiers.find((c) => c.id === quote.chantier_id)?.clientId || '' : '');
              setSelectedChantierId(quote.chantier_id || '');
              setItems((quote.items || []) as InvoiceItem[]);
              setPaymentTerms('Paiement à 30 jours (net)');
              setInvoiceDate(dateToISO(new Date()));
              setDueDate(calculateDueDate(dateToISO(new Date()), 'Paiement à 30 jours (net)'));
            }
          } catch (error) {
            console.error('Error loading quote:', error);
          }
        };
        loadQuote();
      } else {
        // Mode création manuelle
        setSelectedClientId(clientId || '');
        setSelectedChantierId(chantierId || '');
        setInvoiceDate(dateToISO(new Date()));
        setDueDate(calculateDueDate(dateToISO(new Date()), 'Paiement à 30 jours (net)'));
        setPaymentTerms('Paiement à 30 jours (net)');
        setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setNotes('');
      }
    }
  }, [open, invoice, quoteId, chantierId, clientId, userId, chantiers]);

  useEffect(() => {
    if (paymentTerms && invoiceDate) {
      setDueDate(calculateDueDate(invoiceDate, paymentTerms));
    }
  }, [paymentTerms, invoiceDate]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedChantier = chantiers.find((c) => c.id === selectedChantierId);

  const getItemTotal = (item: InvoiceItem): number => {
    if (item.subItems?.length) {
      return item.subItems.reduce((s, sub) => s + sub.total, 0);
    }
    return item.quantity * item.unitPrice;
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const tva = subtotal * 0.2;
  const total = subtotal + tva;

  const handleDownloadPdf = async () => {
    if (!userId) return;
    const clientAddress = selectedClient
      ? [selectedClient.street_address, selectedClient.postal_code, selectedClient.city].filter(Boolean).join(', ')
      : null;
    const draftInvoice: SupabaseInvoice = {
      id: invoice?.id ?? 'draft',
      user_id: userId,
      invoice_number: invoice?.invoice_number ?? 'Brouillon',
      quote_id: quoteId ?? null,
      chantier_id: selectedChantierId || null,
      client_id: selectedClientId || null,
      client_name: selectedClient?.name ?? 'Client non renseigné',
      client_email: selectedClient?.email ?? null,
      client_phone: selectedClient?.phone ?? null,
      client_address: clientAddress ?? null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      payment_terms: paymentTerms,
      items,
      subtotal_ht: subtotal,
      tva_amount: tva,
      total_ttc: total,
      status: 'brouillon',
      notes: notes || null,
      deleted_at: null,
      created_at: invoice?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDownloadingPdf(true);
    try {
      const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : null;
      downloadInvoicePdf({
        invoice: draftInvoice,
        companyName: profile?.company_name || profile?.full_name || '',
        companyAddress: profile?.company_address || '',
        companyCityPostal: profile?.company_city_postal || '',
        companyPhone: profile?.company_phone || '',
        companyEmail: profile?.company_email || '',
        companySiret: profile?.company_siret || '',
        companyLegal: profile?.company_legal || undefined,
        themeColor: themeColor || undefined,
        logoDataUrl,
      });
      toast({ title: 'PDF téléchargé' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    if (!selectedClientId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un client',
        variant: 'destructive',
      });
      return;
    }

    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      toast({
        title: 'Erreur',
        description: 'Veuillez ajouter au moins un article',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: NewInvoicePayload = {
        quote_id: quoteId || null,
        chantier_id: selectedChantierId || null,
        client_id: selectedClientId,
        client_name: selectedClient?.name || '',
        client_email: selectedClient?.email || '',
        client_phone: selectedClient?.phone || '',
        client_address: '',
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        items,
        subtotal_ht: subtotal,
        tva_amount: tva,
        total_ttc: total,
        notes: notes || null,
      };

      if (invoice) {
        await updateInvoice(userId, invoice.id, payload);
        toast({
          title: 'Succès',
          description: 'Facture modifiée avec succès',
        });
      } else {
        await insertInvoice(userId, payload);
        toast({
          title: 'Succès',
          description: 'Facture créée avec succès',
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la facture',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-black/90 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {invoice ? 'Modifier la facture' : 'Nouvelle facture'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client et Chantier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white">Chantier</Label>
              <Select
                value={selectedChantierId || "none"}
                onValueChange={(v) => setSelectedChantierId(v === "none" ? "" : v)}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {chantiers
                    .filter((c) => !selectedClientId || c.clientId === selectedClientId)
                    .map((chantier) => (
                      <SelectItem key={chantier.id} value={chantier.id}>
                        {chantier.nom}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-white">Date d'émission *</Label>
              <Popover open={invoiceDatePickerOpen} onOpenChange={setInvoiceDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30 hover:border-white/20"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    {invoiceDate ? formatDateToDDMMYYYY(invoiceDate) : 'JJ/MM/AAAA'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={isoToDate(invoiceDate) ?? undefined}
                    onSelect={(d) => {
                      if (d) {
                        setInvoiceDate(dateToISO(d));
                        setDueDate(calculateDueDate(dateToISO(d), paymentTerms));
                        setInvoiceDatePickerOpen(false);
                      }
                    }}
                    classNames={{
                      day: "text-white hover:bg-white/20",
                      caption_label: "text-white",
                      nav_button: "text-white",
                      head_cell: "text-white/70",
                      day_outside: "text-white/40",
                      day_today: "bg-white/20 text-white",
                      day_selected: "bg-violet-500 text-white",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-white">Conditions de paiement</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paiement à 30 jours (net)">Paiement à 30 jours (net)</SelectItem>
                  <SelectItem value="Paiement à 45 jours (net)">Paiement à 45 jours (net)</SelectItem>
                  <SelectItem value="Paiement à 60 jours (net)">Paiement à 60 jours (net)</SelectItem>
                  <SelectItem value="Paiement à réception">Paiement à réception</SelectItem>
                  <SelectItem value="Acompte 30 % à la commande">Acompte 30 % à la commande</SelectItem>
                  <SelectItem value="Acompte 50 % à la commande">Acompte 50 % à la commande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white">Date d'échéance *</Label>
              <Popover open={dueDatePickerOpen} onOpenChange={setDueDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30 hover:border-white/20"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    {dueDate ? formatDateToDDMMYYYY(dueDate) : 'JJ/MM/AAAA'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={isoToDate(dueDate) ?? undefined}
                    onSelect={(d) => {
                      if (d) {
                        setDueDate(dateToISO(d));
                        setDueDatePickerOpen(false);
                      }
                    }}
                    classNames={{
                      day: "text-white hover:bg-white/20",
                      caption_label: "text-white",
                      nav_button: "text-white",
                      head_cell: "text-white/70",
                      day_outside: "text-white/40",
                      day_today: "bg-white/20 text-white",
                      day_selected: "bg-violet-500 text-white",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Articles */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-white">Articles</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex gap-2 items-start p-3 bg-black/20 rounded-lg">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white mb-2"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="Quantité"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="bg-black/20 backdrop-blur-md border-white/10 text-white"
                      />
                      <Input
                        type="number"
                        placeholder="Prix unitaire HT"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="bg-black/20 backdrop-blur-md border-white/10 text-white"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          value={getItemTotal(item).toFixed(2) + ' €'}
                          disabled
                          className="bg-black/20 backdrop-blur-md border-white/10 text-white/70"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-white/70">
                <span>Total HT</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>TVA (20%)</span>
                <span>{tva.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-white font-bold text-lg border-t border-white/20 pt-2">
                <span>Total TTC</span>
                <span>{total.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-white">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes internes..."
              rows={3}
              className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-white border-white/20 hover:bg-white/10"
            >
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="text-white border-white/20 hover:bg-white/10"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {downloadingPdf ? 'Génération...' : 'Télécharger PDF'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
            >
              {saving ? 'Enregistrement...' : invoice ? 'Modifier' : 'Créer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
