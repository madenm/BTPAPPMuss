import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Users, Plus, User, Mail, Phone, Trash2, Building, Key, Edit2, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember, createTeamInvitation, fetchChantierAssignmentsByTeamMember, setChantierAssignmentsForMember, type TeamMember } from '@/lib/supabase';
import { Copy, Check } from 'lucide-react';
import { useChantiers } from '@/context/ChantiersContext';
import { Checkbox } from '@/components/ui/checkbox';

export default function TeamPage() {
  const { chantiers } = useChantiers();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editAssignedChantierIds, setEditAssignedChantierIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    login_code: ''
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLinkLoadingId, setInviteLinkLoadingId] = useState<string | null>(null);
  const [inviteModalMember, setInviteModalMember] = useState<{ id: string; login_code: string } | null>(null);

  const handleGetInviteLink = async (member: TeamMember) => {
    setInviteLinkLoadingId(member.id);
    try {
      const { inviteLink: link } = await createTeamInvitation(member.id, member.email);
      if (link) {
        setInviteLink(link);
        setInviteModalMember({ id: member.id, login_code: member.login_code });
        setShowInviteModal(true);
      } else {
        alert("Impossible de générer le lien d'invitation. Réessayez.");
      }
    } catch (e) {
      console.error('Error creating invite link:', e);
      alert("Impossible de générer le lien d'invitation.");
    } finally {
      setInviteLinkLoadingId(null);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.role || !newMember.email || !newMember.login_code) {
      alert("Veuillez remplir tous les champs, y compris le code de connexion");
      return;
    }

    const result = await createTeamMember({
      name: newMember.name,
      role: newMember.role,
      email: newMember.email,
      phone: newMember.phone || null,
      status: 'actif',
      login_code: newMember.login_code,
    });

      if (result) {
      // Créer l'invitation
      const { inviteLink } = await createTeamInvitation(result.id, result.email);

      if (inviteLink) {
        setInviteLink(inviteLink);
        setInviteModalMember({ id: result.id, login_code: result.login_code });
        setShowInviteModal(true);
      }

      await loadMembers();
      setNewMember({ name: '', role: '', email: '', phone: '', login_code: '' });
      setIsDialogOpen(false);
    }
  };

  const handleEditMember = async (member: TeamMember) => {
    setEditingMember(member);
    setIsEditDialogOpen(true);
    setLoadingAssignments(true);
    try {
      const ids = await fetchChantierAssignmentsByTeamMember(member.id);
      setEditAssignedChantierIds(ids);
    } catch {
      setEditAssignedChantierIds([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;

    const result = await updateTeamMember(editingMember.id, {
      name: editingMember.name,
      role: editingMember.role,
      email: editingMember.email,
      phone: editingMember.phone,
      status: editingMember.status,
      login_code: editingMember.login_code,
    });

    if (result) {
      try {
        await setChantierAssignmentsForMember(editingMember.id, editAssignedChantierIds);
      } catch (e) {
        console.error('Error saving chantier assignments:', e);
      }
      await loadMembers();
      setEditingMember(null);
      setEditAssignedChantierIds([]);
      setIsEditDialogOpen(false);
    }
  };

  const toggleChantierAssignment = (chantierId: string, checked: boolean) => {
    setEditAssignedChantierIds((prev) =>
      checked ? [...prev, chantierId] : prev.filter((id) => id !== chantierId)
    );
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      const success = await deleteTeamMember(id);
      if (success) {
        await loadMembers();
      }
    }
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-tl-3xl ml-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Gestion de l'Équipe
            </h1>
            <p className="text-sm text-white/70">Gérez les membres de votre équipe et leurs codes de connexion</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un Membre
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Ajouter un Nouveau Membre</DialogTitle>
                <DialogDescription className="text-white/70">
                  Renseignez les informations du membre et son code de connexion
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">Nom complet</Label>
                  <Input
                    id="name"
                    value={newMember.name}
                    onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-black/20 border-white/10 text-white"
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-white">Rôle</Label>
                  <Select value={newMember.role} onValueChange={(value) => setNewMember(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/30 backdrop-blur-lg border-white/10 text-white">
                      <SelectItem value="Chef de chantier">Chef de chantier</SelectItem>
                      <SelectItem value="Ouvrier">Ouvrier</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Assistant">Assistant</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-black/20 border-white/10 text-white"
                    placeholder="jean.dupont@planchais.fr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">Téléphone</Label>
                  <Input
                    id="phone"
                    value={newMember.phone}
                    onChange={(e) => setNewMember(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-black/20 border-white/10 text-white"
                    placeholder="06 12 34 56 78"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login_code" className="text-white">Code de connexion *</Label>
                  <Input
                    id="login_code"
                    value={newMember.login_code}
                    onChange={(e) => setNewMember(prev => ({ ...prev, login_code: e.target.value }))}
                    className="bg-black/20 border-white/10 text-white font-mono"
                    placeholder="Entrez le code de connexion"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="text-white border-white/20 hover:bg-white/10">
                  Annuler
                </Button>
                <Button onClick={handleAddMember}>Ajouter le Membre</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 ml-20">
        {/* Membres de l'Équipe */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-white/70" />
              Membres de l'Équipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-white/70">Chargement...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-white/50" />
                <p className="text-white/70">Aucun membre dans l'équipe</p>
                <p className="text-sm text-white/50 mt-2">Ajoutez votre premier membre pour commencer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg hover:bg-black/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                        <User className="h-6 w-6 text-white/70" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-sm text-white/70">{member.role}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1 text-xs text-white/60">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-1 text-xs text-white/60">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-white/60">
                            <Key className="h-3 w-3" />
                            <span className="font-mono">{member.login_code}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={member.status === 'actif' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}>
                        {member.status === 'actif' ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGetInviteLink(member)}
                        disabled={!!inviteLinkLoadingId}
                        title="Obtenir un lien d'invitation à partager"
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {inviteLinkLoadingId === member.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditMember(member)}
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog d'édition */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Modifier le Membre</DialogTitle>
              <DialogDescription className="text-white/70">
                Modifiez les informations et les chantiers affectés à ce membre
              </DialogDescription>
            </DialogHeader>
            {editingMember && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-white">Nom complet</Label>
                  <Input
                    id="edit-name"
                    value={editingMember.name}
                    onChange={(e) => setEditingMember(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role" className="text-white">Rôle</Label>
                  <Select 
                    value={editingMember.role} 
                    onValueChange={(value) => setEditingMember(prev => prev ? { ...prev, role: value } : null)}
                  >
                    <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/30 backdrop-blur-lg border-white/10 text-white">
                      <SelectItem value="Chef de chantier">Chef de chantier</SelectItem>
                      <SelectItem value="Ouvrier">Ouvrier</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Assistant">Assistant</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-white">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingMember.email}
                    onChange={(e) => setEditingMember(prev => prev ? { ...prev, email: e.target.value } : null)}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-white">Téléphone</Label>
                  <Input
                    id="edit-phone"
                    value={editingMember.phone || ''}
                    onChange={(e) => setEditingMember(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-login_code" className="text-white">Code de connexion</Label>
                  <Input
                    id="edit-login_code"
                    value={editingMember.login_code}
                    onChange={(e) => setEditingMember(prev => prev ? { ...prev, login_code: e.target.value } : null)}
                    className="bg-black/20 border-white/10 text-white font-mono"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-white">Statut</Label>
                  <Select 
                    value={editingMember.status} 
                    onValueChange={(value) => setEditingMember(prev => prev ? { ...prev, status: value as 'actif' | 'inactif' } : null)}
                  >
                    <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/30 backdrop-blur-lg border-white/10 text-white">
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="inactif">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Chantiers affectés</Label>
                  <p className="text-xs text-white/60">Sélectionnez les chantiers auxquels ce membre a accès.</p>
                  {loadingAssignments ? (
                    <p className="text-sm text-white/50">Chargement des affectations...</p>
                  ) : chantiers.length === 0 ? (
                    <p className="text-sm text-white/50">Aucun chantier. Créez des chantiers depuis Mes Chantiers.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 mt-2 p-2 rounded-lg bg-black/20 border border-white/10">
                      {chantiers.map((chantier) => (
                        <label
                          key={chantier.id}
                          className="flex items-center gap-2 cursor-pointer text-sm text-white/90 hover:text-white"
                        >
                          <Checkbox
                            checked={editAssignedChantierIds.includes(chantier.id)}
                            onCheckedChange={(checked) => toggleChantierAssignment(chantier.id, !!checked)}
                            className="border-white/30 data-[state=checked]:bg-white/20"
                          />
                          <span>{chantier.nom}</span>
                          <span className="text-white/50 text-xs">({chantier.clientName})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="text-white border-white/20 hover:bg-white/10">
                Annuler
              </Button>
              <Button onClick={handleUpdateMember}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Affectation aux Chantiers */}
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-white/70" />
              Affectation aux Chantiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/70">
              Affectez les membres de l'équipe aux chantiers depuis la fiche chantier ou depuis le planning.
              Cette fonctionnalité vous permet de suivre qui travaille sur quel projet.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Modal pour afficher le lien d'invitation */}
      <Dialog open={showInviteModal} onOpenChange={(open) => {
        setShowInviteModal(open);
        if (!open) setInviteModalMember(null);
      }}>
        <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Lien d'invitation créé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-white/70 text-sm">
              Partagez ce lien avec le membre d'équipe pour qu'il puisse se connecter :
            </p>
            <div className="flex gap-2">
              <Input
                value={inviteLink || ''}
                readOnly
                className="bg-black/20 border-white/10 text-white font-mono text-sm"
              />
              <Button
                onClick={() => {
                  if (inviteLink) {
                    navigator.clipboard.writeText(inviteLink);
                    alert('Lien copié dans le presse-papier !');
                  }
                }}
                className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Code de connexion</Label>
              <Input
                value={inviteModalMember?.login_code ?? ''}
                onChange={(e) => setInviteModalMember((prev) => prev ? { ...prev, login_code: e.target.value.slice(0, 10) } : null)}
                onBlur={() => {
                  if (inviteModalMember?.id && inviteModalMember?.login_code?.trim()) {
                    updateTeamMember(inviteModalMember.id, { login_code: inviteModalMember.login_code.trim() }).then(() => loadMembers());
                  }
                }}
                className="bg-black/20 border-white/10 text-white font-mono"
                placeholder="Code de connexion"
                maxLength={10}
              />
              <p className="text-xs text-white/50">
                Le membre devra entrer ce code sur la page d'invitation. Cliquez pour modifier, la modification est enregistrée à la sortie du champ.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteModal(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
