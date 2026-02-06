import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAccountButton } from '@/components/UserAccountButton';
import { useChantiers, type Client } from '@/context/ChantiersContext';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type FilterStatus = 'all' | 'actifs' | 'terminés';

function formatCreatedAt(created_at?: string): string {
  if (!created_at) return '—';
  return new Date(created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0[67]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

function normalizePhone(s: string): string {
  return s.replace(/\s/g, '');
}

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (payload: { name: string; email: string; phone: string; street_address?: string; postal_code?: string; city?: string }) => Promise<void>;
  isSaving: boolean;
}

function ClientFormModal({ open, onOpenChange, client, onSave, isSaving }: ClientFormModalProps) {
  const isEdit = !!client;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (client) {
        setName(client.name);
        setEmail(client.email);
        setPhone(client.phone);
        setStreetAddress(client.street_address ?? '');
        setPostalCode(client.postal_code ?? '');
        setCity(client.city ?? '');
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setStreetAddress('');
        setPostalCode('');
        setCity('');
      }
      setErrors({});
    }
  }, [open, client]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Nom requis';
    if (!email.trim()) err.email = 'Email requis';
    else if (!EMAIL_REGEX.test(email)) err.email = 'Format email invalide';
    if (!phone.trim()) err.phone = 'Téléphone requis';
    else if (!PHONE_REGEX.test(normalizePhone(phone))) err.phone = 'Format 06/07 XX XX XX XX';
    if (postalCode.trim() && !/^\d{5}$/.test(postalCode)) err.postalCode = '5 chiffres';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      street_address: streetAddress.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      city: city.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            {isEdit ? `Modifier : ${client.name}` : 'Ajouter un nouveau client'}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {isEdit ? 'Modifiez les informations du client.' : 'Remplissez les champs pour créer un client.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-gray-700">Nom complet *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paul Dupont"
              className={`mt-1 border-[#E5E7EB] ${errors.name ? 'border-red-500' : ''}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-gray-700">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dupont@email.com"
              className={`mt-1 border-[#E5E7EB] ${errors.email ? 'border-red-500' : ''}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-gray-700">Téléphone *</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className={`mt-1 border-[#E5E7EB] ${errors.phone ? 'border-red-500' : ''}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}
          </div>
          <div>
            <Label className="text-gray-700">Adresse</Label>
            <Input
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="15 rue de la Paix..."
              className="mt-1 border-[#E5E7EB]"
            />
          </div>
          <div>
            <Label className="text-gray-700">Code postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="75000"
              maxLength={10}
              className={`mt-1 border-[#E5E7EB] ${errors.postalCode ? 'border-red-500' : ''}`}
            />
            {errors.postalCode && <p className="text-xs text-red-500 mt-0.5">{errors.postalCode}</p>}
          </div>
          <div>
            <Label className="text-gray-700">Ville</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
              className="mt-1 border-[#E5E7EB]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E5E7EB]">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-[#3B82F6] hover:bg-[#2563EB]">
            {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const { clients, chantiers, addClient, updateClient, deleteClient } = useChantiers();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const filteredClients = useMemo(() => {
    let list = clients;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }

    if (filterStatus === 'actifs') {
      list = list.filter((c) =>
        chantiers.some((ch) => ch.clientId === c.id && ch.statut === 'en cours')
      );
    } else if (filterStatus === 'terminés') {
      list = list.filter((c) => {
        const clientChantiers = chantiers.filter((ch) => ch.clientId === c.id);
        return clientChantiers.length > 0 && clientChantiers.every((ch) => ch.statut === 'terminé');
      });
    }

    return list;
  }, [clients, debouncedSearch, filterStatus, chantiers]);

  const handleSave = useCallback(
    async (payload: { name: string; email: string; phone: string; street_address?: string; postal_code?: string; city?: string }) => {
      setIsSaving(true);
      try {
        if (editingClient) {
          await updateClient(editingClient.id, payload);
          toast({ title: 'Client modifié avec succès' });
        } else {
          await addClient(payload);
          toast({ title: 'Client créé avec succès' });
        }
        setIsModalOpen(false);
        setEditingClient(null);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
    },
    [editingClient, updateClient, addClient, toast]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return false;
    setIsDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      toast({ title: 'Client supprimé' });
      setDeleteTarget(null);
      return true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, deleteClient, toast]);

  return (
    <PageWrapper>
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des clients</h1>
            <p className="text-sm text-gray-600">Recherchez, éditez et gérez vos clients</p>
          </div>
          <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 p-6 bg-[#FAFBFC]">
        <div className="space-y-4 mb-6">
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md border-[#E5E7EB] bg-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-[160px] border-[#E5E7EB] bg-white">
                <SelectValue placeholder="Filtre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="actifs">Actifs</SelectItem>
                <SelectItem value="terminés">Terminés</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditingClient(null);
                setIsModalOpen(true);
              }}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter client
            </Button>
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <Card className="bg-white border border-[#E5E7EB] p-12 text-center">
            <p className="text-gray-600">Aucun client trouvé.</p>
            <Button className="mt-4 bg-[#3B82F6] hover:bg-[#2563EB]" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un client
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="bg-white border border-[#E5E7EB] rounded-lg p-4 transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              >
                <CardContent className="p-0">
                  <p className="font-semibold text-base text-gray-900 truncate">{client.name}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Phone className="h-4 w-4 shrink-0 text-gray-500" />
                      <span>{client.phone}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Créé : {formatCreatedAt(client.created_at)}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClient(client);
                        setIsModalOpen(true);
                      }}
                      className="border-[#E5E7EB] bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(client);
                      }}
                      className="border-[#E5E7EB] bg-gray-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-700 px-3 py-1.5 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <ClientFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        client={editingClient}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[380px] bg-white border border-[#E5E7EB]">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de supprimer &quot;{deleteTarget?.name}&quot; ? Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E7EB]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                const ok = await handleDeleteConfirm();
                if (ok) setDeleteTarget(null);
              }}
              disabled={isDeleting}
              className="bg-[#EF4444] hover:bg-[#DC2626]"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
