import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAccountButton } from '@/components/UserAccountButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Plus,
  Trash2,
  Building,
  Share2,
  Search,
  Copy,
  ChevronDown,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import {
  fetchAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  createTeamInvitation,
  fetchChantierAssignmentsByTeamMember,
  fetchChantierAssignmentsMap,
  setChantierAssignmentsForMember,
  fetchTeamInvitationsByMember,
  type TeamMember,
  type TeamInvitation,
} from '@/lib/supabase';
import { useChantiers } from '@/context/ChantiersContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_ICONS,
  generateRandomCode,
  getInitials,
  formatChantierDateRange,
} from '@/lib/teamUtils';

const ROLES = ['Chef de chantier', 'Ouvrier', 'Commercial', 'Assistant', 'Autre'];

const PERMISSION_LABELS: { key: keyof TeamMember; label: string }[] = [
  { key: 'can_view_dashboard', label: 'Voir le dashboard' },
  { key: 'can_view_planning', label: 'Voir le planning' },
  { key: 'can_manage_planning', label: 'Gérer le planning' },
  { key: 'can_manage_chantiers', label: 'Gérer les chantiers' },
  { key: 'can_view_all_chantiers', label: 'Voir tous les chantiers' },
  { key: 'can_access_crm', label: 'Accès CRM' },
  { key: 'can_create_quotes', label: 'Créer des devis' },
  { key: 'can_manage_invoices', label: 'Gérer les factures' },
  { key: 'can_manage_team', label: "Gérer l'équipe" },
  { key: 'can_manage_clients', label: 'Gérer les clients' },
  { key: 'can_use_ai_visualization', label: 'Utiliser IA visualization' },
];

const emptyPermissions = () => ({
  can_view_dashboard: false,
  can_use_estimation: false,
  can_view_all_chantiers: false,
  can_manage_chantiers: false,
  can_view_planning: false,
  can_manage_planning: false,
  can_access_crm: false,
  can_create_quotes: false,
  can_manage_invoices: false,
  can_use_ai_visualization: false,
  can_manage_team: false,
  can_manage_clients: false,
});

export default function TeamPage() {
  const { chantiers } = useChantiers();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editAssignedChantierIds, setEditAssignedChantierIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [editTab, setEditTab] = useState('infos');
  const [customPermissions, setCustomPermissions] = useState(false);

  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    login_code: '',
    ...emptyPermissions(),
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'actif' | 'inactif'>('all');

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLinkLoadingId, setInviteLinkLoadingId] = useState<string | null>(null);
  const [inviteModalMember, setInviteModalMember] = useState<TeamMember | null>(null);
  const [inviteHistory, setInviteHistory] = useState<TeamInvitation[]>([]);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await fetchAllTeamMembers();
      setMembers(data);
      const ids = data.map((m) => m.id);
      const map = await fetchChantierAssignmentsMap(ids);
      setAssignmentsMap(map);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    let list = [...members];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.role?.toLowerCase().includes(q) ||
          m.login_code?.toLowerCase().includes(q) ||
          (m.phone ?? '').includes(q)
      );
    }

    if (filterRoles.length > 0) {
      list = list.filter((m) => filterRoles.includes(m.role));
    }

    if (filterStatus === 'actif') list = list.filter((m) => m.status === 'actif');
    else if (filterStatus === 'inactif') list = list.filter((m) => m.status === 'inactif');

    return list;
  }, [members, searchQuery, filterRoles, filterStatus]);

  const stats = useMemo(() => {
    const actifs = members.filter((m) => m.status === 'actif').length;
    const inactifs = members.filter((m) => m.status === 'inactif').length;
    const byRole: Record<string, number> = {};
    for (const r of ROLES) byRole[r] = members.filter((m) => m.role === r).length;
    const totalChantiers = Object.values(assignmentsMap).reduce((s, arr) => s + arr.length, 0);
    const counts = members.map((m) => (assignmentsMap[m.id] ?? []).length);
    const avg = members.length > 0 ? totalChantiers / members.length : 0;
    const maxCount = counts.length ? Math.max(...counts) : 0;
    const minCount = counts.length ? Math.min(...counts) : 0;
    const maxMember = members.find((m) => (assignmentsMap[m.id] ?? []).length === maxCount);
    const minMember = members.find((m) => (assignmentsMap[m.id] ?? []).length === minCount);
    return {
      total: members.length,
      actifs,
      inactifs,
      byRole,
      totalChantiers,
      avg: avg.toFixed(1),
      maxMember: maxMember?.name ?? '-',
      minMember: minMember?.name ?? '-',
    };
  }, [members, assignmentsMap]);

  const toggleFilterRole = (role: string, checked: boolean) => {
    setFilterRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role)
    );
  };

  const handleRoleChange = (role: string, isNew = false) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? emptyPermissions();
    if (isNew) {
      setNewMember((prev) => ({ ...prev, role, ...defaults }));
      if (!customPermissions) setCustomPermissions(false);
    } else if (editingMember) {
      setEditingMember((prev) => (prev ? { ...prev, role, ...defaults } : null));
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.role || !newMember.email || !newMember.login_code) {
      toast({ title: 'Champs requis', description: 'Nom, rôle, email et code sont obligatoires.', variant: 'destructive' });
      return;
    }

    const memberData: Omit<TeamMember, 'id' | 'created_at' | 'updated_at' | 'user_id'> = {
      name: newMember.name,
      role: newMember.role,
      email: newMember.email,
      phone: newMember.phone || null,
      status: 'actif',
      login_code: newMember.login_code,
    };
    PERMISSION_LABELS.forEach(({ key }) => {
      const v = newMember[key as keyof typeof newMember];
      if (typeof v === 'boolean') (memberData as Record<string, boolean>)[key] = v;
    });

    const result = await createTeamMember(memberData);
    if (result) {
      const { inviteLink: link } = await createTeamInvitation(result.id, result.email);
      if (link) {
        setInviteLink(link);
        setInviteModalMember(result);
        setInviteHistory(await fetchTeamInvitationsByMember(result.id));
        setShowInviteModal(true);
      }
      await loadMembers();
      setNewMember({ name: '', role: '', email: '', phone: '', login_code: '', ...emptyPermissions() });
      setCustomPermissions(false);
      setIsAddDialogOpen(false);
      toast({ title: 'Membre ajouté' });
    } else {
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter le membre.', variant: 'destructive' });
    }
  };

  const handleEditMember = async (member: TeamMember) => {
    let perms: Partial<TeamMember> = {};
    try {
      const stored = localStorage.getItem(`team_member_permissions_${member.id}`);
      if (stored) perms = JSON.parse(stored);
    } catch {}
    const memberWithDefaults: TeamMember = {
      ...member,
      can_view_dashboard: member.can_view_dashboard ?? perms.can_view_dashboard ?? false,
      can_use_estimation: member.can_use_estimation ?? perms.can_use_estimation ?? false,
      can_view_all_chantiers: member.can_view_all_chantiers ?? perms.can_view_all_chantiers ?? false,
      can_manage_chantiers: member.can_manage_chantiers ?? perms.can_manage_chantiers ?? false,
      can_view_planning: member.can_view_planning ?? perms.can_view_planning ?? false,
      can_manage_planning: member.can_manage_planning ?? perms.can_manage_planning ?? false,
      can_access_crm: member.can_access_crm ?? perms.can_access_crm ?? false,
      can_create_quotes: member.can_create_quotes ?? perms.can_create_quotes ?? false,
      can_manage_invoices: member.can_manage_invoices ?? perms.can_manage_invoices ?? false,
      can_use_ai_visualization: member.can_use_ai_visualization ?? perms.can_use_ai_visualization ?? false,
      can_manage_team: member.can_manage_team ?? perms.can_manage_team ?? false,
      can_manage_clients: member.can_manage_clients ?? perms.can_manage_clients ?? false,
    };
    setEditingMember(memberWithDefaults);
    setEditTab('infos');
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

    const updates: Partial<TeamMember> = {
      name: editingMember.name,
      role: editingMember.role,
      email: editingMember.email,
      phone: editingMember.phone,
      status: editingMember.status,
      login_code: editingMember.login_code,
    };
    PERMISSION_LABELS.forEach(({ key }) => {
      const v = editingMember[key as keyof TeamMember];
      if (typeof v === 'boolean') (updates as Record<string, boolean>)[key] = v;
    });

    const result = await updateTeamMember(editingMember.id, updates);
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
      toast({ title: 'Membre mis à jour' });
    } else {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour.', variant: 'destructive' });
    }
  };

  const toggleChantierAssignment = (chantierId: string, checked: boolean) => {
    setEditAssignedChantierIds((prev) =>
      checked ? [...prev, chantierId] : prev.filter((id) => id !== chantierId)
    );
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) return;
    const success = await deleteTeamMember(id);
    if (success) {
      await loadMembers();
      toast({ title: 'Membre supprimé' });
    } else {
      toast({ title: 'Erreur', description: 'Impossible de supprimer.', variant: 'destructive' });
    }
  };

  const handleGetInviteLink = async (member: TeamMember) => {
    setInviteLinkLoadingId(member.id);
    try {
      const { inviteLink: link } = await createTeamInvitation(member.id, member.email);
      if (link) {
        setInviteLink(link);
        setInviteModalMember(member);
        setInviteHistory(await fetchTeamInvitationsByMember(member.id));
        setShowInviteModal(true);
      } else {
        toast({ title: "Impossible de générer le lien", variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Impossible de générer le lien", variant: 'destructive' });
    } finally {
      setInviteLinkLoadingId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: label + ' copié !' });
  };

  const renewCode = async () => {
    if (!inviteModalMember) return;
    const code = generateRandomCode();
    await updateTeamMember(inviteModalMember.id, { login_code: code });
    setInviteModalMember((prev) => (prev ? { ...prev, login_code: code } : null));
    await loadMembers();
    toast({ title: 'Code renouvelé' });
  };

  const chantierById = (id: string) => chantiers.find((c) => c.id === id);

  const modalStyles = 'bg-black/10 backdrop-blur-xl border border-white/10 text-white rounded-2xl max-h-[90vh] overflow-y-auto';
  const inputStyles = 'bg-black/10 border-white/10 text-white';

  return (
    <PageWrapper>
      <header className="bg-black/10 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Gestion de l&apos;Équipe</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Gérez les membres et leurs codes de connexion</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} modal={false}>
              <DialogTrigger asChild>
                <Button className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 max-md:min-h-[44px]">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un Membre
                </Button>
              </DialogTrigger>
              <DialogContent className={modalStyles + ' flex flex-col'}>
                <DialogHeader>
                  <DialogTitle>Ajouter un Nouveau Membre</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Renseignez les informations et les permissions du membre
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    <Label className="text-white">📝 Infos personnelles</Label>
                    <div className="grid gap-2">
                      <Input
                        placeholder="Nom complet"
                        value={newMember.name}
                        onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                        className={inputStyles}
                      />
                      <Select value={newMember.role} onValueChange={(v) => handleRoleChange(v, true)}>
                        <SelectTrigger className={inputStyles}>
                          <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 text-black border-white/20 shadow-lg">
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_ICONS[r] || ''} {r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="email"
                        placeholder="Email"
                        value={newMember.email}
                        onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                        className={inputStyles}
                      />
                      <Input
                        placeholder="Téléphone"
                        value={newMember.phone}
                        onChange={(e) => setNewMember((p) => ({ ...p, phone: e.target.value }))}
                        className={inputStyles}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Code (8-10 caractères)"
                          value={newMember.login_code}
                          onChange={(e) => setNewMember((p) => ({ ...p, login_code: e.target.value.slice(0, 10) }))}
                          className={inputStyles + ' font-mono'}
                          maxLength={10}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="border-white/20 text-white shrink-0"
                          onClick={() => setNewMember((p) => ({ ...p, login_code: generateRandomCode() }))}
                          title="Générer aléatoire"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-white">🔐 Permissions (par défaut selon rôle)</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:text-white"
                        onClick={() => setCustomPermissions(!customPermissions)}
                      >
                        {customPermissions ? 'Réinitialiser par rôle' : 'Personnaliser'}
                      </Button>
                    </div>
                    <p className="text-xs text-white/60">Permissions pour {newMember.role || '—'}</p>
                    <div className="space-y-2 pl-2 max-h-48 overflow-y-auto">
                      {PERMISSION_LABELS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={!!(newMember as Record<string, boolean>)[key]}
                            onCheckedChange={(c) =>
                              setNewMember((p) => ({ ...p, [key]: c === true }))
                            }
                            className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    {customPermissions && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-white/70 border-white/20"
                        onClick={() => {
                          const role = newMember.role || 'Autre';
                          const def = ROLE_DEFAULT_PERMISSIONS[role] ?? emptyPermissions();
                          setNewMember((p) => ({ ...p, ...def }));
                        }}
                      >
                        Réinitialiser selon rôle
                      </Button>
                    )}
                  </div>
                </div>
                <DialogFooter className="border-t border-white/10 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="text-white border-white/20">
                    Annuler
                  </Button>
                  <Button onClick={handleAddMember}>Ajouter le Membre</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-x-hidden">
        {/* Widget Stats */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span>📊</span> Équipe en coup d&apos;œil
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p><span className="text-white/70">👥</span> {stats.total} membres</p>
              <p>
                <span className="text-green-400">✅ {stats.actifs} actifs</span>
                {' | '}
                <span className="text-gray-400">⏸️ {stats.inactifs} inactifs</span>
              </p>
              <p className="text-white/70 pt-2">Répartition par rôle :</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                {ROLES.filter((r) => stats.byRole[r] > 0).map((r) => (
                  <span key={r}>{ROLE_ICONS[r] || ''} {r}: {stats.byRole[r]}</span>
                ))}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-white/70">📈 Charge de travail</p>
              <p>Total : {stats.totalChantiers} chantiers assignés</p>
              <p>Moyenne : {stats.avg} chantiers/personne</p>
              <p>Max : {stats.maxMember} | Min : {stats.minMember}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tableau */}
        <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-white/70" />
                Membres de l&apos;Équipe
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={inputStyles + ' pl-9'}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="border-white/20 text-white">
                      Rôle <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
                    {ROLES.map((r) => (
                      <DropdownMenuCheckboxItem
                        key={r}
                        checked={filterRoles.includes(r)}
                        onCheckedChange={(checked) => toggleFilterRole(r, !!checked)}
                        className="text-white focus:bg-white/10"
                      >
                        {ROLE_ICONS[r]} {r}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="border-white/20 text-white">
                      Statut <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
                    <DropdownMenuCheckboxItem
                      checked={filterStatus === 'all'}
                      onCheckedChange={() => setFilterStatus('all')}
                      className="text-white focus:bg-white/10"
                    >
                      Tous
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={filterStatus === 'actif'}
                      onCheckedChange={() => setFilterStatus('actif')}
                      className="text-white focus:bg-white/10"
                    >
                      Actifs
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={filterStatus === 'inactif'}
                      onCheckedChange={() => setFilterStatus('inactif')}
                      className="text-white focus:bg-white/10"
                    >
                      Inactifs
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-sm text-white/70">{filteredMembers.length} résultat(s)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-white/70">Chargement...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-white/50" />
                <p className="text-white/70">Aucun membre trouvé</p>
              </div>
            ) : (
              <>
                {/* Vue cartes - mobile uniquement */}
                <div className="max-md:block md:hidden space-y-3">
                  {filteredMembers.map((member) => {
                    const assignedIds = assignmentsMap[member.id] ?? [];
                    const assignedChantiers = assignedIds.map((id) => chantierById(id)).filter(Boolean);
                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 text-white"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium shrink-0">
                              {getInitials(member.name)}
                            </div>
                            <span className="font-medium truncate">{member.name}</span>
                          </div>
                          <Badge
                            className={
                              member.status === 'actif'
                                ? 'bg-green-500/20 text-green-300 border-0 shrink-0'
                                : 'bg-gray-500/20 text-gray-400 border-0 shrink-0'
                            }
                          >
                            {member.status === 'actif' ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="mb-2 bg-white/10 text-white border-0">
                          {ROLE_ICONS[member.role] || ''} {member.role}
                        </Badge>
                        <div className="text-sm text-white/90 truncate mb-1">{member.email}</div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-semibold">{member.login_code}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 min-w-[44px] text-white/70 hover:text-white"
                            onClick={() => copyToClipboard(member.login_code, 'Code')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-sm text-white/70 mb-3">
                          Chantiers : {assignedIds.length > 0 ? assignedIds.length : '—'}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-h-[44px] text-white border-white/20 hover:bg-white/10"
                            onClick={() => handleEditMember(member)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] min-w-[44px] p-0 text-white border-white/20 hover:bg-white/10"
                            onClick={() => handleGetInviteLink(member)}
                            disabled={!!inviteLinkLoadingId}
                          >
                            {inviteLinkLoadingId === member.id ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <Share2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] min-w-[44px] p-0 text-red-300 border-red-500/50 hover:bg-red-500/20"
                            onClick={() => handleDeleteMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tableau - desktop */}
                <div className="max-md:hidden overflow-x-auto rounded-lg border border-white/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/80">Nom</TableHead>
                        <TableHead className="text-white/80">Rôle</TableHead>
                        <TableHead className="text-white/80">Email</TableHead>
                        <TableHead className="text-white/80">Code</TableHead>
                        <TableHead className="text-white/80">Chantiers</TableHead>
                        <TableHead className="text-white/80">Statut</TableHead>
                        <TableHead className="text-white/80 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const assignedIds = assignmentsMap[member.id] ?? [];
                        const assignedChantiers = assignedIds.map((id) => chantierById(id)).filter(Boolean);
                        return (
                          <TableRow key={member.id} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                                  {getInitials(member.name)}
                                </div>
                                <span className="font-medium text-white">{member.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-white/10 text-white border-0">
                                {ROLE_ICONS[member.role] || ''} {member.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-white/90">
                              {member.email}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm font-semibold">{member.login_code}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-white/70 hover:text-white"
                                  onClick={() => copyToClipboard(member.login_code, 'Code')}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignedIds.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto py-1 text-sm text-white/90 hover:text-white hover:bg-white/10"
                                    >
                                      {assignedIds.length}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" className="bg-black/90 border-white/10 text-white w-72">
                                    <p className="font-medium mb-2">Chantiers assignés</p>
                                    <ul className="space-y-1 text-sm">
                                      {assignedChantiers.map((c) => (
                                        <li key={c!.id}>
                                          🏠 {c!.nom} ({formatChantierDateRange(c!.dateDebut, c!.duree)})
                                        </li>
                                      ))}
                                    </ul>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-white/50">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  member.status === 'actif'
                                    ? 'bg-green-500/20 text-green-300 border-0'
                                    : 'bg-gray-500/20 text-gray-400 border-0'
                                }
                              >
                                {member.status === 'actif' ? '✅ Actif' : '⏸️ Inactif'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-white/70 hover:text-white"
                                  onClick={() => handleEditMember(member)}
                                  title="Modifier"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-white/70 hover:text-white"
                                  onClick={() => handleGetInviteLink(member)}
                                  disabled={!!inviteLinkLoadingId}
                                  title="Partager invitation"
                                >
                                  {inviteLinkLoadingId === member.id ? (
                                    <span className="text-xs">...</span>
                                  ) : (
                                    <Share2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-white/70 hover:text-red-400"
                                  onClick={() => handleDeleteMember(member.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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

        {/* Affectation aux Chantiers */}
        <Card className="bg-black/10 backdrop-blur-xl border border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-white/70" />
              Affectation aux Chantiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/70">
              Affectez les membres aux chantiers depuis la fiche chantier ou depuis le planning.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Modal Édition avec onglets */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} modal={false}>
        <DialogContent className={modalStyles + ' flex flex-col'}>
          <DialogHeader>
            <DialogTitle>Modifier un Membre</DialogTitle>
            <DialogDescription className="text-white/70">
              Modifiez les informations, chantiers et permissions
            </DialogDescription>
          </DialogHeader>
          {editingMember && (
            <Tabs value={editTab} onValueChange={setEditTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="bg-black/10 border border-white/10 w-full grid grid-cols-3">
                <TabsTrigger value="infos" className="data-[state=active]:bg-white/20">ℹ️ Infos</TabsTrigger>
                <TabsTrigger value="chantiers" className="data-[state=active]:bg-white/20">👥 Chantiers</TabsTrigger>
                <TabsTrigger value="permissions" className="data-[state=active]:bg-white/20">🔐 Permissions</TabsTrigger>
              </TabsList>
              <TabsContent value="infos" className="mt-4 space-y-4 flex-1 overflow-y-auto">
                <div className="grid gap-2">
                  <Label>Nom</Label>
                  <Input
                    value={editingMember.name}
                    onChange={(e) => setEditingMember((p) => (p ? { ...p, name: e.target.value } : null))}
                    className={inputStyles}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Rôle</Label>
                  <Select
                    value={editingMember.role}
                    onValueChange={(v) => handleRoleChange(v, false)}
                  >
                    <SelectTrigger className={inputStyles}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 text-black border-white/20 shadow-lg">
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_ICONS[r]} {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingMember.email}
                    onChange={(e) => setEditingMember((p) => (p ? { ...p, email: e.target.value } : null))}
                    className={inputStyles}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={editingMember.phone || ''}
                    onChange={(e) => setEditingMember((p) => (p ? { ...p, phone: e.target.value } : null))}
                    className={inputStyles}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Code de connexion</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editingMember.login_code}
                      onChange={(e) =>
                        setEditingMember((p) => (p ? { ...p, login_code: e.target.value.slice(0, 10) } : null))
                      }
                      className={inputStyles + ' font-mono'}
                      maxLength={10}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-white/20 text-white shrink-0"
                      onClick={async () => {
                        const code = generateRandomCode();
                        setEditingMember((p) => (p ? { ...p, login_code: code } : null));
                        toast({ title: 'Code renouvelé' });
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Statut</Label>
                  <Select
                    value={editingMember.status}
                    onValueChange={(v) =>
                      setEditingMember((p) => (p ? { ...p, status: v as 'actif' | 'inactif' } : null))
                    }
                  >
                    <SelectTrigger className={inputStyles}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/30 border-white/10">
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="inactif">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="chantiers" className="mt-4 flex-1 overflow-y-auto">
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white"
                    onClick={() => setEditAssignedChantierIds(chantiers.map((c) => c.id))}
                  >
                    Tous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white"
                    onClick={() => setEditAssignedChantierIds([])}
                  >
                    Aucun
                  </Button>
                </div>
                {loadingAssignments ? (
                  <p className="text-sm text-white/60">Chargement...</p>
                ) : chantiers.length === 0 ? (
                  <p className="text-sm text-white/60">Aucun chantier disponible</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chantiers.map((chantier) => (
                      <label
                        key={chantier.id}
                        className="flex items-center gap-2 cursor-pointer text-sm hover:text-white"
                      >
                        <Checkbox
                          checked={editAssignedChantierIds.includes(chantier.id)}
                          onCheckedChange={(c) => toggleChantierAssignment(chantier.id, !!c)}
                          className="border-white/30 data-[state=checked]:bg-white/20"
                        />
                        <span>🏠 {chantier.nom}</span>
                        <span className="text-white/50 text-xs">
                          ({formatChantierDateRange(chantier.dateDebut, chantier.duree)})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="permissions" className="mt-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {PERMISSION_LABELS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={!!(editingMember as Record<string, boolean>)[key]}
                        onCheckedChange={(c) =>
                          setEditingMember((p) =>
                            p ? { ...p, [key]: c === true } : null
                          )
                        }
                        className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="border-t border-white/10 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="text-white border-white/20">
              Annuler
            </Button>
            <Button onClick={handleUpdateMember}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Invitation & Code */}
      <Dialog
        open={showInviteModal}
        onOpenChange={(open) => {
          setShowInviteModal(open);
          if (!open) setInviteModalMember(null);
        }}
      >
        <DialogContent className={modalStyles}>
          <DialogHeader>
            <DialogTitle>Inviter {inviteModalMember?.name ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white">Code de connexion</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={inviteModalMember?.login_code ?? ''}
                  onChange={(e) =>
                    setInviteModalMember((p) =>
                      p ? { ...p, login_code: e.target.value.slice(0, 10) } : null
                    )
                  }
                  onBlur={async () => {
                    if (inviteModalMember?.id && inviteModalMember?.login_code?.trim()) {
                      await updateTeamMember(inviteModalMember.id, {
                        login_code: inviteModalMember.login_code.trim(),
                      });
                      await loadMembers();
                    }
                  }}
                  className={inputStyles + ' font-mono'}
                  maxLength={10}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/20 text-white shrink-0"
                  onClick={renewCode}
                  title="Renouveler"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/20 text-white shrink-0"
                  onClick={() =>
                    inviteModalMember?.login_code &&
                    copyToClipboard(inviteModalMember.login_code, 'Code')
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-white">Lien d&apos;invitation</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={inviteLink || ''}
                  readOnly
                  className={inputStyles + ' font-mono text-sm'}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/20 text-white shrink-0"
                  onClick={() => inviteLink && copyToClipboard(inviteLink, 'Lien')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {inviteHistory.length > 0 && (
              <div>
                <Label className="text-white">Historique invitations</Label>
                <ul className="mt-2 space-y-1 text-sm text-white/80">
                  {inviteHistory.slice(0, 5).map((inv, i) => (
                    <li key={inv.id}>
                      {i + 1}. {new Date(inv.created_at).toLocaleDateString('fr-FR')}{' '}
                      {inv.used ? '(acceptée)' : '(en attente)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteModal(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
