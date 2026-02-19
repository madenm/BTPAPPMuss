import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Building, Plus, Calendar as CalendarIcon, Clock, User, Image as ImageIcon, X, ChevronLeft, ChevronRight, FileText, Pencil, Eye, Download } from 'lucide-react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useChantiers, Client, Chantier } from '@/context/ChantiersContext';
import { uploadFile, removeFile, publicUrlToPath } from '@/lib/supabaseStorage';
import { ChantierEditDialog } from '@/components/ChantierEditDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchTeamMembers, fetchChantierAssignmentsByChantier, addChantierAssignment, removeChantierAssignment, type TeamMember } from '@/lib/supabase';
import { fetchQuotesByChantierId, fetchQuotesForUser, getQuoteDisplayNumber, updateQuoteStatus, deleteQuote, type SupabaseQuote } from '@/lib/supabaseQuotes';
import { downloadQuotePdf, fetchLogoDataUrl, type QuotePdfParams } from '@/lib/quotePdf';
import { QuotePreview } from '@/components/QuotePreview';
import { useUserSettings } from '@/context/UserSettingsContext';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { fetchInvoicesForUser, createInvoiceFromQuote, type InvoiceWithPayments } from '@/lib/supabaseInvoices';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { Receipt, Check, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeleteChantierConfirmDialog } from '@/components/DeleteChantierConfirmDialog';

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

// Chantier en retard si date_fin < aujourd'hui et statut !== terminé
function isChantierEnRetard(chantier: Chantier): boolean {
  if (!chantier.dateFin || chantier.statut === 'terminé') return false;
  const fin = chantier.dateFin.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return fin < today;
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

// ISO (YYYY-MM-DD) -> Date pour le calendrier (date locale)
function isoToDate(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date -> ISO (YYYY-MM-DD) pour l'API
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TYPE_CHANTIER_LABELS: Record<string, string> = {
  piscine: 'Piscine & Spa',
  paysage: 'Aménagement Paysager',
  menuiserie: 'Menuiserie Sur-Mesure',
  renovation: 'Rénovation',
  plomberie: 'Plomberie',
  maconnerie: 'Maçonnerie',
  terrasse: 'Terrasse & Patio',
  chauffage: 'Chauffage & Climatisation',
  isolation: 'Isolation de la charpente',
  electricite: 'Électricité',
  peinture: 'Peinture & Revêtements',
  autre: 'Autre',
};

function quoteToPdfParams(quote: SupabaseQuote): QuotePdfParams {
  const items = (quote.items ?? []).map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.total,
    subItems: i.subItems?.map((s) => ({
      description: s.description,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      total: s.total,
    })),
  }));
  return {
    clientInfo: {
      name: quote.client_name ?? '',
      email: quote.client_email ?? '',
      phone: quote.client_phone ?? '',
      address: quote.client_address ?? '',
    },
    projectType: quote.project_type ?? '',
    projectDescription: quote.project_description ?? '',
    validityDays: String(quote.validity_days ?? 30),
    items,
    subtotal: quote.total_ht,
    tva: quote.total_ttc - quote.total_ht,
    total: quote.total_ttc,
  };
}

const PAGE_SIZE = 12;
type SortOption = 'date_desc' | 'date_asc' | 'montant_desc' | 'montant_asc' | 'statut' | 'nom';

export default function ProjectsPage() {
  const { user } = useAuth();
  const { chantiers, clients, addChantier, addClient, updateChantier, deleteChantier, loading } = useChantiers();
  const { logoUrl, themeColor, profile } = useUserSettings();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [quoteValidatingLoading, setQuoteValidatingLoading] = useState(false);
  const [quoteDeletingId, setQuoteDeletingId] = useState<string | null>(null);
  const [quoteDownloadingId, setQuoteDownloadingId] = useState<string | null>(null);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<SupabaseQuote | null>(null);
  const newChantierUploadFolder = useRef<string>(crypto.randomUUID());
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingEditImages, setUploadingEditImages] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedChantier, setSelectedChantier] = useState<Chantier | null>(null);
  const [chantierQuotes, setChantierQuotes] = useState<SupabaseQuote[]>([]);
  const [chantierQuotesLoading, setChantierQuotesLoading] = useState(false);
  const [isQuotePreviewOpen, setIsQuotePreviewOpen] = useState(false);
  const [chantierInvoices, setChantierInvoices] = useState<InvoiceWithPayments[]>([]);
  const [chantierInvoicesLoading, setChantierInvoicesLoading] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [newChantier, setNewChantier] = useState({
    nom: '',
    clientId: '',
    dateDebut: '',
    dateFin: '',
    duree: '',
    images: [] as string[],
    statut: 'planifié' as 'planifié' | 'en cours' | 'terminé',
    notes: '',
    notesAvancement: '',
    typeChantier: '' as string,
    montantDevis: undefined as number | undefined,
  });
  const [newChantierMemberIds, setNewChantierMemberIds] = useState<string[]>([]);
  const [newChantierLoadingMembers, setNewChantierLoadingMembers] = useState(false);
  const [newChantierTeamMembers, setNewChantierTeamMembers] = useState<TeamMember[]>([]);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [newDatePickerOpen, setNewDatePickerOpen] = useState(false);
  const openedEditIdRef = useRef<string | null>(null);
  const pendingClientIdRef = useRef<string | null>(null);
  const [editChantier, setEditChantier] = useState<Partial<Chantier> & { images: string[] }>({
    nom: '',
    clientId: '',
    clientName: '',
    dateDebut: '',
    duree: '',
    images: [],
    statut: 'planifié',
    notes: '',
    notesAvancement: '',
  });
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [editUploadedImages, setEditUploadedImages] = useState<File[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [editAssignedMemberIds, setEditAssignedMemberIds] = useState<string[]>([]);
  // Search, filters, sort, pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('tous');
  const [filterType, setFilterType] = useState<string>('tous');
  const [filterClient, setFilterClient] = useState<string>('tous');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [assigneesByChantierId, setAssigneesByChantierId] = useState<Record<string, TeamMember[]>>({});
  const [chantierToDelete, setChantierToDelete] = useState<Chantier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const scrollToDevisRef = useRef(false);
  const devisSectionRef = useRef<HTMLDivElement>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Filter + sort + paginate (client-side)
  const filteredSortedChantiers = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    let list = chantiers.filter((c) => {
      if (term && !c.nom.toLowerCase().includes(term) && !c.clientName.toLowerCase().includes(term) && !(c.typeChantier ?? '').toLowerCase().includes(term)) return false;
      if (filterStatut !== 'tous' && c.statut !== filterStatut) return false;
      if (filterType !== 'tous' && c.typeChantier !== filterType) return false;
      if (filterClient !== 'tous' && c.clientId !== filterClient) return false;
      return true;
    });
    const statutOrder = { planifié: 0, 'en cours': 1, terminé: 2 };
    list = [...list].sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime();
      if (sortBy === 'date_asc') return new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime();
      if (sortBy === 'montant_desc') return (b.montantDevis ?? 0) - (a.montantDevis ?? 0);
      if (sortBy === 'montant_asc') return (a.montantDevis ?? 0) - (b.montantDevis ?? 0);
      if (sortBy === 'statut') return (statutOrder[a.statut] ?? 0) - (statutOrder[b.statut] ?? 0);
      if (sortBy === 'nom') return a.nom.localeCompare(b.nom);
      return 0;
    });
    return list;
  }, [chantiers, debouncedSearch, filterStatut, filterType, filterClient, sortBy]);

  const totalFiltered = filteredSortedChantiers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedChantiers = useMemo(
    () => filteredSortedChantiers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredSortedChantiers, currentPage]
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatut, filterType, filterClient, sortBy]);

  // Load assignees for visible chantiers
  useEffect(() => {
    if (paginatedChantiers.length === 0 || !user) {
      setAssigneesByChantierId({});
      return;
    }
    const load = async () => {
      const map: Record<string, TeamMember[]> = {};
      await Promise.all(
        paginatedChantiers.map(async (c) => {
          const members = await fetchChantierAssignmentsByChantier(c.id);
          map[c.id] = members;
        })
      );
      setAssigneesByChantierId(map);
    };
    load();
  }, [paginatedChantiers.map((c) => c.id).join(','), user?.id]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      return;
    }
    const files = Array.from(e.target.files);
    setUploadedImages(prev => [...prev, ...files]);
    setUploadingImages(true);

    const folderId = newChantierUploadFolder.current;
    const pathPrefix = `${user.id}/chantiers/${folderId}`;

    const processFiles = async () => {
      const newUrls: string[] = [];
      for (const file of files) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${pathPrefix}/${Date.now()}-${safeName}`;
          const url = await uploadFile(path, file);
          newUrls.push(url);
        } catch (err) {
          console.error('Upload failed:', err);
          alert('Erreur lors de l\'upload d\'une image. Réessayez.');
        }
      }
      setUploadingImages(false);
      if (newUrls.length > 0) {
        setNewChantier(prev => ({
          ...prev,
          images: [...prev.images, ...newUrls],
        }));
      }
    };

    processFiles();
    e.target.value = '';
  }, [user?.id]);

  const removeImage = (index: number) => {
    setNewChantier(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddChantier = async () => {
    // Vérifier chaque champ individuellement et collecter les champs manquants
    const missingFields: string[] = [];
    
    if (!newChantier.nom || !newChantier.nom.trim()) {
      missingFields.push('Nom du chantier');
    }
    
    if (!newChantier.clientId || !newChantier.clientId.trim()) {
      missingFields.push('Client');
    }
    
    const dateDebutIso = dateInputToISO(newChantier.dateDebut);
    if (!dateDebutIso || !newChantier.dateDebut || !newChantier.dateDebut.trim()) {
      missingFields.push('Date de début');
    }
    
    if (!newChantier.duree || !newChantier.duree.trim()) {
      missingFields.push('Durée');
    }
    
    // Si des champs manquent, afficher un message détaillé
    if (missingFields.length > 0) {
      const fieldsList = missingFields.length === 1 
        ? missingFields[0]
        : missingFields.slice(0, -1).join(', ') + ' et ' + missingFields[missingFields.length - 1];
      
      toast({
        title: 'Informations manquantes',
        description: `Veuillez compléter les champs suivants : ${fieldsList}.`,
        variant: 'destructive',
      });
      return;
    }

    const client = clients.find(c => c.id === newChantier.clientId);
    if (!client) {
      toast({
        title: 'Client introuvable',
        description: 'Le client sélectionné n\'existe pas.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const created = await addChantier({
        nom: newChantier.nom,
        clientId: newChantier.clientId,
        clientName: client.name,
        dateDebut: dateDebutIso,
        dateFin: newChantier.dateFin?.trim() ? dateInputToISO(newChantier.dateFin) : undefined,
        duree: newChantier.duree,
        images: newChantier.images,
        statut: newChantier.statut,
        notes: newChantier.notes || undefined,
        notesAvancement: newChantier.notesAvancement || undefined,
        typeChantier: newChantier.typeChantier || undefined,
        montantDevis: newChantier.montantDevis != null && !isNaN(Number(newChantier.montantDevis)) ? Number(newChantier.montantDevis) : undefined,
      });
      
      // Assigner les membres d'équipe
      for (const memberId of newChantierMemberIds) {
        try {
          await addChantierAssignment(created.id, memberId);
        } catch (err) {
          console.error('Erreur affectation membre', err);
        }
      }
      
      // Réinitialiser le formulaire
      setNewChantier({ nom: '', clientId: '', dateDebut: '', dateFin: '', duree: '', images: [], statut: 'planifié', notes: '', notesAvancement: '', typeChantier: '', montantDevis: undefined });
      setNewChantierMemberIds([]);
      setUploadedImages([]);
      newChantierUploadFolder.current = crypto.randomUUID();
      setIsDialogOpen(false);
      
      toast({
        title: 'Chantier créé',
        description: 'Le chantier a été créé avec succès.',
      });
    } catch (error: any) {
      console.error('Erreur lors de la création du chantier:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de créer le chantier. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  const handleAddClient = async () => {
    const created = await addClient({
      name: `Client ${clients.length + 1}`,
      email: '',
      phone: ''
    });
    setNewChantier(prev => ({ ...prev, clientId: created.id }));
  };

  const handleEditChantier = async (chantier: Chantier, scrollToDevis = false) => {
    scrollToDevisRef.current = scrollToDevis;
    setSelectedChantier(chantier);
    setEditChantier({
      id: chantier.id,
      nom: chantier.nom,
      clientId: chantier.clientId,
      clientName: chantier.clientName,
      dateDebut: chantier.dateDebut,
      dateFin: chantier.dateFin ?? '',
      duree: chantier.duree,
      images: [...chantier.images],
      statut: chantier.statut,
      notes: chantier.notes || '',
      notesAvancement: chantier.notesAvancement || '',
      typeChantier: chantier.typeChantier,
      montantDevis: chantier.montantDevis,
    });
    setEditUploadedImages([]);
    setIsEditDialogOpen(true);
    setLoadingAssignments(true);
    try {
      const [members, assigned] = await Promise.all([
        fetchTeamMembers(),
        fetchChantierAssignmentsByChantier(chantier.id),
      ]);
      setTeamMembers(members);
      setEditAssignedMemberIds(assigned.map((m) => m.id));
    } catch {
      setTeamMembers([]);
      setEditAssignedMemberIds([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const toggleMemberAssignment = (memberId: string, checked: boolean) => {
    setEditAssignedMemberIds((prev) =>
      checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)
    );
  };

  const handleAddImagesToChantier = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id || !selectedChantier || !e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      return;
    }
    const files = Array.from(e.target.files);
    setEditUploadedImages(prev => [...prev, ...files]);
    setUploadingEditImages(true);

    const pathPrefix = `${user.id}/chantiers/${selectedChantier.id}`;

    const processFiles = async () => {
      const newUrls: string[] = [];
      for (const file of files) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${pathPrefix}/${Date.now()}-${safeName}`;
          const url = await uploadFile(path, file);
          newUrls.push(url);
        } catch (err) {
          console.error('Upload failed:', err);
          alert('Erreur lors de l\'upload d\'une image. Réessayez.');
        }
      }
      setUploadingEditImages(false);
      if (newUrls.length > 0) {
        setEditChantier(prev => ({
          ...prev,
          images: [...(prev.images || []), ...newUrls],
        }));
      }
    };

    processFiles();
    e.target.value = '';
  }, [user?.id, selectedChantier]);

  const handleRemoveImageFromChantier = async (index: number) => {
    const currentImages = editChantier.images || [];
    const urlOrData = currentImages[index];
    if (urlOrData?.startsWith('http') && urlOrData.includes('/storage/')) {
      try {
        await removeFile(publicUrlToPath(urlOrData));
      } catch (err) {
        console.error('Delete from storage failed:', err);
      }
    }
    setEditChantier(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleUpdateChantier = async () => {
    const dateDebutIso = dateInputToISO(editChantier.dateDebut || '');
    if (!selectedChantier || !editChantier.nom || !editChantier.clientId || !dateDebutIso || !editChantier.duree) {
      return;
    }

    try {
      const client = clients.find(c => c.id === editChantier.clientId);

      await updateChantier(selectedChantier.id, {
        nom: editChantier.nom,
        clientId: editChantier.clientId,
        clientName: client?.name || editChantier.clientName || 'Client inconnu',
        dateDebut: dateDebutIso,
        dateFin: editChantier.dateFin?.trim() ? dateInputToISO(editChantier.dateFin) : undefined,
        duree: editChantier.duree,
        images: editChantier.images || [],
        statut: editChantier.statut || 'planifié',
        notes: editChantier.notes || undefined,
        notesAvancement: editChantier.notesAvancement || undefined,
        typeChantier: editChantier.typeChantier || undefined,
        montantDevis: editChantier.montantDevis,
      });

      const currentAssigned = await fetchChantierAssignmentsByChantier(selectedChantier.id);
      const currentIds = currentAssigned.map((m) => m.id);
      for (const memberId of editAssignedMemberIds) {
        if (!currentIds.includes(memberId)) await addChantierAssignment(selectedChantier.id, memberId);
      }
      for (const memberId of currentIds) {
        if (!editAssignedMemberIds.includes(memberId)) await removeChantierAssignment(selectedChantier.id, memberId);
      }

      setIsEditDialogOpen(false);
      setSelectedChantier(null);
    setEditChantier({
      nom: '',
      clientId: '',
      clientName: '',
      dateDebut: '',
      dateFin: '',
      duree: '',
      images: [],
      statut: 'planifié',
      notes: '',
      notesAvancement: '',
      typeChantier: undefined,
      montantDevis: undefined,
    });
    setEditUploadedImages([]);
    setEditAssignedMemberIds([]);
  } catch (error) {
      console.error('Erreur lors de la mise à jour du chantier:', error);
      alert('Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.');
    }
  };

  // Ouvrir la popup si le paramètre openDialog est présent dans l'URL (ex. depuis ClientsPage avec clientId, ou depuis Estimation avec fromEstimation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openDialog') === 'true') {
      const clientId = params.get('clientId');
      if (clientId) pendingClientIdRef.current = clientId;
      const fromEstimation = params.get('fromEstimation') === '1';
      if (fromEstimation) {
        try {
          const raw = sessionStorage.getItem('estimationForChantier');
          if (raw) {
            const data = JSON.parse(raw) as { clientName?: string; clientEmail?: string; clientPhone?: string; typeChantier?: string; duree?: string; notes?: string; montantDevis?: number };
            sessionStorage.removeItem('estimationForChantier');
            setNewChantier((prev) => ({
              ...prev,
              typeChantier: data.typeChantier ?? prev.typeChantier,
              duree: data.duree ?? prev.duree,
              notes: data.notes ?? prev.notes,
              montantDevis: data.montantDevis ?? prev.montantDevis,
            }));
            if (data.clientName && clients.length > 0) {
              const match = clients.find((c) => c.name.trim().toLowerCase() === (data.clientName ?? '').trim().toLowerCase());
              if (match) pendingClientIdRef.current = match.id;
            }
          }
        } catch {
          // ignore
        }
      }
      setIsDialogOpen(true);
      window.history.replaceState({}, '', '/dashboard/projects');
    }
  }, [location, clients]);

  // Pré-remplir le client dans le formulaire "Nouveau chantier" quand le dialog s'ouvre avec clientId (depuis ClientsPage)
  useEffect(() => {
    if (!isDialogOpen || !pendingClientIdRef.current || clients.length === 0) return;
    const client = clients.find((c) => c.id === pendingClientIdRef.current);
    if (client) {
      setNewChantier((prev) => ({ ...prev, clientId: client.id, clientName: client.name }));
    }
    pendingClientIdRef.current = null;
  }, [isDialogOpen, clients]);

  // Ouvrir le dialogue d'édition si l'URL contient edit=chantierId (depuis le Planning)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (!editId) {
      openedEditIdRef.current = null;
      return;
    }
    if (chantiers.length === 0) return;
    if (openedEditIdRef.current === editId) return;
    const chantier = chantiers.find(c => c.id === editId);
    if (!chantier) {
      window.history.replaceState({}, '', '/dashboard/projects');
      return;
    }
    openedEditIdRef.current = editId;
    handleEditChantier(chantier);
    window.history.replaceState({}, '', '/dashboard/projects');
  }, [location, chantiers]);

  // Nouveau dossier d'upload + chargement des membres à chaque ouverture du dialog "ajouter chantier"
  useEffect(() => {
    if (isDialogOpen) {
      newChantierUploadFolder.current = crypto.randomUUID();
      setNewChantierLoadingMembers(true);
      fetchTeamMembers()
        .then((members) => {
          setNewChantierTeamMembers(members);
        })
        .finally(() => setNewChantierLoadingMembers(false));
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (!isEditDialogOpen || !selectedChantier || !user?.id) {
      setChantierQuotes([]);
      setChantierInvoices([]);
      return;
    }
    setChantierQuotesLoading(true);
    setChantierInvoicesLoading(true);
    fetchQuotesByChantierId(selectedChantier.id)
      .then((quotes) => {
        setChantierQuotes(quotes);
      })
      .catch(() => setChantierQuotes([]))
      .finally(() => setChantierQuotesLoading(false));
    if (user?.id) {
      fetchInvoicesForUser(user.id, { chantierId: selectedChantier.id })
        .then(setChantierInvoices)
        .catch((err) => {
          console.error("Error loading invoices:", err);
          setChantierInvoices([]);
        })
        .finally(() => setChantierInvoicesLoading(false));
    } else {
      setChantierInvoices([]);
      setChantierInvoicesLoading(false);
    }
  }, [isEditDialogOpen, selectedChantier?.id, user?.id]);

  // Scroll vers la section Devis quand ouvert via le bouton Devis (après chargement des devis)
  useEffect(() => {
    if (!isEditDialogOpen || !scrollToDevisRef.current || chantierQuotesLoading || !devisSectionRef.current) return;
    const timer = setTimeout(() => {
      devisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollToDevisRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [isEditDialogOpen, chantierQuotesLoading, selectedChantier?.id]);

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              Mes Chantiers
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Gérez tous vos projets en cours et terminés</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2 w-full sm:w-auto flex-wrap">
            <Link href="/dashboard/clients">
              <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10 h-9 px-2 sm:px-3">
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Clients</span>
              </Button>
            </Link>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setNewChantier({ nom: '', clientId: '', dateDebut: '', dateFin: '', duree: '', images: [], statut: 'planifié', notes: '', notesAvancement: '', typeChantier: '', montantDevis: undefined });
                  setNewChantierMemberIds([]);
                }
                setIsDialogOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 h-9 px-2 sm:px-3 text-sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Ajouter un Chantier</span>
                  <span className="sm:hidden">Ajouter</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Nouveau Chantier</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Créez un nouveau chantier avec toutes les informations nécessaires
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white">Nom du chantier</Label>
                    <Input
                      value={newChantier.nom}
                      onChange={(e) => setNewChantier({ ...newChantier, nom: e.target.value })}
                      placeholder="Ex: Rénovation salle de bain"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Client</Label>
                    <div className="flex gap-2">
                      <Select
                        value={newChantier.clientId}
                        onValueChange={(value) => setNewChantier({ ...newChantier, clientId: value })}
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddClient}
                        className="text-white border-white/20 hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Type de chantier</Label>
                    <Select
                      value={newChantier.typeChantier}
                      onValueChange={(value) => setNewChantier({ ...newChantier, typeChantier: value })}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Date de début</Label>
                      <Popover open={newDatePickerOpen} onOpenChange={setNewDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30 hover:border-white/20"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                            {dateInputValue(newChantier.dateDebut) || 'JJ/MM/AAAA'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                          <Calendar
                            mode="single"
                            selected={isoToDate(dateInputToISO(newChantier.dateDebut)) ?? undefined}
                            onSelect={(d) => {
                              if (d) {
                                setNewChantier({ ...newChantier, dateDebut: dateToISO(d) });
                                setNewDatePickerOpen(false);
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
                      <Label className="text-white">Durée</Label>
                      <Input
                        value={newChantier.duree}
                        onChange={(e) => setNewChantier({ ...newChantier, duree: e.target.value })}
                        placeholder="Ex: 2 semaines"
                        className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Date de fin (optionnel)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                          {dateInputValue(newChantier.dateFin) || 'JJ/MM/AAAA'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                        <Calendar
                          mode="single"
                          selected={isoToDate(dateInputToISO(newChantier.dateFin)) ?? undefined}
                          onSelect={(d) => d && setNewChantier({ ...newChantier, dateFin: dateToISO(d) })}
                          classNames={{
                            day: 'text-white hover:bg-white/20',
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
                    <Label className="text-white">Statut</Label>
                    <Select
                      value={newChantier.statut}
                      onValueChange={(value: 'planifié' | 'en cours' | 'terminé') => setNewChantier({ ...newChantier, statut: value })}
                    >
                      <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                        <SelectValue placeholder="Sélectionner un statut" />
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
                      value={newChantier.montantDevis ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewChantier({ ...newChantier, montantDevis: v === '' ? undefined : Number(v) });
                      }}
                      placeholder="Ex: 15500"
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Description du projet</Label>
                    <Textarea
                      value={newChantier.notes}
                      onChange={(e) => setNewChantier({ ...newChantier, notes: e.target.value })}
                      placeholder="Décrivez le projet à réaliser (cette description sera reprise dans le devis)"
                      rows={4}
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                    <p className="text-xs text-white/60 mt-1">Utilisée pour préremplir la description dans le générateur de devis.</p>
                  </div>

                  <div>
                    <Label className="text-white">Notes sur l'avancement du projet</Label>
                    <Textarea
                      value={newChantier.notesAvancement}
                      onChange={(e) => setNewChantier({ ...newChantier, notesAvancement: e.target.value })}
                      placeholder="Notes sur l'avancement, points bloquants, remarques..."
                      rows={4}
                      className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Images</Label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="chantier-images"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('chantier-images')?.click()}
                      disabled={!user?.id || uploadingImages}
                      className="w-full text-white border-white/20 hover:bg-white/10"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {uploadingImages ? 'Upload en cours...' : 'Ajouter des images'}
                    </Button>
                    {newChantier.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {newChantier.images.map((img, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={img}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg border border-white/20"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Membres affectés</Label>
                    <p className="text-xs text-white/60">Membres de l'équipe ayant accès à ce chantier.</p>
                    {newChantierLoadingMembers ? (
                      <p className="text-sm text-white/50">Chargement...</p>
                    ) : newChantierTeamMembers.length === 0 ? (
                      <p className="text-sm text-white/50">Aucun membre. Ajoutez des membres depuis Gestion de l'équipe.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-2 mt-2 p-2 rounded-lg bg-black/20 border border-white/10">
                        {newChantierTeamMembers.map((member) => (
                          <label
                            key={member.id}
                            className="flex items-center gap-2 cursor-pointer text-sm text-white/90 hover:text-white"
                          >
                            <Checkbox
                              checked={newChantierMemberIds.includes(member.id)}
                              onCheckedChange={(checked) =>
                                setNewChantierMemberIds((prev) =>
                                  checked ? [...prev, member.id] : prev.filter((id) => id !== member.id)
                                )
                              }
                              className="border-white/30 data-[state=checked]:bg-white/20"
                            />
                            <span>{member.name}</span>
                            <span className="text-white/50 text-xs">({member.role})</span>
                          </label>
                        ))}
                      </div>
                    )}
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
                      onClick={handleAddChantier}
                      disabled={!newChantier.nom || !newChantier.clientId || !dateInputToISO(newChantier.dateDebut) || !newChantier.duree}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      {/* Barre recherche + filtres + tri */}
      {chantiers.length > 0 && (
        <div className="px-4 sm:px-6 pt-4 pb-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                placeholder="Rechercher par nom ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/50 h-9 w-full"
              />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 bg-black/20 border-white/10 text-white">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 border-white/10">
                <SelectItem value="tous" className="text-white">Tous</SelectItem>
                <SelectItem value="planifié" className="text-white">Planifié</SelectItem>
                <SelectItem value="en cours" className="text-white">En cours</SelectItem>
                <SelectItem value="terminé" className="text-white">Terminé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-black/20 border-white/10 text-white min-w-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 border-white/10">
                <SelectItem value="tous" className="text-white">Tous</SelectItem>
                {Object.entries(TYPE_CHANTIER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-white">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-black/20 border-white/10 text-white min-w-0">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 border-white/10">
                <SelectItem value="tous" className="text-white">Tous</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-white">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-black/20 border-white/10 text-white min-w-0">
                <SelectValue placeholder="Tri" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 border-white/10">
                <SelectItem value="date_desc" className="text-white">Date récente ↓</SelectItem>
                <SelectItem value="date_asc" className="text-white">Date ancienne ↑</SelectItem>
                <SelectItem value="montant_desc" className="text-white">Montant ↓</SelectItem>
                <SelectItem value="montant_asc" className="text-white">Montant ↑</SelectItem>
                <SelectItem value="statut" className="text-white">Statut</SelectItem>
                <SelectItem value="nom" className="text-white">Nom A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Dialog d'édition de chantier */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Modifier le chantier</DialogTitle>
            <DialogDescription className="text-white/70">
              Modifiez les informations du chantier et ajoutez des notes sur l'avancement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white">Nom du chantier</Label>
              <Input
                value={editChantier.nom}
                onChange={(e) => setEditChantier({ ...editChantier, nom: e.target.value })}
                placeholder="Ex: Rénovation salle de bain"
                className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
              />
            </div>

            <div>
              <Label className="text-white">Client</Label>
              <div className="flex gap-2">
                <Select
                  value={editChantier.clientId}
                  onValueChange={(value) => {
                    const client = clients.find(c => c.id === value);
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddClient}
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Date de début</Label>
                <Popover open={editDatePickerOpen} onOpenChange={setEditDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30 hover:border-white/20"
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
                          setEditDatePickerOpen(false);
                        }
                      }}
                      classNames={{
                        day_button: "text-white hover:bg-white/20",
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
              <Label className="text-white">Date de fin (optionnel)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    {dateInputValue(editChantier.dateFin || '') || 'JJ/MM/AAAA'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={isoToDate(dateInputToISO(editChantier.dateFin || '')) ?? undefined}
                    onSelect={(d) => d && setEditChantier({ ...editChantier, dateFin: dateToISO(d) })}
                    classNames={{
                      day: 'text-white hover:bg-white/20',
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
              <Label className="text-white">Type de chantier</Label>
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
                  <SelectValue placeholder="Sélectionner un statut" />
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
                  placeholder="Description du projet (reprise dans le devis)."
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
              <p className="text-xs text-white/60 mt-1">Utilisée pour préremplir la description dans le générateur de devis.</p>
            </div>

            <div>
              <Label className="text-white">Notes sur l'avancement du projet</Label>
              <div className="flex gap-2">
                <Textarea
                  value={editChantier.notesAvancement || ''}
                  onChange={(e) => setEditChantier({ ...editChantier, notesAvancement: e.target.value })}
                  placeholder="Notes sur l'avancement, points bloquants, remarques..."
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

            <div>
              <Label className="text-white">Images actuelles</Label>
              {editChantier.images && editChantier.images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {editChantier.images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Image ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg border border-white/20"
                      />
                      <button
                        onClick={() => handleRemoveImageFromChantier(index)}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50 mt-2">Aucune image</p>
              )}
            </div>

            <div>
              <Label className="text-white">Ajouter des images</Label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddImagesToChantier}
                className="hidden"
                id="edit-chantier-images"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('edit-chantier-images')?.click()}
                disabled={!user?.id || uploadingEditImages}
                className="w-full text-white border-white/20 hover:bg-white/10"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {uploadingEditImages ? 'Upload en cours...' : 'Ajouter des images'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Membres affectés</Label>
              <p className="text-xs text-white/60">Membres de l'équipe ayant accès à ce chantier.</p>
              {loadingAssignments ? (
                <p className="text-sm text-white/50">Chargement...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-white/50">Aucun membre. Ajoutez des membres depuis Gestion de l'équipe.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 mt-2 p-2 rounded-lg bg-black/20 border border-white/10">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 cursor-pointer text-sm text-white/90 hover:text-white"
                    >
                      <Checkbox
                        checked={editAssignedMemberIds.includes(member.id)}
                        onCheckedChange={(checked) => toggleMemberAssignment(member.id, !!checked)}
                        className="border-white/30 data-[state=checked]:bg-white/20"
                      />
                      <span>{member.name}</span>
                      <span className="text-white/50 text-xs">({member.role})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div ref={devisSectionRef} className="space-y-2">
              <Label className="text-white">Devis</Label>
              {chantierQuotesLoading ? (
                <p className="text-sm text-white/50">Chargement...</p>
              ) : chantierQuotes.length === 0 ? (
                <div className="rounded-lg bg-black/20 border border-white/10 p-4 space-y-2">
                  <p className="text-sm text-white/70">Aucun devis pour ce chantier.</p>
                  <Link href={selectedChantier ? `/dashboard/quotes?chantierId=${selectedChantier.id}` : '/dashboard/quotes'}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Créer un devis
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {chantierQuotes.length > 1 && (
                    <p className="text-sm text-white/70">
                      {chantierQuotes.length} devis pour ce chantier. Supprimez ceux en trop.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-white/60">Tous les devis de ce chantier :</p>
                    <Link href={selectedChantier ? `/dashboard/quotes?chantierId=${selectedChantier.id}` : '/dashboard/quotes'}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-white border-white/20 hover:bg-white/10"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Créer un devis
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {chantierQuotes.map((q) => {
                      const expired = isQuoteExpired(q);
                      return (
                        <div
                          key={q.id}
                          className="flex flex-col gap-2 rounded-lg bg-black/20 border border-white/10 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm text-white/90">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium flex items-center gap-2">
                                {new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} — {formatMontantEuro(q.total_ttc)}
                                {q.status === 'validé' && (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                                {q.status === 'envoyé' && q.status !== 'validé' && ` — ${q.status}`}
                              </span>
                              {expired && q.status !== 'expiré' && (
                                <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50 w-fit">
                                  ⚠️ Date de validité dépassée
                                </Badge>
                              )}
                            </div>
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
                                const params = quoteToPdfParams(q);
                                if (user?.id) {
                                  const allQuotes = await fetchQuotesForUser(user.id);
                                  params.quoteNumber = getQuoteDisplayNumber(allQuotes, q.id);
                                }
                                params.companyName = profile?.full_name ?? undefined;
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
                                toast({ title: 'Devis téléchargé', description: 'Le PDF a été téléchargé.' });
                              } catch (err) {
                                console.error(err);
                                toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Impossible de télécharger le PDF.', variant: 'destructive' });
                              } finally {
                                setQuoteDownloadingId(null);
                              }
                            }}
                          >
                            {quoteDownloadingId === q.id ? (
                              <>Téléchargement...</>
                            ) : (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                Télécharger
                              </>
                            )}
                          </Button>
                          {q.status !== 'validé' && (
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
                          {q.status !== 'validé' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={quoteValidatingLoading || !user?.id || !selectedChantier}
                              className="text-white border-white/20 hover:bg-white/10 text-xs"
                              onClick={async () => {
                                if (!user?.id || !selectedChantier) return;
                                setQuoteValidatingLoading(true);
                                try {
                                  await updateQuoteStatus(q.id, user.id, 'validé');
                                  const invoice = await createInvoiceFromQuote(user.id, q);
                                  const updated = await fetchQuotesByChantierId(selectedChantier.id);
                                  setChantierQuotes(updated);
                                  toast({
                                    title: 'Devis validé',
                                    description: invoice
                                      ? 'Le devis a été validé et la facture correspondante a été créée dans la page Factures.'
                                      : 'Le devis a été marqué comme validé et ne sera plus compté dans les devis en attente.',
                                  });
                                } catch (err) {
                                  console.error(err);
                                  toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Impossible de marquer le devis comme validé.', variant: 'destructive' });
                                } finally {
                                  setQuoteValidatingLoading(false);
                                }
                              }}
                            >
                              {quoteValidatingLoading ? (
                                <>Chargement...</>
                              ) : (
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
                            disabled={quoteDeletingId !== null || !user?.id || !selectedChantier}
                            className="text-red-300 border-red-500/50 hover:bg-red-500/20 text-xs"
                            onClick={async () => {
                              if (!user?.id || !selectedChantier || !confirm('Supprimer ce devis ?')) return;
                              setQuoteDeletingId(q.id);
                              try {
                                await deleteQuote(user.id, q.id);
                                const updated = await fetchQuotesByChantierId(selectedChantier.id);
                                setChantierQuotes(updated);
                                toast({ title: 'Devis supprimé', description: 'Le devis a été supprimé.' });
                              } catch (err) {
                                console.error(err);
                                toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Impossible de supprimer le devis.', variant: 'destructive' });
                              } finally {
                                setQuoteDeletingId(null);
                              }
                            }}
                          >
                            {quoteDeletingId === q.id ? (
                              <>Suppression...</>
                            ) : (
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
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white">Factures</Label>
              <p className="text-xs text-white/60">Factures associées à ce chantier.</p>
              {chantierInvoicesLoading ? (
                <p className="text-sm text-white/50">Chargement...</p>
              ) : chantierInvoices.length === 0 ? (
                <div className="rounded-lg bg-black/20 border border-white/10 p-4 space-y-2">
                  <p className="text-sm text-white/70">Aucune facture pour ce chantier.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInvoiceDialogOpen(true)}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Créer une facture
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white/70">
                    {chantierInvoices.length} facture(s) associée(s) à ce chantier.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/dashboard/invoices?chantierId=${selectedChantier?.id}`)}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Voir les factures
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsInvoiceDialogOpen(true)}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Créer une facture
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="text-white border-white/20 hover:bg-white/10"
              >
                Annuler
              </Button>
              <Button
                onClick={handleUpdateChantier}
                disabled={!editChantier.nom || !editChantier.clientId || !dateInputToISO(editChantier.dateDebut || '') || !editChantier.duree}
                className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuotePreviewOpen} onOpenChange={(open) => {
        setIsQuotePreviewOpen(open);
        if (!open) {
          setSelectedQuoteForPreview(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Aperçu du devis
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {selectedQuoteForPreview
                ? `Devis du ${new Date(selectedQuoteForPreview.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                : 'Devis sélectionné'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2 min-h-0">
            {selectedQuoteForPreview && (
              <QuotePreview
                quote={{
                  client_name: selectedQuoteForPreview.client_name,
                  client_email: selectedQuoteForPreview.client_email,
                  client_phone: selectedQuoteForPreview.client_phone,
                  client_address: selectedQuoteForPreview.client_address,
                  project_type: selectedQuoteForPreview.project_type,
                  project_description: selectedQuoteForPreview.project_description,
                  validity_days: selectedQuoteForPreview.validity_days,
                  items: selectedQuoteForPreview.items,
                  total_ht: selectedQuoteForPreview.total_ht,
                  total_ttc: selectedQuoteForPreview.total_ttc,
                }}
                accentColor="#8b5cf6"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <main className="flex-1 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-white">
            Chargement des chantiers...
          </div>
        ) : chantiers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md text-center bg-black/20 backdrop-blur-xl border border-white/10 text-white">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
                  <Building className="h-8 w-8 text-white/70" />
                </div>
                <CardTitle className="text-xl text-white">Aucun chantier</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/70 mb-4">
                  Commencez par ajouter votre premier chantier
                </p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un chantier
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedChantiers.map((chantier) => {
                const imageIndex = currentImageIndex[chantier.id] || 0;
                const hasMultipleImages = chantier.images.length > 1;
                const canGoLeft = hasMultipleImages && imageIndex > 0;
                const canGoRight = hasMultipleImages && imageIndex < chantier.images.length - 1;
                const assignees = assigneesByChantierId[chantier.id] ?? [];
                const enRetard = isChantierEnRetard(chantier);

                return (
                  <Card
                    key={chantier.id}
                    className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer rounded-lg overflow-hidden"
                  >
                    <div onClick={() => handleEditChantier(chantier)}>
                      {chantier.images.length > 0 && (
                        <div className="relative h-48 overflow-hidden rounded-t-lg group">
                          <img
                            src={chantier.images[imageIndex]}
                            alt={chantier.nom}
                            className="w-full h-full object-cover"
                          />
                          {hasMultipleImages && (
                            <>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {chantier.images.slice(0, 5).map((_, i) => (
                                  <span
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${i === imageIndex ? 'bg-white' : 'bg-white/40'}`}
                                  />
                                ))}
                              </div>
                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                {imageIndex + 1} / {chantier.images.length}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => ({ ...prev, [chantier.id]: Math.max(0, imageIndex - 1) }));
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-opacity"
                                aria-label="Photo précédente"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(prev => ({ ...prev, [chantier.id]: Math.min(chantier.images.length - 1, imageIndex + 1) }));
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-opacity"
                                aria-label="Photo suivante"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold">{chantier.nom}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <User className="h-4 w-4 shrink-0" />
                          {chantier.clientName}
                        </div>
                        {chantier.typeChantier && (
                          <div className="text-xs text-white/50 mt-0.5">
                            {TYPE_CHANTIER_LABELS[chantier.typeChantier] ?? chantier.typeChantier}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <CalendarIcon className="h-4 w-4 shrink-0" />
                          {formatDateToDDMMYYYY(chantier.dateDebut)}
                          {chantier.dateFin && (
                            <span className="text-white/50"> → {formatDateToDDMMYYYY(chantier.dateFin)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <Clock className="h-4 w-4 shrink-0" />
                          {chantier.duree}
                        </div>
                        {chantier.montantDevis != null && chantier.montantDevis > 0 && (
                          <div className="flex items-center gap-2 text-sm text-white/80">
                            <FileText className="h-4 w-4 shrink-0" />
                            {formatMontantEuro(chantier.montantDevis)}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            chantier.statut === 'planifié' ? 'bg-blue-500/20 text-blue-300' :
                            chantier.statut === 'en cours' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-green-500/20 text-green-300'
                          }`}>
                            {chantier.statut}
                          </span>
                          {enRetard && (
                            <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">
                              En retard
                            </span>
                          )}
                        </div>
                        {assignees.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-white/60 mt-2">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            {assignees.slice(0, 2).map((m) => m.name).join(', ')}
                            {assignees.length > 2 && ` +${assignees.length - 2}`}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-white border-white/20 hover:bg-white/10"
                            onClick={() => handleEditChantier(chantier, true)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Devis
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-white border-white/20 hover:bg-white/10"
                            onClick={() => handleEditChantier(chantier)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-300 border-red-500/50 hover:bg-red-500/20"
                            onClick={() => setChantierToDelete(chantier)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
            {totalFiltered > PAGE_SIZE && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                <p className="text-sm text-white/70">
                  Afficher {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalFiltered)} de {totalFiltered} chantiers
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-white border-white/20 hover:bg-white/10"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </Button>
                  <span className="text-sm text-white/70 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-white border-white/20 hover:bg-white/10"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <DeleteChantierConfirmDialog
        open={!!chantierToDelete}
        onOpenChange={(open) => !open && setChantierToDelete(null)}
        chantierName={chantierToDelete?.nom ?? ''}
        loading={deleteLoading}
        onConfirm={async () => {
          if (!chantierToDelete) return;
          setDeleteLoading(true);
          try {
            await deleteChantier(chantierToDelete.id);
            toast({ title: 'Chantier supprimé', description: 'Le chantier a été masqué.' });
            setChantierToDelete(null);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message) : 'Impossible de supprimer.';
            toast({ title: 'Erreur', description: errMsg || 'Impossible de supprimer.', variant: 'destructive' });
          } finally {
            setDeleteLoading(false);
          }
        }}
      />

      <InvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        chantierId={selectedChantier?.id || null}
        clientId={selectedChantier?.clientId || null}
        onSaved={() => {
          if (selectedChantier && user?.id) {
            fetchInvoicesForUser(user.id, { chantierId: selectedChantier.id })
              .then(setChantierInvoices)
              .catch(() => setChantierInvoices([]));
          }
        }}
      />
    </PageWrapper>
  );
}
