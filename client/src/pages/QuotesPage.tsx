import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DevisGeneratingLoader } from '@/components/ui/devis-generating-loader';
import { getApiPostHeaders } from '@/lib/apiHeaders';
import { useAuth } from '@/context/AuthContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useToast } from '@/hooks/use-toast';
import { UserAccountButton } from '@/components/UserAccountButton';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { insertQuote, updateQuote, deleteQuote, updateQuoteStatus, fetchQuoteById, fetchQuotesForUser, getQuoteDisplayNumber, type QuoteItem, type QuoteSubItem, type SupabaseQuote } from '@/lib/supabaseQuotes';
import { DEFAULT_THEME_COLOR, QUOTE_STATUS_LABELS, QUOTE_UNIT_NONE, QUOTE_UNIT_OPTIONS, inferUnitFromDescription, backfillUnitOnItems } from '@/lib/quoteConstants';
import { downloadQuotePdf, fetchLogoDataUrl } from '@/lib/quotePdf';
import { QuotePreview } from '@/components/QuotePreview';
import { QuoteList } from '@/components/QuoteList';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { QuotesQuestionnaire } from '@/components/QuotesQuestionnaire';
import { hasQuestionsForType } from '@/lib/estimationQuestionnaire';
import { fetchTariffs, type UserTariff } from '@/lib/supabaseTariffs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Download,
  Calculator,
  User,
  Users,
  Building,
  Euro,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Loader2,
  Receipt,
  Save,
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  List,
  Pencil,
  ExternalLink,
  Columns2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export default function QuotesPage() {
  const { user, session } = useAuth();
  const { clients, chantiers, addChantier, addClient, updateChantier, refreshChantiers } = useChantiers();
  const { logoUrl, themeColor, profile } = useUserSettings();
  const accentColor = themeColor || DEFAULT_THEME_COLOR;
  const [location, setLocation] = useLocation();
  const pathname = location.includes('?') ? location.slice(0, location.indexOf('?')) : location;
  const [showNewFormFromClick, setShowNewFormFromClick] = useState(false);
  const keepFormVisibleRef = useRef(false);
  const searchString = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = new URLSearchParams(searchString || (location.includes('?') ? location.slice(location.indexOf('?')) : ''));
  const [quoteIdToOpenFromList, setQuoteIdToOpenFromList] = useState<string | null>(null);
  const [forceListView, setForceListView] = useState(false);
  const showForm = !forceListView && !!(pathname === '/dashboard/quotes/new' || keepFormVisibleRef.current || showNewFormFromClick || searchParams.get('quoteId') || searchParams.get('chantierId') || searchParams.get('new') === '1' || quoteIdToOpenFromList);

  useEffect(() => {
    if (pathname === '/dashboard/quotes/new' || searchParams.get('quoteId') || searchParams.get('chantierId')) {
      setForceListView(false);
    }
  }, [pathname, searchParams.get('quoteId'), searchParams.get('chantierId')]);

  const [listQuotes, setListQuotes] = useState<SupabaseQuote[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listStatusFilter, setListStatusFilter] = useState<string>('all');
  const [listSearchQuery, setListSearchQuery] = useState('');

  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [splitPreview, setSplitPreview] = useState(false);
  const [selectClientOpen, setSelectClientOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectChantierOpen, setSelectChantierOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedChantierId, setSelectedChantierId] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingQuoteStatus, setEditingQuoteStatus] = useState<'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré' | 'validé' | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const [projectType, setProjectType] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [useAiForPrefill, setUseAiForPrefill] = useState(true);
  const [validityDays, setValidityDays] = useState('30');
  const [tvaRate, setTvaRate] = useState('20');
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [generalConditions, setGeneralConditions] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }
  ]);
  const [userTariffs, setUserTariffs] = useState<UserTariff[]>([]);
  const [openTariffPopoverId, setOpenTariffPopoverId] = useState<string | null>(null);
  const [tariffSearchQuery, setTariffSearchQuery] = useState('');
  const [tariffCategoryFilter, setTariffCategoryFilter] = useState<string>('all');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);

  const [highlightMissing, setHighlightMissing] = useState<{
    clientName?: boolean;
    clientEmail?: boolean;
    itemsSection?: boolean;
    itemIds?: string[];
  }>({});
  const [quoteLoadState, setQuoteLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const clientCardRef = useRef<HTMLDivElement>(null);
  const itemsCardRef = useRef<HTMLDivElement>(null);
  const lastAppliedQuoteIdRef = useRef<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingChantier, setIsCreatingChantier] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!showForm && user?.id) {
      setListLoading(true);
      fetchQuotesForUser(user.id, listStatusFilter === 'all' ? undefined : listStatusFilter)
        .then(setListQuotes)
        .catch(() => setListQuotes([]))
        .finally(() => setListLoading(false));
    }
  }, [showForm, user?.id, listStatusFilter]);

  const hasResetForNewRef = useRef(false);
  useEffect(() => {
    if (!showForm) {
      hasResetForNewRef.current = false;
      return;
    }
    const isNewPath = pathname === '/dashboard/quotes/new';
    const isNewParam = searchParams.get('new') === '1' && !searchParams.get('quoteId');
    if (!isNewPath && !isNewParam) {
      hasResetForNewRef.current = false;
      return;
    }
    if (hasResetForNewRef.current) return;
    hasResetForNewRef.current = true;
    setStep(1);
    setEditingQuoteId(null);
    setEditingQuoteStatus(null);
    setClientInfo({ name: '', email: '', phone: '', address: '' });
    setProjectType('');
    setProjectDescription('');
    setQuestionnaireAnswers({});
    setValidityDays('30');
    setTvaRate('20');
    setDiscountType('none');
    setDiscountValue('');
    setGeneralConditions('');
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
    setSelectedClientId(null);
    setSelectedChantierId(null);
    setQuoteLoadState('idle');
    lastAppliedQuoteIdRef.current = null;
  }, [showForm, pathname, searchParams.get('new'), searchParams.get('quoteId')]);

  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    fetch('/api/ai-status')
      .then((r) => r.json().catch(() => ({})))
      .then((data) => setAiAvailable(data?.available === true))
      .catch(() => setAiAvailable(false));
  }, [step]);

  useEffect(() => {
    const hasAny = highlightMissing.clientName || highlightMissing.clientEmail || highlightMissing.itemsSection || (highlightMissing.itemIds?.length ?? 0) > 0;
    if (!hasAny) return;
    const t = setTimeout(() => setHighlightMissing({}), 4000);
    return () => clearTimeout(t);
  }, [highlightMissing.clientName, highlightMissing.clientEmail, highlightMissing.itemsSection, highlightMissing.itemIds?.length]);

  useEffect(() => {
    if (step === 1 && (highlightMissing.clientName || highlightMissing.clientEmail)) {
      clientCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step, highlightMissing.clientName, highlightMissing.clientEmail]);

  useEffect(() => {
    if (step === 3 && highlightMissing.itemsSection) {
      itemsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step, highlightMissing.itemsSection]);

  const hasAppliedChantierIdRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const chantierId = params.get('chantierId');
    
    // Si pas de chantierId dans l'URL, réinitialiser la référence
    if (!chantierId) {
      hasAppliedChantierIdRef.current = null;
      return;
    }
    
    // Si ce chantierId a déjà été appliqué, ne rien faire
    if (hasAppliedChantierIdRef.current === chantierId) return;
    
    // Si les données ne sont pas encore chargées, attendre
    if (chantiers.length === 0 || clients.length === 0) return;
    
    const chantier = chantiers.find((c) => c.id === chantierId);
    if (!chantier) return;
    
    // Marquer ce chantierId comme appliqué
    hasAppliedChantierIdRef.current = chantierId;
    
    // Préremplir les informations du client
    const client = clients.find((c) => c.id === chantier.clientId);
    setSelectedClientId(chantier.clientId);
    setClientInfo({
      name: client?.name ?? chantier.clientName ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: '', // Le type Client n'a pas de champ address
    });
    
    // Préremplir les informations du chantier
    setSelectedChantierId(chantier.id);
    const validTypes = ['piscine', 'paysage', 'menuiserie', 'renovation', 'plomberie', 'maconnerie', 'terrasse', 'chauffage', 'isolation', 'electricite', 'peinture', 'autre'];
    const valueToSet = chantier.typeChantier && validTypes.includes(chantier.typeChantier) ? chantier.typeChantier : 'autre';
    setProjectType(valueToSet);
    // Description du projet = nom + notes (champ "Description du projet" de la fiche chantier)
    setProjectDescription(chantier.notes ? `${chantier.nom}\n${chantier.notes}` : chantier.nom);
    
    // Passer directement à l'étape 2
    setStep(2);
  }, [chantiers, clients]);

  useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const quoteIdFromUrl = params.get('quoteId');
    const quoteId = quoteIdFromUrl || quoteIdToOpenFromList;
    if (!quoteId) {
      setQuoteLoadState('idle');
      lastAppliedQuoteIdRef.current = null;
      return;
    }
    if (lastAppliedQuoteIdRef.current === quoteId) return;
    setQuoteLoadState('loading');
    fetchQuoteById(user.id, quoteId).then((quote) => {
      if (!quote) {
        setQuoteLoadState('error');
        lastAppliedQuoteIdRef.current = null;
        setQuoteIdToOpenFromList(null);
        toast({
          title: 'Devis introuvable',
          description: 'Ce devis n\'existe pas ou vous n\'y avez pas accès.',
          variant: 'destructive',
        });
        setLocation('/dashboard/quotes');
        return;
      }
      // Empêcher la modification d'un devis validé
      if (quote.status === 'validé') {
        setQuoteLoadState('error');
        lastAppliedQuoteIdRef.current = null;
        setQuoteIdToOpenFromList(null);
        toast({
          title: 'Devis validé',
          description: 'Ce devis a été validé et ne peut plus être modifié.',
          variant: 'destructive',
        });
        // Rediriger vers la page des projets si le devis est associé à un chantier
        if (quote.chantier_id) {
          setLocation('/dashboard/projects');
        } else {
          setLocation('/dashboard/quotes');
        }
        return;
      }
      lastAppliedQuoteIdRef.current = quoteId;
      setQuoteIdToOpenFromList(null);
      if (typeof window !== 'undefined' && !quoteIdFromUrl) {
        window.history.replaceState({}, '', `/dashboard/quotes?quoteId=${quoteId}`);
      }
      setEditingQuoteId(quoteId);
      setEditingQuoteStatus(quote.status);
      setClientInfo({
        name: quote.client_name ?? '',
        email: quote.client_email ?? '',
        phone: quote.client_phone ?? '',
        address: quote.client_address ?? '',
      });
      setProjectType(quote.project_type ?? '');
      setProjectDescription(quote.project_description ?? '');
      setValidityDays(String(quote.validity_days ?? 30));
      setItems(Array.isArray(quote.items) && quote.items.length > 0 ? backfillUnitOnItems(quote.items) : [{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
      setSelectedChantierId(quote.chantier_id ?? null);
      const chantier = quote.chantier_id ? chantiers.find((c) => c.id === quote.chantier_id) : null;
      setSelectedClientId(chantier?.clientId ?? null);
      setStep(3);
      setQuoteLoadState('loaded');
    });
  }, [user?.id, chantiers, toast, setLocation, location, searchString, quoteIdToOpenFromList]);

  // Garder le chantier sélectionné cohérent avec le client : ne jamais afficher un chantier d'un autre client
  useEffect(() => {
    if (!selectedChantierId) return;
    if (!selectedClientId) {
      setSelectedChantierId(null);
      setProjectDescription('');
      return;
    }
    if (chantiers.length === 0) return;
    const ch = chantiers.find((c) => c.id === selectedChantierId);
    // Ne réinitialiser que si le chantier est en liste et appartient à un autre client (pas si absent, ex. chantier venant d'être créé)
    if (ch && ch.clientId !== selectedClientId) {
      setSelectedChantierId(null);
      setProjectDescription('');
    }
  }, [selectedClientId, selectedChantierId, chantiers]);

  useEffect(() => {
    if (step !== 3 || !user?.id) return;
    fetchTariffs(user.id).then(setUserTariffs).catch(() => setUserTariffs([]));
  }, [step, user?.id]);

  const normalizeUnitFromTariff = (raw: string | undefined): string => {
    const u = raw?.trim().toLowerCase();
    if (u === 'u') return 'U';
    if (u === 'forfait') return 'Forfait';
    if (u === 'm²' || u === 'm2') return 'm²';
    if (u === 'piece' || u === 'pièce') return 'Pièce';
    if (u === 'jour') return 'jour';
    if (u === 'lot') return 'lot';
    return raw?.trim() || '';
  };

  const applyTariffToItem = (itemId: string, tariff: UserTariff) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const quantity = it.quantity || 1;
        const unitPrice = Number(tariff.price_ht) >= 0 ? Number(tariff.price_ht) : 0;
        const unit = normalizeUnitFromTariff(tariff.unit) || (it.unit ?? '');
        return {
          ...it,
          description: tariff.label,
          unitPrice,
          total: quantity * unitPrice,
          unit,
        };
      })
    );
  };

  const addItem = () => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      unit: '',
    };
    setItems((prev) => [newItem, ...prev]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const reorderItems = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (draggedId === targetId) return;
    const fromIndex = items.findIndex((i) => i.id === draggedId);
    const toIndex = items.findIndex((i) => i.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    let insertIndex = position === 'after' ? toIndex + 1 : toIndex;
    if (fromIndex < insertIndex) insertIndex -= 1;
    const next = [...items];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(insertIndex, 0, removed);
    setItems(next);
  };

  const moveItemUp = (itemId: string) => {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx <= 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };

  const moveItemDown = (itemId: string) => {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1 || idx >= items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setItems(next);
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const getItemTotal = (item: QuoteItem): number => {
    if (item.subItems?.length) {
      return item.subItems.reduce((s, sub) => s + sub.total, 0);
    }
    return item.quantity * item.unitPrice;
  };

  const addSubItem = (itemId: string) => {
    const newSub: QuoteSubItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      unit: '',
    };
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const subItems = [...(item.subItems ?? []), newSub];
      return { ...item, subItems };
    }));
  };

  const removeSubItem = (itemId: string, subId: string) => {
    setItems(items.map(item => {
      if (item.id !== itemId || !item.subItems?.length) return item;
      const subItems = item.subItems.filter(s => s.id !== subId);
      return { ...item, subItems: subItems.length ? subItems : undefined };
    }));
  };

  const updateSubItem = (itemId: string, subId: string, field: keyof QuoteSubItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== itemId || !item.subItems) return item;
      const subItems = item.subItems.map(sub => {
        if (sub.id !== subId) return sub;
        const updated = { ...sub, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      });
      return { ...item, subItems };
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const discountAmount = discountType === 'percent'
    ? subtotal * (parseFloat(discountValue) || 0) / 100
    : discountType === 'fixed'
      ? parseFloat(discountValue) || 0
      : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const parsedTvaRate = parseFloat(tvaRate) || 0;
  const tva = subtotalAfterDiscount * (parsedTvaRate / 100);
  const total = subtotalAfterDiscount + tva;

  const handleNext = async () => {
    const nextStep = Math.min(3, step + 1);
    const needPrefill = step === 2 && nextStep === 3 && projectDescription.trim();

    if (needPrefill && !useAiForPrefill) {
      setStep(nextStep);
      return;
    }

    // Coche "Utiliser l'analyse IA" mais description vide → expliquer et ne pas avancer
    if (step === 2 && nextStep === 3 && useAiForPrefill && !projectDescription.trim()) {
      toast({
        title: 'Description requise pour l\'analyse IA',
        description: 'Remplissez la description du projet ci‑dessus pour que l\'IA préremplisse le devis à l\'étape 3.',
        variant: 'destructive',
      });
      return;
    }

    if (needPrefill && useAiForPrefill) {
      setIsAiParsing(true);
      try {
        const payload = {
          description: projectDescription,
          projectType: projectType?.trim() || undefined,
          questionnaireAnswers: Object.keys(questionnaireAnswers).length > 0 ? questionnaireAnswers : undefined,
        };
        const res = await fetch('/api/parse-quote-description', {
          method: 'POST',
          headers: getApiPostHeaders(session?.access_token),
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.items) && data.items.length > 0) {
          const baseId = `ai-next-${Date.now()}`;
          const mapped: QuoteItem[] = data.items.map(
            (row: { description?: string; quantity?: number; unitPrice?: number; subItems?: Array<{ description?: string; quantity?: number; unitPrice?: number }> }, index: number) => {
              const desc = typeof row.description === 'string' ? row.description.trim() : '';
              const qty = typeof row.quantity === 'number' && row.quantity >= 0 ? row.quantity : 0;
              const price = typeof row.unitPrice === 'number' && row.unitPrice >= 0 ? row.unitPrice : 0;
              const subList = Array.isArray(row.subItems) ? row.subItems : [];
              const subItemsMapped: QuoteSubItem[] = subList
                .map((sub: { description?: string; quantity?: number; unitPrice?: number }, subIndex: number) => {
                  const sDesc = typeof sub.description === 'string' ? sub.description.trim() : '';
                  const sQty = typeof sub.quantity === 'number' && sub.quantity >= 0 ? sub.quantity : 0;
                  const sPrice = typeof sub.unitPrice === 'number' && sub.unitPrice >= 0 ? sub.unitPrice : 0;
                  return {
                    id: `${baseId}-${index}-${subIndex}`,
                    description: sDesc,
                    quantity: sQty,
                    unitPrice: sPrice,
                    total: sQty * sPrice,
                    unit: '',
                  };
                })
                .filter((s) => s.description.length > 0);
              const hasSubItems = subItemsMapped.length > 0;
              return {
                id: `${baseId}-${index}`,
                description: desc,
                quantity: hasSubItems ? 0 : qty,
                unitPrice: hasSubItems ? 0 : price,
                total: hasSubItems ? 0 : qty * price,
                unit: '',
                ...(hasSubItems ? { subItems: subItemsMapped } : {}),
              };
            }
          );
          const valid = mapped.filter((i) => i.description.length > 0);
          if (valid.length > 0) {
            setItems(valid);
            toast({
              title: 'Devis prérempli par l\'IA',
              description: `${valid.length} ligne(s) générée(s) à partir de la description (analyse spécialiste).`,
            });
          } else {
            setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
            toast({ title: 'Devis', description: 'Aucune ligne générée. Saisissez le détail manuellement.' });
          }
        } else {
          const msg = (data?.message && typeof data.message === 'string') ? data.message : 'L\'analyse IA est indisponible.';
          if (res.status === 503) {
            toast({
              title: 'Analyse IA requise',
              description: msg,
              variant: 'destructive',
            });
            setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
          } else {
            toast({ title: 'Erreur', description: msg, variant: 'destructive' });
            setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
          }
        }
      } catch {
        toast({
          title: 'Erreur',
          description: 'Impossible de contacter le serveur. Décochez "Utiliser l\'analyse IA" pour saisir le devis manuellement.',
          variant: 'destructive',
        });
        setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
      } finally {
        setIsAiParsing(false);
      }
      setStep(nextStep);
      return;
    }
    setStep(nextStep);
  };
  const handlePrev = () => {
    setStep((s) => Math.max(1, s - 1));
  };
  const canGoNextFromStep1 = Boolean(clientInfo.name?.trim() && clientInfo.email?.trim());

  const handleNewQuote = () => {
    lastAppliedQuoteIdRef.current = null;
    hasAppliedChantierIdRef.current = null;
    setShowNewFormFromClick(true);
    setStep(1);
    setHighlightMissing({});
    setSelectedClientId(null);
    setSelectedChantierId(null);
    setEditingQuoteId(null);
    setEditingQuoteStatus(null);
    setClientInfo({ name: '', email: '', phone: '', address: '' });
    setProjectType('');
    setProjectDescription('');
    setQuestionnaireAnswers({});
    setValidityDays('30');
    setTvaRate('20');
    setDiscountType('none');
    setDiscountValue('');
    setGeneralConditions('');
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, unit: '' }]);
    setQuoteLoadState('idle');
    setLocation('/dashboard/quotes/new');
  };

  const handleDuplicateQuote = async (quote: SupabaseQuote) => {
    if (!user) return;
    try {
      const duplicated = await insertQuote(user.id, {
        chantier_id: quote.chantier_id ?? undefined,
        client_name: quote.client_name ?? '',
        client_email: quote.client_email ?? '',
        client_phone: quote.client_phone ?? '',
        client_address: quote.client_address ?? '',
        project_type: quote.project_type ?? '',
        project_description: quote.project_description ?? '',
        total_ht: quote.total_ht,
        total_ttc: quote.total_ttc,
        validity_days: quote.validity_days ?? 30,
        items: quote.items ?? [],
        status: 'brouillon',
      });
      setListQuotes((prev) => [duplicated, ...prev]);
      toast({ title: 'Devis dupliqué', description: 'Le devis a été dupliqué en brouillon.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de dupliquer le devis.', variant: 'destructive' });
    }
  };

  const handleDownloadPdfFromList = async (quote: SupabaseQuote) => {
    try {
      const pdfItems = (quote.items ?? []).map((i) => ({
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
      const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : undefined;
      const quoteNum = getQuoteDisplayNumber(listQuotes, quote.id);
      downloadQuotePdf({
        clientInfo: {
          name: quote.client_name ?? '',
          email: quote.client_email ?? '',
          phone: quote.client_phone ?? '',
          address: quote.client_address ?? '',
        },
        projectType: quote.project_type ?? '',
        projectDescription: quote.project_description ?? '',
        validityDays: String(quote.validity_days ?? 30),
        items: pdfItems,
        subtotal: quote.total_ht,
        tva: quote.total_ttc - quote.total_ht,
        total: quote.total_ttc,
        themeColor: accentColor,
        quoteNumber: quoteNum || undefined,
        companyName: profile?.full_name ?? undefined,
        companyAddress: profile?.company_address ?? undefined,
        companyCityPostal: profile?.company_city_postal ?? undefined,
        companyPhone: profile?.company_phone ?? undefined,
        companyEmail: profile?.company_email ?? undefined,
        companySiret: profile?.company_siret ?? undefined,
        ...(logoDataUrl && { logoDataUrl }),
      });
      toast({ title: 'Devis téléchargé', description: 'Le PDF a été téléchargé.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de télécharger le PDF.', variant: 'destructive' });
    }
  };

  const filteredListQuotes = listSearchQuery.trim()
    ? listQuotes.filter((q) => {
        const qn = getQuoteDisplayNumber(listQuotes, q.id);
        const client = (q.client_name ?? '').toLowerCase();
        const query = listSearchQuery.toLowerCase();
        return qn.toLowerCase().includes(query) || client.includes(query);
      })
    : listQuotes;

  // Fonction helper pour vérifier si le devis peut être sauvegardé
  const canSaveQuote = (): boolean => {
    if (!user?.id || step !== 3) return false;
    
    const missingName = !clientInfo.name?.trim();
    const missingEmail = !clientInfo.email?.trim();
    
    // Calculer les totaux pour vérifier si le devis est valide
    const currentSubtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
    const missingItems = items.length === 0 || currentSubtotal === 0;
    
    return !missingName && !missingEmail && !missingItems;
  };

  // Fonction de sauvegarde manuelle du devis
  const handleSaveQuote = async () => {
    if (!user?.id || step !== 3) return;
    
    const missingName = !clientInfo.name?.trim();
    const missingEmail = !clientInfo.email?.trim();
    const invalidItemIds = items.filter((i) => !i.description?.trim() || getItemTotal(i) === 0).map((i) => i.id);
    const currentSubtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
    const currentDiscountAmt = discountType === 'percent'
      ? currentSubtotal * (parseFloat(discountValue) || 0) / 100
      : discountType === 'fixed'
        ? parseFloat(discountValue) || 0
        : 0;
    const currentSubtotalAfterDiscount = Math.max(0, currentSubtotal - currentDiscountAmt);
    const missingItems = items.length === 0 || currentSubtotal === 0;
    
    if (missingName || missingEmail || missingItems) {
      setHighlightMissing({
        clientName: missingName,
        clientEmail: missingEmail,
        itemsSection: missingItems,
        itemIds: missingItems ? invalidItemIds : undefined,
      });
      if (missingName || missingEmail) setStep(1);
      const parts: string[] = [];
      if (missingName) parts.push('Nom client');
      if (missingEmail) parts.push('Email client');
      if (missingItems) parts.push('Au moins une ligne avec un montant');
      toast({
        title: 'Il manque des informations',
        description: parts.join(', '),
        variant: 'destructive',
      });
      return;
    }

    // Empêcher la sauvegarde d'un devis validé
    if (editingQuoteStatus === 'validé') {
      toast({
        title: 'Devis validé',
        description: 'Ce devis a été validé et ne peut plus être modifié.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const currentTotal = currentSubtotalAfterDiscount * (1 + parsedTvaRate / 100);
      
      // Si c'est un nouveau devis, créer avec le statut "brouillon"
      if (!editingQuoteId) {
        const payload = {
          chantier_id: selectedChantierId ?? null,
          client_name: clientInfo.name,
          client_email: clientInfo.email,
          client_phone: clientInfo.phone,
          client_address: clientInfo.address,
          project_type: projectType,
          project_description: projectDescription,
          total_ht: currentSubtotalAfterDiscount,
          total_ttc: currentTotal,
          validity_days: parseInt(validityDays) || 30,
          items: items,
          // Ne pas définir de statut lors de la sauvegarde
        };
        const newQuote = await insertQuote(user.id, payload);
        setEditingQuoteId(newQuote.id);
        setEditingQuoteStatus(newQuote.status);
        if (selectedChantierId) {
          try {
            await updateChantier(selectedChantierId, { montantDevis: currentTotal });
          } catch (error) {
            console.error('Error updating chantier:', error);
          }
        }
        toast({
          title: 'Devis sauvegardé',
          description: 'Le devis a été enregistré avec succès.',
        });
      } else {
        // Mettre à jour le devis existant - ne pas modifier le statut lors de la sauvegarde
        const payload = {
          chantier_id: selectedChantierId ?? null,
          client_name: clientInfo.name,
          client_email: clientInfo.email,
          client_phone: clientInfo.phone,
          client_address: clientInfo.address,
          project_type: projectType,
          project_description: projectDescription,
          total_ht: currentSubtotalAfterDiscount,
          total_ttc: currentTotal,
          validity_days: parseInt(validityDays) || 30,
          items: items,
          // Ne pas modifier le statut lors de la sauvegarde - conserver le statut actuel
          status: editingQuoteStatus || undefined,
        };
        const updatedQuote = await updateQuote(user.id, editingQuoteId, payload);
        setEditingQuoteStatus(updatedQuote.status);
        if (selectedChantierId) {
          try {
            await updateChantier(selectedChantierId, { montantDevis: currentTotal });
          } catch (error) {
            console.error('Error updating chantier:', error);
          }
        }
        toast({
          title: 'Devis sauvegardé',
          description: 'Le devis a été mis à jour avec succès.',
        });
      }
    } catch (error: unknown) {
      console.error('Error saving quote:', error);
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: 'Erreur lors de la sauvegarde',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const projectTypeLabels: Record<string, string> = {
    piscine: 'Piscine & Spa', paysage: 'Aménagement Paysager', menuiserie: 'Menuiserie Sur-Mesure',
    renovation: 'Rénovation', plomberie: 'Plomberie', maconnerie: 'Maçonnerie', terrasse: 'Terrasse & Patio',
    chauffage: 'Chauffage & Climatisation', isolation: 'Isolation de la charpente', electricite: 'Électricité',
    peinture: 'Peinture & Revêtements', autre: 'Autre',
  };

  const handleCreateChantierFromQuote = async () => {
    if (!user?.id || !editingQuoteId) return;
    const clientName = clientInfo.name?.trim();
    const clientEmail = clientInfo.email?.trim();
    if (!clientName || !clientEmail) {
      toast({
        title: 'Client requis',
        description: 'Renseignez le nom et l\'email du client avant de créer le projet.',
        variant: 'destructive',
      });
      return;
    }
    setIsCreatingChantier(true);
    try {
      let clientId: string;
      let resolvedClientName: string;
      if (selectedClientId) {
        const c = clients.find((x) => x.id === selectedClientId);
        if (c) {
          clientId = c.id;
          resolvedClientName = c.name;
        } else {
          const existing = clients.find((x) => (x.email ?? '').toLowerCase() === clientEmail.toLowerCase());
          if (existing) {
            clientId = existing.id;
            resolvedClientName = existing.name;
          } else {
            const created = await addClient({ name: clientName, email: clientEmail, phone: clientInfo.phone ?? '' });
            clientId = created.id;
            resolvedClientName = created.name;
          }
        }
      } else {
        const existing = clients.find((x) => (x.email ?? '').toLowerCase() === clientEmail.toLowerCase());
        if (existing) {
          clientId = existing.id;
          resolvedClientName = existing.name;
        } else {
          const created = await addClient({ name: clientName, email: clientEmail, phone: clientInfo.phone ?? '' });
          clientId = created.id;
          resolvedClientName = created.name;
        }
      }
      const totalTtc = items.reduce((sum, item) => sum + getItemTotal(item), 0) * 1.2;
      const typeLabel = (projectTypeLabels[projectType] ?? projectType) || 'Autre';
      const chantierPayload = {
        nom: `${typeLabel} - ${resolvedClientName}`,
        clientId,
        clientName: resolvedClientName,
        dateDebut: new Date().toISOString().slice(0, 10),
        duree: 'À définir',
        images: [] as string[],
        statut: 'planifié' as const,
        typeChantier: projectType || 'autre',
        montantDevis: Math.round(totalTtc * 100) / 100,
        notes: projectDescription?.trim() ? projectDescription.trim().split('\n')[0] : null,
      };
      const createdChantier = await addChantier(chantierPayload);
      refreshChantiers();
      const currentSubtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
      const currentDiscAmt = discountType === 'percent'
        ? currentSubtotal * (parseFloat(discountValue) || 0) / 100
        : discountType === 'fixed' ? parseFloat(discountValue) || 0 : 0;
      const currentSubAfterDisc = Math.max(0, currentSubtotal - currentDiscAmt);
      const currentTotal = currentSubAfterDisc * (1 + parsedTvaRate / 100);
      const quotePayload = {
        chantier_id: createdChantier.id,
        client_name: clientInfo.name,
        client_email: clientInfo.email,
        client_phone: clientInfo.phone,
        client_address: clientInfo.address,
        project_type: projectType,
        project_description: projectDescription,
        total_ht: currentSubAfterDisc,
        total_ttc: currentTotal,
        validity_days: parseInt(validityDays) || 30,
        items,
        status: editingQuoteStatus ?? undefined,
      };
      await updateQuote(user.id, editingQuoteId, quotePayload);
      setSelectedChantierId(createdChantier.id);
      setSelectedClientId(clientId);
      toast({
        title: 'Chantier créé',
        description: 'Le projet a été créé et le devis lui est désormais associé. Vous pouvez ouvrir la fiche projet.',
      });
    } catch (err) {
      console.error('Error creating chantier from quote:', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingChantier(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!user) {
      alert('Vous devez être connecté pour télécharger un devis');
      return;
    }

    const missingName = !clientInfo.name?.trim();
    const missingEmail = !clientInfo.email?.trim();
    const invalidItemIds = items.filter((i) => !i.description?.trim() || getItemTotal(i) === 0).map((i) => i.id);
    const missingItems = items.length === 0 || subtotal === 0;
    if (missingName || missingEmail || missingItems) {
      setHighlightMissing({
        clientName: missingName,
        clientEmail: missingEmail,
        itemsSection: missingItems,
        itemIds: missingItems ? invalidItemIds : undefined,
      });
      if (missingName || missingEmail) setStep(1);
      const parts: string[] = [];
      if (missingName) parts.push('Nom client');
      if (missingEmail) parts.push('Email client');
      if (missingItems) parts.push('Au moins une ligne avec un montant');
      toast({
        title: 'Il manque des informations',
        description: parts.join(', '),
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    // Empêcher la sauvegarde d'un devis validé lors du téléchargement
    // Si le devis est validé et existe déjà, permettre le téléchargement du PDF sans sauvegarder
    if (editingQuoteStatus === 'validé' && editingQuoteId) {
      // Permettre le téléchargement du PDF même si le devis est validé (pas de sauvegarde)
      setIsGenerating(true);
      try {
        const pdfItems = items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: getItemTotal(i),
          unit: i.unit ?? undefined,
          subItems: i.subItems?.map((s) => ({
            description: s.description,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            total: s.total,
            unit: s.unit ?? undefined,
          })),
        }));
        let quoteNum: string | undefined;
        const allQuotes = await fetchQuotesForUser(user.id);
        quoteNum = getQuoteDisplayNumber(allQuotes, editingQuoteId);
        const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : undefined;
        downloadQuotePdf({
          clientInfo: {
            name: clientInfo.name,
            email: clientInfo.email,
            phone: clientInfo.phone,
            address: clientInfo.address,
          },
          projectType,
          projectDescription,
          validityDays: String(parseInt(validityDays) || 30),
          items: pdfItems,
          subtotal,
          tva: total - subtotal,
          total,
          quoteNumber: quoteNum,
          themeColor: accentColor,
          companyName: profile?.full_name ?? undefined,
          companyAddress: profile?.company_address ?? undefined,
          companyCityPostal: profile?.company_city_postal ?? undefined,
          companyPhone: profile?.company_phone ?? undefined,
          companyEmail: profile?.company_email ?? undefined,
          companySiret: profile?.company_siret ?? undefined,
          ...(logoDataUrl && { logoDataUrl }),
        });
        setIsGenerating(false);
        return;
      } catch (error) {
        console.error('Error downloading PDF:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de télécharger le PDF.',
          variant: 'destructive',
        });
        setIsGenerating(false);
        return;
      }
    }
    
    // Sauvegarder d'abord si nécessaire (pour les nouveaux devis ou si pas encore sauvegardé)
    let quoteIdToUse = editingQuoteId;
    try {
      if (!editingQuoteId) {
        // Créer le devis s'il n'existe pas encore - ne pas définir de statut
        const payload = {
          chantier_id: selectedChantierId ?? null,
          client_name: clientInfo.name,
          client_email: clientInfo.email,
          client_phone: clientInfo.phone,
          client_address: clientInfo.address,
          project_type: projectType,
          project_description: projectDescription,
          total_ht: subtotalAfterDiscount,
          total_ttc: total,
          validity_days: parseInt(validityDays) || 30,
          items: items,
          // Ne pas définir de statut lors du téléchargement du PDF
        };
        const newQuote = await insertQuote(user.id, payload);
        quoteIdToUse = newQuote.id;
        setEditingQuoteId(newQuote.id);
        setEditingQuoteStatus(newQuote.status);
        if (selectedChantierId) {
          try {
            await updateChantier(selectedChantierId, { montantDevis: total });
          } catch {
            // ignore
          }
        }
      } else {
        // Mettre à jour le devis existant - ne pas modifier le statut lors du téléchargement du PDF
        const payload = {
          chantier_id: selectedChantierId ?? null,
          client_name: clientInfo.name,
          client_email: clientInfo.email,
          client_phone: clientInfo.phone,
          client_address: clientInfo.address,
          project_type: projectType,
          project_description: projectDescription,
          total_ht: subtotalAfterDiscount,
          total_ttc: total,
          validity_days: parseInt(validityDays) || 30,
          items: items,
          // Ne pas modifier le statut lors du téléchargement du PDF - conserver le statut actuel
          status: editingQuoteStatus || undefined,
        };
        const updatedQuote = await updateQuote(user.id, editingQuoteId, payload);
        setEditingQuoteStatus(updatedQuote.status);
        if (selectedChantierId) {
          try {
            await updateChantier(selectedChantierId, { montantDevis: total });
          } catch {
            // ignore
          }
        }
      }
      
      // Télécharger le PDF
      try {
        const pdfItems = items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: getItemTotal(i),
          unit: i.unit ?? undefined,
          subItems: i.subItems?.map((s) => ({
            description: s.description,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            total: s.total,
            unit: s.unit ?? undefined,
          })),
        }));
        const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : null;
        let quoteNum: string | undefined;
        if (quoteIdToUse && user?.id) {
          const allQuotes = await fetchQuotesForUser(user.id);
          quoteNum = getQuoteDisplayNumber(allQuotes, quoteIdToUse);
        }
        downloadQuotePdf({
          clientInfo,
          projectType,
          projectDescription,
          validityDays,
          items: pdfItems,
          subtotal,
          tva,
          total,
          themeColor: accentColor,
          quoteNumber: quoteNum,
          companyName: profile?.full_name ?? undefined,
          companyAddress: profile?.company_address ?? undefined,
          companyCityPostal: profile?.company_city_postal ?? undefined,
          companyPhone: profile?.company_phone ?? undefined,
          companyEmail: profile?.company_email ?? undefined,
          companySiret: profile?.company_siret ?? undefined,
          ...(logoDataUrl && { logoDataUrl }),
        });
        toast({ title: 'Devis téléchargé', description: 'Le PDF a été téléchargé avec succès.' });
      } catch (pdfError: unknown) {
        console.error('PDF download failed:', pdfError);
        toast({ 
          title: 'Erreur de téléchargement', 
          description: 'Le devis a été sauvegardé mais le téléchargement du PDF a échoué.', 
          variant: 'destructive' 
        });
      }
    } catch (error: unknown) {
      console.error('Error saving quote:', error);
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: 'Erreur lors de la sauvegarde',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteQuoteFromList = async (quoteId: string) => {
    if (!user) return;
    try {
      await deleteQuote(user.id, quoteId);
      setListQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      toast({ title: 'Devis supprimé' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de supprimer le devis.', variant: 'destructive' });
    }
  };

  const handleChangeStatusFromList = async (quoteId: string, status: SupabaseQuote["status"]) => {
    if (!user) return;
    try {
      const updated = await updateQuoteStatus(quoteId, user.id, status);
      setListQuotes((prev) => prev.map((q) => (q.id === quoteId ? updated : q)));
      toast({ title: `Statut mis à jour : ${status}` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible de changer le statut.', variant: 'destructive' });
    }
  };

  const handleEditQuoteFromList = (quoteId: string) => {
    setForceListView(false);
    setQuoteIdToOpenFromList(quoteId);
    const url = `/dashboard/quotes?quoteId=${quoteId}`;
    if (typeof window !== 'undefined') window.history.pushState({}, '', url);
    setLocation(url);
  };

  return (
    <PageWrapper>
      {!showForm ? (
        <QuoteList
          quotes={listQuotes}
          loading={listLoading}
          statusFilter={listStatusFilter}
          searchQuery={listSearchQuery}
          chantiers={chantiers}
          onStatusFilterChange={setListStatusFilter}
          onSearchQueryChange={setListSearchQuery}
          filteredQuotes={filteredListQuotes}
          getQuoteDisplayNumber={getQuoteDisplayNumber}
          onNewQuote={() => {
            setForceListView(false);
            setLocation('/dashboard/quotes/new');
          }}
          onEditQuote={handleEditQuoteFromList}
          onDownloadPdf={handleDownloadPdfFromList}
          onDuplicateQuote={handleDuplicateQuote}
          onDeleteQuote={handleDeleteQuoteFromList}
          onChangeStatus={handleChangeStatusFromList}
          onGoToProjects={() => setLocation('/dashboard/projects')}
        />
      ) : (
        <>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              {editingQuoteId ? `Devis ${getQuoteDisplayNumber(listQuotes, editingQuoteId) || ''}` : 'Nouveau Devis'}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Étape {step}/3 – {step === 1 ? 'Informations client' : step === 2 ? 'Détails du projet' : 'Détail du devis'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl bg-white/20 text-white border-white/40 hover:bg-white/30 hover:border-white/50 max-md:min-h-[44px]"
              onClick={() => {
                setForceListView(true);
                keepFormVisibleRef.current = false;
                setShowNewFormFromClick(false);
                setQuoteIdToOpenFromList(null);
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, '', '/dashboard/quotes');
                }
                setLocation('/dashboard/quotes');
              }}
              title="Voir tous les devis"
            >
              <List className="h-4 w-4 mr-2" />
              Voir tous les devis
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white max-md:min-h-[44px]"
              onClick={handleNewQuote}
              data-testid="button-new-quote-form"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau devis
            </Button>
            {step === 3 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className={`rounded-xl border-white/40 hover:bg-white/30 hover:border-white/50 ${splitPreview ? 'bg-white/40 text-white' : 'bg-white/20 text-white'}`}
                  onClick={() => setSplitPreview((p) => !p)}
                >
                  <Columns2 className="h-4 w-4 mr-2" />
                  Split
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white/20 text-white border-white/40 hover:bg-white/30 hover:border-white/50"
                  data-testid="button-preview"
                  onClick={() => setPreviewOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Aperçu
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleDownloadPdf} 
                  disabled={isGenerating || !user}
                  className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl disabled:opacity-50" 
                  data-testid="button-generate"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Téléchargement...' : 'Télécharger le devis en PDF'}
                </Button>
              </>
            )}
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Aperçu du Devis
            </DialogTitle>
          </DialogHeader>
          <QuotePreview
            quote={{
              client_name: clientInfo.name || null,
              client_email: clientInfo.email || null,
              client_phone: clientInfo.phone || null,
              client_address: clientInfo.address || null,
              project_type: projectType || null,
              project_description: projectDescription || null,
              validity_days: parseInt(validityDays, 10) || 30,
              items,
              total_ht: subtotalAfterDiscount,
              total_ttc: total,
            }}
            accentColor={accentColor}
            logoUrl={logoUrl}
          />
          {(editingQuoteStatus === 'accepté' || editingQuoteStatus === 'validé') && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setPreviewOpen(false);
                  setIsInvoiceDialogOpen(true);
                }}
                className="w-full bg-violet-500 hover:bg-violet-600 text-white"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Créer une facture depuis ce devis
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        quoteId={editingQuoteStatus === 'accepté' || editingQuoteStatus === 'validé' ? editingQuoteId : null}
        chantierId={selectedChantierId}
        clientId={selectedClientId}
        onSaved={() => {
          toast({
            title: 'Succès',
            description: 'Facture créée avec succès',
          });
        }}
      />

      <Dialog open={selectClientOpen} onOpenChange={(open) => {
        setSelectClientOpen(open);
        if (!open) setClientSearchQuery('');
      }}>
        <DialogContent className="max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Choisir un client
            </DialogTitle>
          </DialogHeader>
          {clients.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un client (nom, email, téléphone)..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            {clients.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 py-4">
                Aucun client enregistré. Ajoutez des clients depuis la page Clients.
              </p>
            ) : (() => {
              const q = clientSearchQuery.trim().toLowerCase();
              const filtered = q
                ? clients.filter(
                    (c) =>
                      c.name?.toLowerCase().includes(q) ||
                      c.email?.toLowerCase().includes(q) ||
                      (c.phone ?? '').includes(q)
                  )
                : clients;
              return filtered.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 py-4">
                  Aucun client trouvé pour &quot;{clientSearchQuery}&quot;.
                </p>
              ) : (
              <ul className="space-y-2">
                {filtered.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        setClientInfo(prev => ({
                          ...prev,
                          name: client.name,
                          email: client.email,
                          phone: client.phone,
                        }));
                        setSelectClientOpen(false);
                        const currentChantier = selectedChantierId ? chantiers.find(c => c.id === selectedChantierId) : null;
                        if (currentChantier && currentChantier.clientId !== client.id) {
                          setSelectedChantierId(null);
                          setProjectDescription('');
                        }
                      }}
                      className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex flex-col gap-1"
                      data-testid={`select-client-${client.id}`}
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{client.name}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {client.email}
                      </span>
                      {client.phone && (
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {client.phone}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {(() => {
        const chantiersForClient = selectedClientId
          ? chantiers.filter((c) => c.clientId === selectedClientId)
          : [];
        return (
          <Dialog open={selectChantierOpen} onOpenChange={setSelectChantierOpen}>
            <DialogContent className="max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Choisir un chantier
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] pr-2">
                {chantiersForClient.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 py-4">
                    {selectedClientId
                      ? 'Aucun projet pour ce client. Créez des projets depuis la page Projets.'
                      : 'Sélectionnez d\'abord un client à l\'étape 1.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {chantiersForClient.map((chantier) => {
                      const isSelected = selectedChantierId === chantier.id;
                      return (
                        <li key={chantier.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const validTypes = ['piscine', 'paysage', 'menuiserie', 'renovation', 'plomberie', 'maconnerie', 'terrasse', 'chauffage', 'isolation', 'electricite', 'peinture', 'autre'];
                              const valueToSet = (chantier.typeChantier && validTypes.includes(chantier.typeChantier)) ? chantier.typeChantier : 'autre';
                              const desc = chantier.notes
                                ? `${chantier.nom}\n${chantier.notes}`
                                : chantier.nom;
                              setSelectedChantierId(chantier.id);
                              setProjectDescription(desc);
                              setProjectType(valueToSet);
                              setSelectChantierOpen(false);
                            }}
                            className={`w-full text-left p-4 rounded-xl border transition-colors flex flex-col gap-1 ${
                              isSelected
                                ? 'border-violet-500 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            data-testid={`select-chantier-${chantier.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 dark:text-white">{chantier.nom}</span>
                              {isSelected && (
                                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Sélectionné</span>
                              )}
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              Début : {chantier.dateDebut}
                            </span>
                            {chantier.notes && (
                              <span className="text-sm text-gray-500 dark:text-gray-500 line-clamp-2">{chantier.notes}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-hidden">
        <main className="space-y-6 py-4 sm:py-6">
          {quoteLoadState === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-24 text-white/80">
              <p className="text-lg font-medium">Chargement du devis...</p>
              <p className="text-sm text-white/60 mt-2">Préparation du formulaire</p>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Card
                  ref={clientCardRef}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl"
                >
                  <CardHeader className="space-y-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white font-light">
                        <User className="h-5 w-5 text-violet-500" />
                        Informations Client
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 shrink-0"
                        onClick={() => setSelectClientOpen(true)}
                        data-testid="button-select-client"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Sélectionner un client
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="client-name" className="text-gray-700 dark:text-gray-300">Nom complet</Label>
                      <Input
                        id="client-name"
                        data-testid="input-client-name"
                        value={clientInfo.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const selClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
                          setClientInfo(prev => ({ ...prev, name: newName }));
                          setHighlightMissing(prev => ({ ...prev, clientName: false }));
                          if (selectedClientId && selClient && newName.trim() !== selClient.name) setSelectedClientId(null);
                        }}
                        placeholder="Nom du client"
                        className={`cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${highlightMissing.clientName ? 'border-amber-400 dark:border-amber-500/80 bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-email" className="text-gray-700 dark:text-gray-300">Email</Label>
                      <Input
                        id="client-email"
                        type="email"
                        data-testid="input-client-email"
                        value={clientInfo.email}
                        onChange={(e) => {
                          const newEmail = e.target.value;
                          setClientInfo(prev => ({ ...prev, email: newEmail }));
                          setHighlightMissing(prev => ({ ...prev, clientEmail: false }));
                          const selClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
                          if (selectedClientId && selClient && newEmail.trim() !== (selClient.email ?? '')) setSelectedClientId(null);
                        }}
                        placeholder="email@exemple.com"
                        className={`cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${highlightMissing.clientEmail ? 'border-amber-400 dark:border-amber-500/80 bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-phone" className="text-gray-700 dark:text-gray-300">Téléphone</Label>
                      <Input
                        id="client-phone"
                        data-testid="input-client-phone"
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="06 12 34 56 78"
                        className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-address" className="text-gray-700 dark:text-gray-300">Adresse</Label>
                      <Input
                        id="client-address"
                        data-testid="input-client-address"
                        value={clientInfo.address}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Adresse complète"
                        className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={!canGoNextFromStep1}
                    className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50"
                    data-testid="button-next-step1"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl">
                  <CardHeader className="space-y-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white font-light">
                        <Building className="h-5 w-5 text-violet-500" />
                        Détails du Projet
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 shrink-0 disabled:opacity-50"
                        onClick={() => setSelectChantierOpen(true)}
                        disabled={!selectedClientId}
                        title={!selectedClientId ? 'Sélectionnez d\'abord un client à l\'étape 1' : undefined}
                        data-testid="button-select-chantier"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Sélectionner un chantier
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Affichage du client et du chantier / type (sélection ou formulaire) */}
                    {(selectedClientId || selectedChantierId || clientInfo.name?.trim() || projectType) && (
                      <div className="flex flex-wrap gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        {(() => {
                          const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
                          const displayClientName = selectedClient ? selectedClient.name : (clientInfo.name?.trim() || null);
                          return displayClientName ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-violet-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Client :</span> {displayClientName}
                              </span>
                            </div>
                          ) : null;
                        })()}
                        {(() => {
                          const selectedChantier = selectedChantierId ? chantiers.find(c => c.id === selectedChantierId) : null;
                          const chantierBelongsToClient = selectedChantier && selectedClientId && selectedChantier.clientId === selectedClientId;
                          const projectTypeLabels: Record<string, string> = { piscine: 'Piscine & Spa', paysage: 'Aménagement Paysager', menuiserie: 'Menuiserie Sur-Mesure', renovation: 'Rénovation', plomberie: 'Plomberie', maconnerie: 'Maçonnerie', terrasse: 'Terrasse & Patio', chauffage: 'Chauffage & Climatisation', isolation: 'Isolation de la charpente', electricite: 'Électricité', peinture: 'Peinture & Revêtements', autre: 'Autre' };
                          const displayChantierOrType = chantierBelongsToClient ? selectedChantier!.nom : (projectType ? projectTypeLabels[projectType] ?? projectType : null);
                          return displayChantierOrType ? (
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-violet-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">{selectedChantierId ? 'Chantier :' : 'Type :'}</span> {displayChantierOrType}
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-type" className="text-gray-700 dark:text-gray-300">Type de projet</Label>
                        <Select value={projectType} onValueChange={(newValue) => {
                          const selChantier = selectedChantierId ? chantiers.find(c => c.id === selectedChantierId) : null;
                          setProjectType(newValue);
                          if (selectedChantierId && selChantier) {
                            const validTypes = ['piscine', 'paysage', 'menuiserie', 'renovation', 'plomberie', 'maconnerie', 'terrasse', 'chauffage', 'isolation', 'electricite', 'peinture', 'autre'];
                            const chantierType = selChantier.typeChantier && validTypes.includes(selChantier.typeChantier) ? selChantier.typeChantier : 'autre';
                            if (chantierType !== newValue) {
                              setSelectedChantierId(null);
                              setProjectDescription('');
                            }
                          }
                        }}>
                          <SelectTrigger data-testid="select-project-type" className="rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                            <SelectValue placeholder="Sélectionner le type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="piscine">Piscine & Spa</SelectItem>
                            <SelectItem value="paysage">Aménagement Paysager</SelectItem>
                            <SelectItem value="menuiserie">Menuiserie Sur-Mesure</SelectItem>
                            <SelectItem value="renovation">Rénovation</SelectItem>
                            <SelectItem value="plomberie">Plomberie</SelectItem>
                            <SelectItem value="maconnerie">Maçonnerie</SelectItem>
                            <SelectItem value="terrasse">Terrasse & Patio</SelectItem>
                            <SelectItem value="chauffage">Chauffage & Climatisation</SelectItem>
                            <SelectItem value="isolation">Isolation de la charpente</SelectItem>
                            <SelectItem value="electricite">Électricité</SelectItem>
                            <SelectItem value="peinture">Peinture & Revêtements</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validity" className="text-gray-700 dark:text-gray-300">Validité du devis (jours)</Label>
                        <Input
                          id="validity"
                          type="number"
                          data-testid="input-validity"
                          value={validityDays}
                          onChange={(e) => setValidityDays(e.target.value)}
                          placeholder="30"
                          className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="project-description" className="text-gray-700 dark:text-gray-300">Description du projet</Label>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none rounded focus-visible:ring-2 focus-visible:ring-violet-500" aria-label="Conseils pour une bonne description du projet">
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8} className="max-w-[300px] p-3 text-left space-y-2 z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 shadow-lg">
                              <p className="font-medium">Comment bien décrire le projet pour que l’IA génère un bon devis</p>
                              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                                <li>Indiquez les <strong>pièces</strong> concernées (ex. cuisine, salle de bain, façade).</li>
                                <li>Donnez les <strong>surfaces</strong> en m² ou les <strong>longueurs</strong> en m quand vous les connaissez (ex. 25 m², 12 ml).</li>
                                <li>Précisez les <strong>travaux</strong> à faire (ex. peinture, carrelage, ouverture de porte, ravalement).</li>
                                <li>Mentionnez les <strong>matériaux</strong> souhaités si c’est important (ex. carrelage 30×30, fenêtre bois).</li>
                                <li>Vous pouvez indiquer un <strong>prix total souhaité</strong> ou une fourchette (ex. « budget 15 000 € HT ») pour aider au chiffrage.</li>
                                <li>Ajoutez les <strong>détails utiles</strong> : étage, accès difficile, humidité, état du support — l’IA en tient compte pour les lignes.</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex gap-2">
                        <Textarea
                          id="project-description"
                          data-testid="textarea-project-description"
                          value={projectDescription}
                          onChange={(e) => setProjectDescription(e.target.value)}
                          placeholder="Décrivez en détail le projet à réaliser..."
                          rows={3}
                          className="flex-1 cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                        />
                        <VoiceInputButton
                          onTranscript={(text) => {
                            setProjectDescription((prev) => {
                              const trimmed = prev.trim();
                              return trimmed ? `${trimmed} ${text}` : text;
                            });
                          }}
                          className="self-start mt-1"
                        />
                      </div>

                      {projectType && hasQuestionsForType(projectType) && (
                        <QuotesQuestionnaire
                          projectType={projectType}
                          answers={questionnaireAnswers}
                          onChange={(id, value) => setQuestionnaireAnswers((prev) => ({ ...prev, [id]: value }))}
                        />
                      )}

                      <div className="flex items-start gap-3 pt-2">
                        <Checkbox
                          id="use-ai-prefill"
                          checked={useAiForPrefill}
                          onCheckedChange={(v) => setUseAiForPrefill(v === true)}
                          className="mt-0.5"
                          data-testid="checkbox-use-ai-prefill"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="use-ai-prefill" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            Utiliser l'analyse IA pour préremplir le devis à partir de la description
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {useAiForPrefill
                              ? "Remplissez la « Description du projet » ci‑dessus puis cliquez sur Suivant pour que l'IA préremplisse le devis."
                              : "Si la coche est décochée, le devis ne sera pas prérempli : vous pourrez saisir les lignes manuellement à l'étape 3."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-between items-center">
                  <div className="min-h-8 flex items-center">
                    {isAiParsing && <DevisGeneratingLoader />}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrev}
                      className="rounded-xl"
                      data-testid="button-prev-step2"
                      disabled={isAiParsing}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Précédent
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white"
                      data-testid="button-next-step2"
                      disabled={isAiParsing}
                    >
                      Suivant
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={splitPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "space-y-4"}
              >
              <div className="space-y-4">
                <Card ref={itemsCardRef} className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl ${highlightMissing.itemsSection ? 'border-amber-400/80 dark:border-amber-500/60' : ''}`}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white font-light">
                      <Calculator className="h-5 w-5 text-violet-500" />
                      Détail du Devis
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={addItem} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl" data-testid="button-add-item">
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter ligne
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {items.map((item, index) => {
                      const hasSubItems = Boolean(item.subItems?.length);
                      return (
                        <div key={item.id} className="space-y-3">
                          <div
                            data-item-id={item.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (e.dataTransfer.types.includes('application/x-quote-item-id')) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                                setDragOverItemId(item.id);
                                setDragOverPosition(position);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverItemId(null);
                                setDragOverPosition(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedId = e.dataTransfer.getData('application/x-quote-item-id');
                              const targetId = item.id;
                              const position = dragOverPosition || 'after';
                              setDraggedItemId(null);
                              setDragOverItemId(null);
                              setDragOverPosition(null);
                              if (draggedId && targetId && draggedId !== targetId) reorderItems(draggedId, targetId, position);
                            }}
                            onDragEnd={() => {
                              setDraggedItemId(null);
                              setDragOverItemId(null);
                              setDragOverPosition(null);
                            }}
                            className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl transition-all ${highlightMissing.itemIds?.includes(item.id) ? 'border-amber-400/80 dark:border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/15' : ''} ${draggedItemId === item.id ? 'opacity-50 scale-[0.98]' : ''} ${dragOverItemId === item.id ? (dragOverPosition === 'before' ? 'border-t-4 border-t-violet-500 bg-violet-50/50 dark:bg-violet-950/30' : 'border-b-4 border-b-violet-500 bg-violet-50/50 dark:bg-violet-950/30') : ''}`}
                          >
                            <div className="md:col-span-1 flex flex-col items-center justify-center gap-0.5">
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/x-quote-item-id', item.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedItemId(item.id);
                                  const label = item.description || 'Ligne';
                                  const total = getItemTotal(item).toFixed(2);
                                  const dragEl = document.createElement('div');
                                  dragEl.setAttribute('data-drag-preview', '');
                                  dragEl.style.cssText = 'position:absolute;top:-9999px;left:0;padding:8px 12px;background:rgb(139 92 246);color:white;border-radius:8px;font-size:13px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;';
                                  dragEl.textContent = `${label} — ${total} €`;
                                  document.body.appendChild(dragEl);
                                  e.dataTransfer.setDragImage(dragEl, 0, 0);
                                  requestAnimationFrame(() => dragEl.remove());
                                }}
                                className="cursor-move p-1.5 rounded bg-gray-200/80 dark:bg-gray-700/80 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 touch-none"
                                title="Glisser pour réordonner (les sous-lignes suivent)"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>
                              {items.length > 1 && (
                                <div className="flex flex-col gap-0">
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-violet-600" onClick={() => moveItemUp(item.id)} disabled={index === 0} title="Monter">
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-violet-600" onClick={() => moveItemDown(item.id)} disabled={index === items.length - 1} title="Descendre">
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="md:col-span-3 space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Description</Label>
                              <div className="flex gap-1">
                                <Input
                                  data-testid={`input-item-description-${index}`}
                                  value={item.description}
                                  onChange={(e) => {
                                    updateItem(item.id, 'description', e.target.value);
                                    setHighlightMissing(prev => ({ ...prev, itemsSection: false, itemIds: undefined }));
                                  }}
                                  placeholder="Saisir ou choisir un tarif ci‑droite"
                                  className="flex-1 cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-r-none"
                                />
                                <Popover open={openTariffPopoverId === item.id} onOpenChange={(open) => {
                                  setOpenTariffPopoverId(open ? item.id : null);
                                  if (!open) { setTariffSearchQuery(''); setTariffCategoryFilter('all'); }
                                }}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="rounded-xl rounded-l-none border-l-0 px-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                      title="Choisir parmi mes tarifs enregistrés"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-96 p-0">
                                    {userTariffs.length === 0 ? (
                                      <p className="p-3 text-sm text-gray-500 dark:text-gray-400">Aucun tarif enregistré. Ajoutez-en dans la page Tarifs.</p>
                                    ) : (
                                      <div>
                                        <div className="p-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
                                          <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                            <Input
                                              placeholder="Rechercher un tarif..."
                                              value={tariffSearchQuery}
                                              onChange={(e) => setTariffSearchQuery(e.target.value)}
                                              className="pl-8 h-8 text-sm rounded-lg"
                                            />
                                          </div>
                                          <div className="flex gap-1 flex-wrap">
                                            {['all', 'matériau', 'service', "main-d'œuvre", 'location', 'sous-traitance', 'transport', 'équipement', 'fourniture', 'autre'].map((cat) => (
                                              <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setTariffCategoryFilter(cat)}
                                                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${tariffCategoryFilter === cat ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                              >
                                                {cat === 'all' ? 'Tous' : cat}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        <ul className="max-h-[220px] overflow-y-auto py-1">
                                          {(() => {
                                            const q = tariffSearchQuery.trim().toLowerCase();
                                            const filtered = userTariffs.filter((t) => {
                                              if (tariffCategoryFilter !== 'all' && t.category !== tariffCategoryFilter) return false;
                                              if (q && !t.label.toLowerCase().includes(q)) return false;
                                              return true;
                                            });
                                            return filtered.length === 0 ? (
                                              <li className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">Aucun tarif trouvé</li>
                                            ) : (
                                              filtered.map((t) => (
                                                <li key={t.id}>
                                                  <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between items-center gap-2"
                                                    onClick={() => {
                                                      applyTariffToItem(item.id, t);
                                                      setOpenTariffPopoverId(null);
                                                      setTariffSearchQuery('');
                                                      setTariffCategoryFilter('all');
                                                    }}
                                                  >
                                                    <span className="truncate">{t.label}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 shrink-0">{Number(t.price_ht).toFixed(2)} € / {t.unit}</span>
                                                  </button>
                                                </li>
                                              ))
                                            );
                                          })()}
                                        </ul>
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <div className="md:col-span-1 space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Unité</Label>
                              <Select
                                value={item.unit?.trim() ? item.unit : QUOTE_UNIT_NONE}
                                onValueChange={(v) => updateItem(item.id, 'unit', v === QUOTE_UNIT_NONE ? '' : v)}
                              >
                                <SelectTrigger className="rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {QUOTE_UNIT_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {!hasSubItems && (
                              <>
                                <div className="md:col-span-2 space-y-2">
                                  <Label className="text-gray-700 dark:text-gray-300">Quantité</Label>
                                  <Input
                                    type="number"
                                    data-testid={`input-item-quantity-${index}`}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="0.1"
                                    className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                  <Label className="text-gray-700 dark:text-gray-300">Prix unitaire HT</Label>
                                  <Input
                                    type="number"
                                    data-testid={`input-item-price-${index}`}
                                    value={item.unitPrice}
                                    onChange={(e) => {
                                    updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0);
                                    setHighlightMissing(prev => ({ ...prev, itemsSection: false, itemIds: undefined }));
                                  }}
                                    min="0"
                                    step="0.01"
                                    className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                  />
                                </div>
                              </>
                            )}
                            {hasSubItems && (
                              <div className="md:col-span-4 space-y-2 flex items-end">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Total HT = somme des sous-lignes</span>
                              </div>
                            )}
                            <div className="md:col-span-2 space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Total HT</Label>
                              <div className="cursor-default h-10 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center text-sm font-medium text-gray-900 dark:text-white">
                                {getItemTotal(item).toFixed(2)} €
                              </div>
                            </div>
                            <div className="md:col-span-1 flex items-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addSubItem(item.id)}
                                className="rounded-xl"
                                title="Ajouter sous-ligne"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              {items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                  className="rounded-xl"
                                  data-testid={`button-remove-item-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {item.subItems?.map((sub, subIndex) => (
                            <div key={sub.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 pl-6 md:pl-8 bg-gray-100/50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl border-l-4 border-l-violet-300 dark:border-l-violet-600">
                              <div className="md:col-span-4 space-y-2">
                                <Label className="text-gray-600 dark:text-gray-400 text-xs">Sous-ligne – Description</Label>
                                <Input
                                  value={sub.description}
                                  onChange={(e) => {
                                  updateSubItem(item.id, sub.id, 'description', e.target.value);
                                  setHighlightMissing(prev => ({ ...prev, itemsSection: false, itemIds: undefined }));
                                }}
                                  placeholder="Description"
                                  className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                />
                              </div>
                              <div className="md:col-span-1 space-y-2">
                                <Label className="text-gray-600 dark:text-gray-400 text-xs">Unité</Label>
                                <Select
                                  value={sub.unit?.trim() ? sub.unit : QUOTE_UNIT_NONE}
                                  onValueChange={(v) => updateSubItem(item.id, sub.id, 'unit', v === QUOTE_UNIT_NONE ? '' : v)}
                                >
                                  <SelectTrigger className="rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm h-9">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {QUOTE_UNIT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                <Label className="text-gray-600 dark:text-gray-400 text-xs">Qté</Label>
                                <Input
                                  type="number"
                                  value={sub.quantity}
                                  onChange={(e) => {
                                  updateSubItem(item.id, sub.id, 'quantity', parseFloat(e.target.value) || 0);
                                  setHighlightMissing(prev => ({ ...prev, itemsSection: false, itemIds: undefined }));
                                }}
                                  min="0"
                                  step="0.1"
                                  className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                <Label className="text-gray-600 dark:text-gray-400 text-xs">Prix unit. HT</Label>
                                <Input
                                  type="number"
                                  value={sub.unitPrice}
                                  onChange={(e) => {
                                  updateSubItem(item.id, sub.id, 'unitPrice', parseFloat(e.target.value) || 0);
                                  setHighlightMissing(prev => ({ ...prev, itemsSection: false, itemIds: undefined }));
                                }}
                                  min="0"
                                  step="0.01"
                                  className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                <Label className="text-gray-600 dark:text-gray-400 text-xs">Total HT</Label>
                                <div className="cursor-default h-9 px-3 py-2 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center text-sm text-gray-900 dark:text-white">
                                  {sub.total.toFixed(2)} €
                                </div>
                              </div>
                              <div className="md:col-span-1 flex items-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSubItem(item.id, sub.id)}
                                  className="rounded-xl text-red-500"
                                  title="Supprimer sous-ligne"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-start pl-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addSubItem(item.id)}
                              className="rounded-xl text-violet-600 dark:text-violet-400"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter sous-ligne
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Taux de TVA (%)</Label>
                          <Select value={tvaRate} onValueChange={setTvaRate}>
                            <SelectTrigger className="rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0% (Exonéré)</SelectItem>
                              <SelectItem value="5.5">5,5% (Rénovation énergétique)</SelectItem>
                              <SelectItem value="10">10% (Travaux de rénovation)</SelectItem>
                              <SelectItem value="20">20% (Taux normal)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Remise</Label>
                          <div className="flex gap-2">
                            <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'none' | 'percent' | 'fixed')}>
                              <SelectTrigger className="w-[140px] rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucune</SelectItem>
                                <SelectItem value="percent">Pourcentage</SelectItem>
                                <SelectItem value="fixed">Montant fixe</SelectItem>
                              </SelectContent>
                            </Select>
                            {discountType !== 'none' && (
                              <Input
                                type="number"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                placeholder={discountType === 'percent' ? 'Ex: 10' : 'Ex: 500'}
                                min="0"
                                step="0.01"
                                className="flex-1 cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                              />
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Conditions générales / Notes</Label>
                          <Textarea
                            value={generalConditions}
                            onChange={(e) => setGeneralConditions(e.target.value)}
                            placeholder="Ex: Acompte de 30% à la commande. Garantie décennale incluse..."
                            rows={3}
                            className="cursor-text rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 rounded-xl h-fit">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Sous-total HT</span>
                          <span className="font-medium text-gray-900 dark:text-white">{subtotal.toFixed(2)} €</span>
                        </div>
                        {discountAmount > 0 && (
                          <>
                            <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                              <span className="text-sm">
                                Remise {discountType === 'percent' ? `(${discountValue}%)` : ''}
                              </span>
                              <span className="font-medium">-{discountAmount.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Sous-total après remise</span>
                              <span className="font-medium text-gray-900 dark:text-white">{subtotalAfterDiscount.toFixed(2)} €</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">TVA ({tvaRate}%)</span>
                          <span className="font-medium text-gray-900 dark:text-white">{tva.toFixed(2)} €</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900 dark:text-white">Total TTC</span>
                          <Badge className="bg-violet-500 text-white px-4 py-2 rounded-xl">
                            <Euro className="h-3 w-3 mr-1" />
                            {total.toFixed(2)} €
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    className="rounded-xl"
                    data-testid="button-prev-step3"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Précédent
                  </Button>
                  <div className="flex items-center gap-2">
                    {selectedChantierId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/dashboard/projects?edit=${selectedChantierId}`)}
                        className="rounded-xl border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 shadow-sm dark:border-gray-600 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                        type="button"
                      >
                        <Building className="h-4 w-4 mr-2" />
                        Accéder au chantier
                      </Button>
                    ) : editingQuoteId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateChantierFromQuote}
                        disabled={isCreatingChantier || !clientInfo.name?.trim() || !clientInfo.email?.trim()}
                        className="rounded-xl border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 shadow-sm dark:border-gray-600 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                        type="button"
                      >
                        {isCreatingChantier ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un chantier pour ce devis
                          </>
                        )}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={handleSaveQuote}
                      disabled={isSaving || !canSaveQuote()}
                      className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl disabled:opacity-50"
                      data-testid="button-save-quote"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Sauvegarder le devis
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              {splitPreview && (
                <div className="hidden xl:block sticky top-4 h-fit">
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl overflow-hidden">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-violet-500" />
                        Aperçu en direct
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[75vh] overflow-y-auto">
                      <QuotePreview
                        quote={{
                          client_name: clientInfo.name || null,
                          client_email: clientInfo.email || null,
                          client_phone: clientInfo.phone || null,
                          client_address: clientInfo.address || null,
                          project_type: projectType || null,
                          project_description: projectDescription || null,
                          validity_days: parseInt(validityDays, 10) || 30,
                          items,
                          total_ht: subtotalAfterDiscount,
                          total_ttc: total,
                        }}
                        accentColor={accentColor}
                        logoUrl={logoUrl}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </main>
      </div>
        </>
      )}
    </PageWrapper>
  );
}
