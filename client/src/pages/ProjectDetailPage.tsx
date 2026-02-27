import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Building, Calendar as CalendarIcon, ArrowLeft, Plus, X, Image as ImageIcon, FileText, Pencil, Eye, Download, Check, Trash2, Receipt, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useChantiers, Client, Chantier } from '@/context/ChantiersContext';
import { uploadFile, removeFile, publicUrlToPath } from '@/lib/supabaseStorage';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchTeamMembers, fetchChantierAssignmentsByChantier, addChantierAssignment, removeChantierAssignment, type TeamMember } from '@/lib/supabase';
import { fetchQuotesByChantierId, fetchQuotesForUser, getQuoteDisplayNumber, updateQuoteStatus, deleteQuote, type SupabaseQuote } from '@/lib/supabaseQuotes';
import { downloadPdfBase64, downloadQuotePdf, fetchLogoDataUrl, type QuotePdfParams } from '@/lib/quotePdf';
import { QuotePreview } from '@/components/QuotePreview';
import { useUserSettings } from '@/context/UserSettingsContext';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { fetchInvoicesForUser, createInvoiceFromQuote, type InvoiceWithPayments } from '@/lib/supabaseInvoices';
import { formatDurationFromDates } from '@/lib/planningUtils';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Format montant en euros (FR)
function formatMontantEuro(value?: number | null): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

// Vérifier si un devis est expiré
function isQuoteExpired(quote: SupabaseQuote): boolean {
  if (!quote.created_at || !quote.validity_days) return false;
  const createdDate = new Date(quote.created_at);
  const expirationDate = new Date(createdDate);
  expirationDate.setDate(expirationDate.getDate() + quote.validity_days);
  const now = new Date();
  return now > expirationDate;
}

// Format ISO (YYYY-MM-DD) en DD/MM/YYYY pour affichage et saisie
function formatDateToDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (y == null || m == null || d == null || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Parse DD/MM/YYYY (ou D/M/YYYY) en ISO YYYY-MM-DD pour l'API
function parseDDMMYYYYToISO(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[/.-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  let day = parseInt(d, 10);
  let month = parseInt(m, 10);
  let year = parseInt(y, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return '';
  const lastDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > lastDay) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Valeur affichée/saisie : ISO -> DD/MM/YYYY, sinon chaîne brute (saisie en cours)
function dateInputValue(dateDebut: string): string {
  if (!dateDebut) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return formatDateToDDMMYYYY(dateDebut);
  return dateDebut;
}

// Convertir la valeur du champ en ISO pour l'API
function dateInputToISO(dateDebut: string): string {
  if (!dateDebut) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return dateDebut;
  return parseDDMMYYYYToISO(dateDebut);
}

function dateToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function quoteToPdfParams(q: SupabaseQuote): QuotePdfParams {
  const pdfItems = (q.items ?? []).map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.total ?? i.quantity * i.unitPrice,
    unit: i.unit ?? undefined,
    subItems: i.subItems?.map((s) => ({
      description: s.description,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      total: s.total,
      unit: s.unit ?? undefined,
    })),
  }));

  return {
    clientInfo: {
      name: q.client_name ?? '',
      email: q.client_email ?? '',
      phone: q.client_phone ?? '',
      address: q.client_address ?? '',
    },
    projectType: q.project_type ?? '',
    projectDescription: q.project_description ?? '',
    validityDays: String(q.validity_days ?? 30),
    items: pdfItems,
    subtotal: q.total_ht,
    tva: q.total_ttc - q.total_ht,
    total: q.total_ttc,
  };
}

export default function ProjectDetailPage() {
  const { user } = useAuth();
  const { profile, logoUrl, themeColor } = useUserSettings();
  const { chantiers, clients, updateChantier, addClient } = useChantiers();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/dashboard/projects/:id');
  const chantierId = params?.id;

  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [editChantier, setEditChantier] = useState({
    id: '',
    nom: '',
    clientId: '',
    clientName: '',
    dateDebut: '',
    dateFin: '',
    duree: '',
    images: [] as string[],
    statut: 'planifié' as 'planifié' | 'en cours' | 'terminé',
    notes: '',
    notesAvancement: '',
    typeChantier: undefined as string | undefined,
    montantDevis: undefined as number | undefined,
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Devis
  const [chantierQuotes, setChantierQuotes] = useState<SupabaseQuote[]>([]);
  const [chantierQuotesLoading, setChantierQuotesLoading] = useState(false);
  const [quoteDownloadingId, setQuoteDownloadingId] = useState<string | null>(null);
  const [quoteValidatingLoading, setQuoteValidatingLoading] = useState(false);
  const [quoteDeletingId, setQuoteDeletingId] = useState<string | null>(null);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<SupabaseQuote | null>(null);
  const [isQuotePreviewOpen, setIsQuotePreviewOpen] = useState(false);

  // Factures
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);

  // Charger le chantier
  useEffect(() => {
    if (!chantierId) return;
    const found = chantiers.find((c) => c.id === chantierId);
    if (found) {
      setChantier(found);
      setEditChantier({
        id: found.id,
        nom: found.nom,
        clientId: found.clientId,
        clientName: found.clientName,
        dateDebut: found.dateDebut,
        dateFin: found.dateFin ?? '',
        duree: found.duree,
        images: [...found.images],
        statut: found.statut,
        notes: found.notes || '',
        notesAvancement: found.notesAvancement || '',
        typeChantier: found.typeChantier,
        montantDevis: found.montantDevis,
      });
    }
  }, [chantierId, chantiers]);

  // Charger les membres et affectations
  useEffect(() => {
    if (!chantierId) return;
    const loadTeam = async () => {
      setLoadingAssignments(true);
      try {
        const [members, assigned] = await Promise.all([
          fetchTeamMembers(),
          fetchChantierAssignmentsByChantier(chantierId),
        ]);
        setTeamMembers(members);
        setAssignedMemberIds(assigned.map((m) => m.id));
      } catch {
        setTeamMembers([]);
        setAssignedMemberIds([]);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadTeam();
  }, [chantierId]);

  // Charger les devis
  useEffect(() => {
    if (!chantierId) return;
    const loadQuotes = async () => {
      setChantierQuotesLoading(true);
      try {
        const quotes = await fetchQuotesByChantierId(chantierId);
        setChantierQuotes(quotes);
      } catch (err) {
        console.error(err);
        setChantierQuotes([]);
      } finally {
        setChantierQuotesLoading(false);
      }
    };
    loadQuotes();
  }, [chantierId]);

  const handleSave = async () => {
    if (!chantier || !editChantier.nom || !editChantier.clientId || !editChantier.dateDebut || !editChantier.duree) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires.', variant: 'destructive' });
      return;
    }

    const dateDebutIso = dateInputToISO(editChantier.dateDebut);
    const dateFinIso = editChantier.dateFin ? dateInputToISO(editChantier.dateFin) : undefined;

    try {
      await updateChantier(chantier.id, {
        nom: editChantier.nom,
        clientId: editChantier.clientId,
        dateDebut: dateDebutIso,
        dateFin: dateFinIso,
        duree: editChantier.duree,
        images: editChantier.images,
        statut: editChantier.statut,
        notes: editChantier.notes,
        notesAvancement: editChantier.notesAvancement,
        typeChantier: editChantier.typeChantier,
        montantDevis: editChantier.montantDevis,
      });

      // Gestion des affectations
      const currentAssigned = await fetchChantierAssignmentsByChantier(chantier.id);
      const currentIds = currentAssigned.map((m) => m.id);
      for (const memberId of assignedMemberIds) {
        if (!currentIds.includes(memberId)) await addChantierAssignment(chantier.id, memberId);
      }
      for (const memberId of currentIds) {
        if (!assignedMemberIds.includes(memberId)) await removeChantierAssignment(chantier.id, memberId);
      }

      toast({ title: 'Projet mis à jour', description: 'Les modifications ont été enregistrées.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Impossible de mettre à jour le projet.', variant: 'destructive' });
    }
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !chantier || !e.target.files || e.target.files.length === 0) {
      return;
    }

    setUploadingImages(true);
    const uploaded: string[] = [];
    const pathPrefix = `${user.id}/chantiers/${chantier.id}`;

    try {
      for (const file of Array.from(e.target.files)) {
        const url = await uploadFile(pathPrefix, file);
        uploaded.push(url);
      }
      setEditChantier({ ...editChantier, images: [...editChantier.images, ...uploaded] });
      toast({ title: 'Images ajoutées', description: `${uploaded.length} image(s) ajoutée(s).` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : "Erreur lors de l'upload.", variant: 'destructive' });
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (!user?.id) return;
    const img = editChantier.images[index];
    const path = publicUrlToPath(img);
    if (!path) {
      setEditChantier({ ...editChantier, images: editChantier.images.filter((_, i) => i !== index) });
      return;
    }
    try {
      await removeFile(path);
      setEditChantier({ ...editChantier, images: editChantier.images.filter((_, i) => i !== index) });
      toast({ title: 'Image supprimée' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erreur', description: "Impossible de supprimer l'image.", variant: 'destructive' });
    }
  };

  const toggleMemberAssignment = (memberId: string, checked: boolean) => {
    setAssignedMemberIds((prev) =>
      checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)
    );
  };

  if (!chantier) {
    return (
      <PageWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white">Chargement...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-pink-500/10">
        <main className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/dashboard/projects')}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Building className="h-6 w-6" />
                {chantier.nom}
              </h1>
              <Badge
                className={
                  chantier.statut === 'terminé'
                    ? 'bg-green-500/20 text-green-300 border-green-500/50'
                    : chantier.statut === 'en cours'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                      : 'bg-gray-500/20 text-gray-300 border-gray-500/50'
                }
              >
                {chantier.statut}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                className="bg-violet-500 hover:bg-violet-600 text-white"
              >
                Enregistrer
              </Button>
              <UserAccountButton variant="inline" />
            </div>
          </div>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="bg-black/20 border border-white/10 mb-6">
              <TabsTrigger value="info" className="text-white data-[state=active]:bg-white/10">
                Informations
              </TabsTrigger>
              <TabsTrigger value="quotes" className="text-white data-[state=active]:bg-white/10">
                Devis ({chantierQuotes.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-white data-[state=active]:bg-white/10">
                Factures
              </TabsTrigger>
              <TabsTrigger value="team" className="text-white data-[state=active]:bg-white/10">
                Équipe ({assignedMemberIds.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-white data-[state=active]:bg-white/10">
                Documents ({editChantier.images.length})
              </TabsTrigger>
            </TabsList>

            {/* Onglet Informations */}
            <TabsContent value="info">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label className="text-white">Nom du projet</Label>
                    <Input
                      value={editChantier.nom}
                      onChange={(e) => setEditChantier({ ...editChantier, nom: e.target.value })}
                      placeholder="Ex: Rénovation salle de bain"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Client</Label>
                    <Select
                      value={editChantier.clientId}
                      onValueChange={(value) => {
                        const client = clients.find((c) => c.id === value);
                        setEditChantier({ ...editChantier, clientId: value, clientName: client?.name || '' });
                      }}
                    >
                      <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id} className="text-white">
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Date de début</Label>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                            {dateInputValue(editChantier.dateDebut || '') || 'JJ/MM/AAAA'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                          <Calendar
                            mode="single"
                            selected={isoToDate(dateInputToISO(editChantier.dateDebut || '')) ?? undefined}
                            onSelect={(d) => {
                              if (d) {
                                setEditChantier({ ...editChantier, dateDebut: dateToISO(d) });
                                setDatePickerOpen(false);
                              }
                            }}
                            classNames={{
                              caption_label: 'text-white',
                              nav_button: 'text-white',
                              head_cell: 'text-white/70',
                              day_outside: 'text-white/40',
                              day_today: 'bg-white/20 text-white',
                              day_selected: 'bg-violet-500 text-white',
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-white">Durée</Label>
                      <Input
                        value={editChantier.duree}
                        onChange={(e) => setEditChantier({ ...editChantier, duree: e.target.value })}
                        placeholder="Ex: 2 semaines"
                        className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Type de projet</Label>
                    <Select
                      value={editChantier.typeChantier ?? ''}
                      onValueChange={(value) => setEditChantier({ ...editChantier, typeChantier: value || undefined })}
                    >
                      <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                        <SelectItem value="piscine" className="text-white">Piscine & Spa</SelectItem>
                        <SelectItem value="paysage" className="text-white">Aménagement Paysager</SelectItem>
                        <SelectItem value="menuiserie" className="text-white">Menuiserie Sur-Mesure</SelectItem>
                        <SelectItem value="renovation" className="text-white">Rénovation</SelectItem>
                        <SelectItem value="plomberie" className="text-white">Plomberie</SelectItem>
                        <SelectItem value="maconnerie" className="text-white">Maçonnerie</SelectItem>
                        <SelectItem value="terrasse" className="text-white">Terrasse & Patio</SelectItem>
                        <SelectItem value="chauffage" className="text-white">Chauffage & Climatisation</SelectItem>
                        <SelectItem value="isolation" className="text-white">Isolation de la charpente</SelectItem>
                        <SelectItem value="electricite" className="text-white">Électricité</SelectItem>
                        <SelectItem value="peinture" className="text-white">Peinture & Revêtements</SelectItem>
                        <SelectItem value="autre" className="text-white">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">Statut</Label>
                    <Select
                      value={editChantier.statut}
                      onValueChange={(value: 'planifié' | 'en cours' | 'terminé') => setEditChantier({ ...editChantier, statut: value })}
                    >
                      <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                        <SelectItem value="planifié" className="text-white">Planifié</SelectItem>
                        <SelectItem value="en cours" className="text-white">En cours</SelectItem>
                        <SelectItem value="terminé" className="text-white">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">Montant devis (optionnel)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editChantier.montantDevis ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditChantier({ ...editChantier, montantDevis: v === '' ? undefined : Number(v) });
                      }}
                      placeholder="Ex: 15500"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Description du projet</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={editChantier.notes || ''}
                        onChange={(e) => setEditChantier({ ...editChantier, notes: e.target.value })}
                        placeholder="Description du projet"
                        rows={4}
                        className="flex-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                      />
                      <VoiceInputButton
                        onTranscript={(text) => {
                          setEditChantier((prev) => ({
                            ...prev,
                            notes: prev.notes?.trim() ? `${prev.notes} ${text}` : text,
                          }));
                        }}
                        className="self-start mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Notes sur l'avancement</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={editChantier.notesAvancement || ''}
                        onChange={(e) => setEditChantier({ ...editChantier, notesAvancement: e.target.value })}
                        placeholder="Notes sur l'avancement, points bloquants..."
                        rows={4}
                        className="flex-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                      />
                      <VoiceInputButton
                        onTranscript={(text) => {
                          setEditChantier((prev) => ({
                            ...prev,
                            notesAvancement: prev.notesAvancement?.trim() ? `${prev.notesAvancement} ${text}` : text,
                          }));
                        }}
                        className="self-start mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Devis */}
            <TabsContent value="quotes">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
                <CardContent className="p-6">
                  {chantierQuotesLoading ? (
                    <p className="text-white/70">Chargement...</p>
                  ) : chantierQuotes.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-white/50" />
                      <p className="text-white/70 mb-4">Aucun devis pour ce projet</p>
                      <Link href={`/dashboard/quotes?chantierId=${chantierId}`}>
                        <Button variant="outline" className="text-white border-white/20 hover:bg-white/10">
                          <Plus className="h-4 w-4 mr-2" />
                          Créer un devis
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-end mb-3">
                        <Link href={`/dashboard/quotes?chantierId=${chantierId}`}>
                          <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un devis
                          </Button>
                        </Link>
                      </div>
                      {chantierQuotes.map((q) => {
                        const expired = isQuoteExpired(q);
                        return (
                          <div
                            key={q.id}
                            className="rounded-lg bg-black/20 border border-white/10 p-4"
                          >
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div>
                                <p className="font-medium text-white flex items-center gap-2">
                                  {new Date(q.created_at).toLocaleDateString('fr-FR')} — {formatMontantEuro(q.total_ttc)}
                                  {q.status === 'validé' && <Check className="h-4 w-4 text-green-500" />}
                                </p>
                                {expired && q.status !== 'expiré' && (
                                  <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50 mt-1">
                                    ⚠️ Expiré
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                className={
                                  q.status === 'validé' || q.status === 'accepté' || q.status === 'signé'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : q.status === 'refusé' || q.status === 'expiré'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : q.status === 'envoyé'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }
                              >
                                {q.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-white border-white/20 hover:bg-white/10 text-xs"
                                onClick={() => {
                                  setSelectedQuoteForPreview(q);
                                  setIsQuotePreviewOpen(true);
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Prévisualiser
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={quoteDownloadingId !== null}
                                className="text-white border-white/20 hover:bg-white/10 text-xs"
                                onClick={async () => {
                                  setQuoteDownloadingId(q.id);
                                  try {
                                    if (q.status === 'signé' && q.quote_pdf_base64) {
                                      const safeName = (q.client_name || 'devis').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                                      const date = new Date().toISOString().slice(0, 10);
                                      const filename = `devis-signe-${safeName}-${date}.pdf`;
                                      downloadPdfBase64(q.quote_pdf_base64, filename);
                                      toast({ title: 'Devis téléchargé' });
                                      return;
                                    }
                                    const params = quoteToPdfParams(q);
                                    if (user?.id) {
                                      const allQuotes = await fetchQuotesForUser(user.id);
                                      params.quoteNumber = getQuoteDisplayNumber(allQuotes, q.id);
                                    }
                                    params.companyName = profile?.company_name || profile?.full_name || undefined;
                                    params.companyAddress = profile?.company_address ?? undefined;
                                    params.companyCityPostal = profile?.company_city_postal ?? undefined;
                                    params.companyPhone = profile?.company_phone ?? undefined;
                                    params.companyEmail = profile?.company_email ?? undefined;
                                    params.companySiret = profile?.company_siret ?? undefined;
                                    params.themeColor = themeColor ?? undefined;
                                    if (logoUrl) {
                                      const logoDataUrl = await fetchLogoDataUrl(logoUrl);
                                      if (logoDataUrl) params.logoDataUrl = logoDataUrl;
                                    }
                                    downloadQuotePdf(params);
                                    toast({ title: 'Devis téléchargé' });
                                  } catch (err) {
                                    console.error(err);
                                    toast({ title: 'Erreur', variant: 'destructive' });
                                  } finally {
                                    setQuoteDownloadingId(null);
                                  }
                                }}
                              >
                                {quoteDownloadingId === q.id ? 'Téléchargement...' : (
                                  <>
                                    <Download className="h-3 w-3 mr-1" />
                                    Télécharger
                                  </>
                                )}
                              </Button>
                              {q.status !== 'validé' && q.status !== 'signé' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-white border-white/20 hover:bg-white/10 text-xs"
                                  onClick={() => setLocation(`/dashboard/quotes?quoteId=${q.id}`)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Modifier
                                </Button>
                              )}
                              {q.status !== 'validé' && q.status !== 'signé' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={quoteValidatingLoading}
                                  className="text-white border-white/20 hover:bg-white/10 text-xs"
                                  onClick={async () => {
                                    if (!user?.id) return;
                                  setQuoteValidatingLoading(true);
                                    try {
                                      await updateQuoteStatus(q.id, user.id, 'validé');
                                      await createInvoiceFromQuote(user.id, q);
                                      const updated = await fetchQuotesByChantierId(chantierId!);
                                      setChantierQuotes(updated);
                                      toast({ title: 'Devis validé', description: 'La facture a été créée.' });
                                    } catch (err) {
                                      console.error(err);
                                      toast({ title: 'Erreur', variant: 'destructive' });
                                    } finally {
                                      setQuoteValidatingLoading(false);
                                    }
                                  }}
                                >
                                  {quoteValidatingLoading ? 'Chargement...' : (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Valider
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={quoteDeletingId !== null}
                                className="text-red-300 border-red-500/50 hover:bg-red-500/20 text-xs"
                                onClick={async () => {
                                  if (!user?.id || !confirm('Supprimer ce devis ?')) return;
                                  setQuoteDeletingId(q.id);
                                  try {
                                    await deleteQuote(user.id, q.id);
                                    const updated = await fetchQuotesByChantierId(chantierId!);
                                    setChantierQuotes(updated);
                                    toast({ title: 'Devis supprimé' });
                                  } catch (err) {
                                    console.error(err);
                                    toast({ title: 'Erreur', variant: 'destructive' });
                                  } finally {
                                    setQuoteDeletingId(null);
                                  }
                                }}
                              >
                                {quoteDeletingId === q.id ? 'Suppression...' : (
                                  <>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Supprimer
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Factures */}
            <TabsContent value="invoices">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <Receipt className="h-12 w-12 mx-auto mb-4 text-white/50" />
                    <p className="text-white/70 mb-4">Gérez vos factures depuis la page Factures</p>
                    <Button
                      variant="outline"
                      className="text-white border-white/20 hover:bg-white/10"
                      onClick={() => setIsInvoiceDialogOpen(true)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Créer une facture
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Équipe */}
            <TabsContent value="team">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Membres affectés au projet</h3>
                  {loadingAssignments ? (
                    <p className="text-white/70">Chargement...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-white/70">Aucun membre dans l'équipe. Ajoutez des membres depuis Gestion de l'équipe.</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/10 cursor-pointer text-white/90 hover:text-white hover:bg-white/10"
                        >
                          <Checkbox
                            checked={assignedMemberIds.includes(member.id)}
                            onCheckedChange={(checked) => toggleMemberAssignment(member.id, !!checked)}
                            className="border-white/30 data-[state=checked]:bg-white/20"
                          />
                          <User className="h-4 w-4 text-white/50" />
                          <div className="flex-1">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-white/50">{member.role}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Documents */}
            <TabsContent value="documents">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <input
                      id="project-images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleAddImages}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('project-images')?.click()}
                      disabled={uploadingImages}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {uploadingImages ? 'Upload en cours...' : 'Ajouter des images'}
                    </Button>
                  </div>

                  {editChantier.images && editChantier.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {editChantier.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-white/20"
                          />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 text-white/50" />
                      <p className="text-white/70">Aucune image pour ce projet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Dialog de prévisualisation de devis */}
      <Dialog open={isQuotePreviewOpen} onOpenChange={setIsQuotePreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-black/20 backdrop-blur-xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Aperçu du devis</DialogTitle>
          </DialogHeader>
          {selectedQuoteForPreview && (
            <QuotePreview
              quote={{
                client_name: selectedQuoteForPreview.client_name,
                client_email: selectedQuoteForPreview.client_email,
                client_phone: selectedQuoteForPreview.client_phone,
                client_address: selectedQuoteForPreview.client_address,
                project_type: selectedQuoteForPreview.project_type,
                project_description: selectedQuoteForPreview.project_description,
                validity_days: selectedQuoteForPreview.validity_days ?? 30,
                items: selectedQuoteForPreview.items ?? [],
                total_ht: selectedQuoteForPreview.total_ht,
                total_ttc: selectedQuoteForPreview.total_ttc,
              }}
              accentColor={themeColor ?? undefined}
              logoUrl={logoUrl ?? undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de création de facture */}
      <InvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        chantierId={chantierId}
        clientId={chantier.clientId}
        onSaved={() => {
          toast({ title: 'Facture créée avec succès' });
          setIsInvoiceDialogOpen(false);
        }}
      />
    </PageWrapper>
  );
}
