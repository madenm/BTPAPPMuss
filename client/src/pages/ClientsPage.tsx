import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAccountButton } from '@/components/UserAccountButton';
import { User, Plus, Building, Mail, Phone, Image as ImageIcon, Link2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { useChantiers, Client, Chantier } from '@/context/ChantiersContext';
import { useToast } from '@/hooks/use-toast';

export default function ClientsPage() {
  const { clients, chantiers, addClient, updateChantier } = useChantiers();
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignChantierDialogOpen, setIsAssignChantierDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [assigningChantierId, setAssigningChantierId] = useState<string | null>(null);

  // Filtrer les chantiers du client sélectionné
  const clientChantiers = selectedClient
    ? chantiers.filter(c => c.clientId === selectedClient.id)
    : [];

  // Chantiers pouvant être attribués à ce client (pas déjà attribués à ce client)
  const chantiersToAssign = selectedClient
    ? chantiers.filter(c => c.clientId !== selectedClient.id)
    : [];

  const handleAssignChantierToClient = async (chantier: Chantier) => {
    if (!selectedClient) return;
    setAssigningChantierId(chantier.id);
    try {
      await updateChantier(chantier.id, {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
      });
      toast({
        title: 'Chantier attribué',
        description: `${chantier.nom} a été attribué à ${selectedClient.name}.`,
      });
      setIsAssignChantierDialogOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de l\'attribution';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setAssigningChantierId(null);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email || !newClient.phone) return;
    setIsAdding(true);
    try {
      await addClient({ name: newClient.name, email: newClient.email, phone: newClient.phone });
      setNewClient({ name: '', email: '', phone: '' });
      setIsDialogOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de l\'ajout du client';
      alert(message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-tl-3xl ml-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Clients
            </h1>
            <p className="text-sm text-white/70">
              {selectedClient ? `Chantiers de ${selectedClient.name}` : 'Gérez vos clients et leurs chantiers'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!selectedClient && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un Client
                  </Button>
                </DialogTrigger>
              <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Nouveau Client</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Ajoutez un nouveau client à votre liste
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white">Nom</Label>
                    <Input
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      placeholder="Nom du client"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Email</Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      placeholder="email@example.com"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Téléphone</Label>
                    <Input
                      type="tel"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="06 12 34 56 78"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleAddClient}
                      disabled={isAdding}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      {isAdding ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}
            <UserAccountButton variant="inline" />
          </div>
          {selectedClient && (
            <Button
              variant="outline"
              onClick={() => setSelectedClient(null)}
              className="text-white border-white/20 hover:bg-white/10"
            >
              Retour à la liste
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 ml-20">
        {!selectedClient ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <Card
                key={client.id}
                className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedClient(client)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                      <User className="h-6 w-6 text-white/70" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Mail className="h-4 w-4" />
                    {client.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Phone className="h-4 w-4" />
                    {client.phone}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Building className="h-4 w-4" />
                      {chantiers.filter(c => c.clientId === client.id).length} chantier(s)
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                    <User className="h-6 w-6 text-white/70" />
                  </div>
                  <div>
                    <div className="text-xl">{selectedClient.name}</div>
                    <div className="text-sm font-normal text-white/70">{selectedClient.email}</div>
                    <div className="text-sm font-normal text-white/70">{selectedClient.phone}</div>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-xl font-semibold text-white">Chantiers de {selectedClient.name}</h2>
              <div className="flex gap-2">
                <Dialog open={isAssignChantierDialogOpen} onOpenChange={setIsAssignChantierDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-white border-white/20 hover:bg-white/10">
                      <Link2 className="h-4 w-4 mr-2" />
                      Attribuer un chantier existant
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="text-white">Attribuer un chantier à {selectedClient.name}</DialogTitle>
                      <DialogDescription className="text-white/70">
                        Choisissez un chantier à attribuer à ce client. La liste affiche les chantiers non encore attribués à ce client.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-2 py-4">
                      {chantiersToAssign.length === 0 ? (
                        <p className="text-sm text-white/70 text-center py-8">
                          Aucun autre chantier à attribuer. Tous vos chantiers sont déjà attribués à ce client, ou créez-en un nouveau.
                        </p>
                      ) : (
                        chantiersToAssign.map((chantier) => {
                          const currentClientName = chantier.clientId
                            ? (clients.find(c => c.id === chantier.clientId)?.name ?? chantier.clientName ?? '—')
                            : 'Non attribué';
                          const isAssigning = assigningChantierId === chantier.id;
                          return (
                            <div
                              key={chantier.id}
                              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-black/20 border border-white/10"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-white truncate">{chantier.nom}</p>
                                <p className="text-xs text-white/60">
                                  Actuellement : {currentClientName} · {new Date(chantier.dateDebut).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleAssignChantierToClient(chantier)}
                                disabled={!!assigningChantierId}
                                className="shrink-0 bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                              >
                                {isAssigning ? 'Attribution...' : 'Attribuer à ce client'}
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Link href={`/dashboard/projects?openDialog=true&clientId=${selectedClient.id}`}>
                  <Button className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un chantier
                  </Button>
                </Link>
              </div>
            </div>

            {clientChantiers.length === 0 ? (
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <CardContent className="py-12 text-center">
                  <Building className="h-12 w-12 mx-auto mb-4 text-white/50" />
                  <p className="text-white/70">Aucun chantier pour ce client</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientChantiers.map((chantier) => (
                  <Card
                    key={chantier.id}
                    className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:shadow-lg transition-shadow"
                  >
                    {chantier.images.length > 0 && (
                      <div className="relative h-48 overflow-hidden rounded-t-lg">
                        <img
                          src={chantier.images[0]}
                          alt={chantier.nom}
                          className="w-full h-full object-cover"
                        />
                        {chantier.images.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {chantier.images.length}
                          </div>
                        )}
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{chantier.nom}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm text-white/70">
                        Date: {new Date(chantier.dateDebut).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-sm text-white/70">
                        Durée: {chantier.duree}
                      </div>
                      <div className="mt-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          chantier.statut === 'planifié' ? 'bg-blue-500/20 text-blue-300' :
                          chantier.statut === 'en cours' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {chantier.statut}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </PageWrapper>
  );
}

