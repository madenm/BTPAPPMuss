import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useTeamEffectiveUserId } from '@/context/TeamEffectiveUserIdContext';
import { useToast } from '@/hooks/use-toast';
import { insertPayment, type NewPaymentPayload } from '@/lib/supabaseInvoices';
import { CheckCircle } from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingAmount: number;
  onSaved: () => void;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  remainingAmount,
  onSaved,
}: PaymentDialogProps) {
  const { user } = useAuth();
  const effectiveUserId = useTeamEffectiveUserId();
  const userId = effectiveUserId ?? user?.id ?? null;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(dateToISO(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<'virement' | 'cheque' | 'especes' | 'carte' | 'autre'>('virement');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaymentDate(dateToISO(new Date()));
      setPaymentMethod('virement');
      setReference('');
      setNotes('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!userId) return;

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast({
        title: 'Erreur',
        description: 'Veuillez saisir un montant valide',
        variant: 'destructive',
      });
      return;
    }

    if (amountNum > remainingAmount) {
      toast({
        title: 'Erreur',
        description: `Le montant ne peut pas dépasser ${remainingAmount.toFixed(2)} €`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: NewPaymentPayload = {
        amount: amountNum,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      };

      await insertPayment(userId, invoiceId, payload);
      toast({
        title: 'Succès',
        description: 'Paiement enregistré avec succès',
      });

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving payment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer le paiement',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Enregistrer un paiement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Montant restant</Label>
            <Input
              value={`${remainingAmount.toFixed(2)} €`}
              disabled
              className="bg-black/10 backdrop-blur-md border-white/10 text-white/70"
            />
          </div>

          <div>
            <Label className="text-white">Montant payé *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                max={remainingAmount}
                className="bg-black/10 backdrop-blur-md border-white/10 text-white flex-1"
              />
              {remainingAmount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(remainingAmount.toFixed(2))}
                  className="text-white border-white/20 hover:bg-white/10 whitespace-nowrap"
                  title="Remplir avec le montant restant"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Montant total
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label className="text-white">Date de paiement *</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={dateToISO(new Date())}
              className="bg-black/10 backdrop-blur-md border-white/10 text-white"
            />
          </div>

          <div>
            <Label className="text-white">Méthode de paiement *</Label>
            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <SelectTrigger className="bg-black/10 backdrop-blur-md border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="virement">Virement</SelectItem>
                <SelectItem value="cheque">Chèque</SelectItem>
                <SelectItem value="especes">Espèces</SelectItem>
                <SelectItem value="carte">Carte bancaire</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Référence</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Numéro de chèque, virement, etc."
              className="bg-black/10 backdrop-blur-md border-white/10 text-white"
            />
          </div>

          <div>
            <Label className="text-white">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur le paiement..."
              rows={3}
              className="bg-black/10 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-white border-white/20 hover:bg-white/10"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
