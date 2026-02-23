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
import { useAuth } from '@/context/AuthContext';
import { useChantiers, type Client } from '@/context/ChantiersContext';
import { useToast } from '@/hooks/use-toast';
import { createClientFormLink } from '@/lib/supabaseClients';
import { Search, Plus, Pencil, Trash2, Mail, Phone, Link2 } from 'lucide-react';

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
      <DialogContent className="max-w-[400px] bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? `Modifier : ${client.name}` : 'Ajouter un nouveau client'}
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {isEdit ? 'Modifiez les informations du client.' : 'Remplissez les champs pour créer un client.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-white">Nom complet *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paul Dupont"
              className={`mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 ${errors.name ? 'border-red-400' : ''}`}
            />
            {errors.name && <p className="text-xs text-red-300 mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-white">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dupont@email.com"
              className={`mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 ${errors.email ? 'border-red-400' : ''}`}
            />
            {errors.email && <p className="text-xs text-red-300 mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-white">Téléphone *</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className={`mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 ${errors.phone ? 'border-red-400' : ''}`}
            />
            {errors.phone && <p className="text-xs text-red-300 mt-0.5">{errors.phone}</p>}
          </div>
          <div>
            <Label className="text-white">Adresse</Label>
            <Input
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="15 rue de la Paix..."
              className="mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
            />
          </div>
          <div>
            <Label className="text-white">Code postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="75000"
              maxLength={10}
              className={`mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50 ${errors.postalCode ? 'border-red-400' : ''}`}
            />
            {errors.postalCode && <p className="text-xs text-red-300 mt-0.5">{errors.postalCode}</p>}
          </div>
          <div>
            <Label className="text-white">Ville</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
              className="mt-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/20 text-white hover:bg-white/10">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50">
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
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);

  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const handleCreateShareLink = useCallback(async () => {
    if (!user?.id) {
      toast({ title: 'Vous devez être connecté pour partager un lien', variant: 'destructive' });
      return;
    }
    setShareLinkLoading(true);
    setShareLink(null);
    try {
      const { link } = await createClientFormLink(user.id);
      setShareLink(link);
      setShareLinkOpen(true);
    } catch (e) {
      const raw = (e as { message?: string })?.message ?? (e instanceof Error ? e.message : null) ?? '';
      const isMissingTable = /client_form_links|schema cache|PGRST205/i.test(raw);
      const msg = isMissingTable
        ? 'Table des liens partageables absente. Exécutez le fichier supabase/migrations/client_form_links.sql dans le SQL Editor de votre projet Supabase.'
        : (raw || 'Erreur lors de la création du lien');
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setShareLinkLoading(false);
    }
  }, [user?.id, toast]);

  const copyShareLink = useCallback(() => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(
      () => toast({ title: 'Lien copié dans le presse-papier' }),
      () => toast({ title: 'Échec de la copie', variant: 'destructive' })
    );
  }, [shareLink, toast]);

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
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Gestion des clients</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Recherchez, éditez et gérez vos clients</p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
        <div className="space-y-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/50 h-9 w-full max-md:min-h-[44px] max-md:h-[44px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 max-md:h-[44px] bg-black/20 border-white/10 text-white min-w-0">
                <SelectValue placeholder="Filtre" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                <SelectItem value="all" className="text-white">Tous</SelectItem>
                <SelectItem value="actifs" className="text-white">Actifs</SelectItem>
                <SelectItem value="terminés" className="text-white">Terminés</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditingClient(null);
                setIsModalOpen(true);
              }}
              className="h-9 max-md:h-[44px] bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter client
            </Button>
            <Button
              onClick={handleCreateShareLink}
              disabled={shareLinkLoading}
              variant="outline"
              className="h-9 max-md:h-[44px] bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {shareLinkLoading ? 'Création...' : 'Partager un lien'}
            </Button>
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white p-12 text-center">
            <p className="text-white/70">Aucun client trouvé.</p>
            <Button className="mt-4 min-h-[44px] max-md:min-h-[44px] bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un client
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-lg p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
              >
                <CardContent className="p-0">
                  <p className="font-semibold text-base text-white truncate">{client.name}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Mail className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Phone className="h-4 w-4 shrink-0 text-white/50" />
                      <span>{client.phone}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/50">Créé : {formatCreatedAt(client.created_at)}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClient(client);
                        setIsModalOpen(true);
                      }}
                      className="h-8 max-md:min-h-[44px] text-white border-white/20 hover:bg-white/10"
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
                      className="h-8 max-md:min-h-[44px] text-red-300 border-red-500/50 hover:bg-red-500/20"
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

      <Dialog open={shareLinkOpen} onOpenChange={setShareLinkOpen}>
        <DialogContent className="max-w-[480px] bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Lien formulaire client</DialogTitle>
            <DialogDescription className="text-white/70">
              Partagez ce lien pour permettre à quelqu&apos;un de remplir un formulaire et créer une fiche client dans votre compte.
            </DialogDescription>
          </DialogHeader>
          {shareLink && (
            <>
              <Input
                readOnly
                value={shareLink}
                className="bg-black/20 border-white/10 text-white font-mono text-sm"
              />
              <DialogFooter>
                <Button
                  onClick={copyShareLink}
                  className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
                >
                  Copier le lien
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[380px] bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Êtes-vous sûr de supprimer &quot;{deleteTarget?.name}&quot; ? Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                const ok = await handleDeleteConfirm();
                if (ok) setDeleteTarget(null);
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
