import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getApiPostHeaders } from '@/lib/apiHeaders';
import { useAuth } from '@/context/AuthContext';
import { useTeamEffectiveUserId } from '@/context/TeamEffectiveUserIdContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  Mail,
  Edit,
  X,
  Trash2,
  Plus,
  Calendar,
  Building,
  User,
  FileText,
} from 'lucide-react';
import {
  fetchInvoiceById,
  cancelInvoice,
  deletePayment,
  type InvoiceWithPayments,
} from '@/lib/supabaseInvoices';
import { downloadInvoicePdf, fetchLogoDataUrl, buildInvoiceEmailHtml } from '@/lib/invoicePdf';
import { PaymentDialog } from './PaymentDialog';

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  carte: 'Carte bancaire',
  autre: 'Autre',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceWithPayments;
  onUpdated: () => void;
}

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice: initialInvoice,
  onUpdated,
}: InvoiceDetailDialogProps) {
  const { user, session } = useAuth();
  const effectiveUserId = useTeamEffectiveUserId();
  const userId = effectiveUserId ?? user?.id ?? null;
  const { chantiers } = useChantiers();
  const { logoUrl, profile, themeColor } = useUserSettings();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<InvoiceWithPayments>(initialInvoice);
  const [loading, setLoading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (open && userId) {
      const loadInvoice = async () => {
        try {
          const updated = await fetchInvoiceById(userId, initialInvoice.id);
          if (updated) setInvoice(updated);
        } catch (error) {
          console.error('Error loading invoice:', error);
        }
      };
      loadInvoice();
    }
  }, [open, initialInvoice.id, userId]);

  const handleDownloadPdf = async () => {
    if (!userId) return;

    try {
      const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : null;
      downloadInvoicePdf({
        invoice,
        companyName: profile?.full_name || '',
        companyAddress: profile?.company_address || '',
        companyCityPostal: profile?.company_city_postal || '',
        companyPhone: profile?.company_phone || '',
        companyEmail: profile?.company_email || '',
        companySiret: profile?.company_siret || '',
        themeColor: themeColor || undefined,
        logoDataUrl,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    }
  };

  const handleSendEmail = async () => {
    if (!userId || !invoice.client_email) {
      toast({
        title: 'Erreur',
        description: 'Aucune adresse email pour ce client',
        variant: 'destructive',
      });
      return;
    }

    setSendingEmail(true);
    try {
      const emailHtml = buildInvoiceEmailHtml({
        clientName: invoice.client_name ?? '',
        clientEmail: invoice.client_email,
        clientPhone: invoice.client_phone,
        clientAddress: invoice.client_address,
        invoiceNumber: invoice.invoice_number ?? '',
        items: invoice.items ?? [],
        subtotalHt: invoice.subtotal_ht ?? 0,
        tvaAmount: invoice.tva_amount ?? 0,
        total: invoice.total_ttc ?? 0,
        dueDate: invoice.due_date ?? new Date().toISOString(),
        paymentTerms: invoice.payment_terms ?? '',
        companyName: profile?.full_name ?? undefined,
        companyAddress: profile?.company_address,
        companyCityPostal: profile?.company_city_postal,
        companyPhone: profile?.company_phone,
        companyEmail: profile?.company_email,
        contactBlock: {
          contactName: profile?.full_name,
          phone: profile?.company_phone,
          email: profile?.company_email,
          address: profile?.company_address,
          cityPostal: profile?.company_city_postal,
        },
      });

      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({
          userId,
          to: invoice.client_email,
          subject: `Facture ${invoice.invoice_number}`,
          message: emailHtml,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Succès',
          description: 'Facture envoyée par email',
        });
        onUpdated();
      } else {
        throw new Error(data.message || 'Erreur envoi email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'envoyer l\'email',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!userId) return;
    if (!confirm('Êtes-vous sûr de vouloir annuler cette facture ?')) return;

    try {
      await cancelInvoice(userId, invoice.id);
      toast({
        title: 'Succès',
        description: 'Facture annulée',
      });
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error canceling invoice:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'annuler la facture',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!userId) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    try {
      await deletePayment(userId, paymentId);
      toast({
        title: 'Succès',
        description: 'Paiement supprimé',
      });
      onUpdated();
      // Recharger la facture
      const updated = await fetchInvoiceById(userId, invoice.id);
      if (updated) setInvoice(updated);
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le paiement',
        variant: 'destructive',
      });
    }
  };

  const canEdit = invoice.status === 'brouillon' || (invoice.status === 'envoyée' && (invoice.remainingAmount || invoice.total_ttc) > 0);
  const canCancel = invoice.status !== 'payée' && invoice.status !== 'annulée';
  const isFullyPaid = invoice.status === 'payée' || (invoice.remainingAmount !== undefined && invoice.remainingAmount <= 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-black/90 backdrop-blur-xl border-white/10 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white">Facture {invoice.invoice_number}</DialogTitle>
              <Badge className={`${STATUS_COLORS[invoice.status] || 'bg-gray-500'} text-white`}>
                {STATUS_LABELS[invoice.status] || invoice.status}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* En-tête */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-white/70 mb-2">Client</h3>
                <p className="text-white">{invoice.client_name}</p>
                {invoice.client_email && (
                  <p className="text-white/70 text-sm">{invoice.client_email}</p>
                )}
                {invoice.client_phone && (
                  <p className="text-white/70 text-sm">{invoice.client_phone}</p>
                )}
                {invoice.client_address && (
                  <p className="text-white/70 text-sm">{invoice.client_address}</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/70 mb-2">Informations</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-white/70">
                    <span className="text-white/50">Date d'émission:</span> {formatDate(invoice.invoice_date)}
                  </p>
                  <p className="text-white/70">
                    <span className="text-white/50">Date d'échéance:</span> {formatDate(invoice.due_date)}
                  </p>
                  <p className="text-white/70">
                    <span className="text-white/50">Conditions:</span> {invoice.payment_terms}
                  </p>
                  {invoice.chantier_id && (
                    <p className="text-white/70">
                      <span className="text-white/50">Projet:</span>{' '}
                      {chantiers.find((c) => c.id === invoice.chantier_id)?.nom || '—'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Articles */}
            <div>
              <h3 className="text-sm font-medium text-white/70 mb-3">Articles</h3>
              <div className="space-y-2">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3 bg-black/20 rounded-lg">
                    <div className="flex-1">
                      <p className="text-white">{item.description}</p>
                      <p className="text-white/70 text-sm">
                        {item.quantity} × {formatCurrency(item.unitPrice)} HT
                      </p>
                    </div>
                    <p className="text-white font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Totaux */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>Total HT</span>
                  <span>{formatCurrency(invoice.subtotal_ht)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>TVA (20%)</span>
                  <span>{formatCurrency(invoice.tva_amount)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg border-t border-white/20 pt-2">
                  <span>Total TTC</span>
                  <span>{formatCurrency(invoice.total_ttc)}</span>
                </div>
                {invoice.paidAmount !== undefined && invoice.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-400 pt-2 border-t border-white/20">
                      <span>Payé</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-yellow-400">
                      <span>Restant</span>
                      <span>{formatCurrency(invoice.remainingAmount || invoice.total_ttc)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Historique des paiements */}
            {invoice.payments && invoice.payments.length > 0 && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-3">Historique des paiements</h3>
                  <div className="space-y-2">
                    {invoice.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
                      >
                        <div>
                          <p className="text-white">
                            {formatCurrency(payment.amount)} - {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                          </p>
                          <p className="text-white/70 text-sm">
                            {formatDate(payment.payment_date)}
                            {payment.reference && ` - ${payment.reference}`}
                          </p>
                          {payment.notes && (
                            <p className="text-white/50 text-xs mt-1">{payment.notes}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-2">Notes</h3>
                  <p className="text-white/70 text-sm">{invoice.notes}</p>
                </div>
              </>
            )}

            {/* Actions */}
            <Separator className="bg-white/10" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
              {invoice.client_email && (
                <Button
                  variant="outline"
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {sendingEmail ? 'Envoi...' : 'Envoyer par email'}
                </Button>
              )}
              {!isFullyPaid && (invoice.remainingAmount || invoice.total_ttc) > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIsPaymentDialogOpen(true)}
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Enregistrer un paiement
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  onClick={handleCancelInvoice}
                  className="text-red-400 border-red-400/20 hover:bg-red-400/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Annuler la facture
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isPaymentDialogOpen && (
        <PaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          invoiceId={invoice.id}
          remainingAmount={invoice.remainingAmount || invoice.total_ttc}
          onSaved={() => {
            onUpdated();
            setIsPaymentDialogOpen(false);
            // Recharger la facture
            if (userId) {
              fetchInvoiceById(userId, invoice.id).then((updated) => {
                if (updated) setInvoice(updated);
              });
            }
          }}
        />
      )}
    </>
  );
}
