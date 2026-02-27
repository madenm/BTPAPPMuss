import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Upload, Wand2, Plus, Calculator, User, ArrowRight, ArrowLeft, CheckCircle2,
  Search, Loader2, Building, ChevronDown, ChevronUp, AlertTriangle,
  Clock, Users, DollarSign, Pencil, RefreshCw, FileText, Camera, SkipForward,
  TrendingUp, TrendingDown, Shield,
} from 'lucide-react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getApiPostHeaders } from '@/lib/apiHeaders';
import { useAuth } from '@/context/AuthContext';
import { useChantiers } from '@/context/ChantiersContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { uploadFile } from '@/lib/supabaseStorage';
import { fetchTariffs } from '@/lib/supabaseTariffs';
import { getCatalogForMetier, ARTIPRIX_CHAPTERS, type ArtiprixChapter } from '@/lib/artiprixCatalog';

import { TYPE_CHANTIER_LABELS } from '@/lib/planningUtils';
import { getQuestionsForType, hasQuestionsForType, validateAnswers } from '@/lib/estimationQuestionnaire';
import { EstimationQuestionnaire } from '@/components/EstimationQuestionnaire';

interface UploadedImage {
  file: File;
  preview: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface EditableMaterial {
  nom: string;
  quantite: string;
  prix: number;
  prixUnitaire?: number;
  notes?: string;
}

const ESTIMATION_STORAGE_KEY = 'estimationForChantier';
const ESTIMATION_DEVIS_KEY = 'estimationForDevis';
const ESTIMATION_DEVIS_DIRECT_KEY = 'estimationForDevisDirect';

const DONUT_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Photos', 'Questions', 'Résultats'];
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto my-4">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-white/20 text-white border-2 border-white/60'
                      : 'bg-white/5 text-white/40 border border-white/15'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-[10px] mt-1 ${isActive || isDone ? 'text-white/80' : 'text-white/40'}`}>
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mt-[-14px] ${isDone ? 'bg-emerald-500' : 'bg-white/15'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : pct >= 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';
  const Icon = pct >= 80 ? Shield : pct >= 50 ? AlertTriangle : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="h-3 w-3" />
      Confiance: {pct}%
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full text-left">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Icon className="h-5 w-5 text-white/70" />
              {title}
            </h3>
            {open ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function EstimationPage() {
  const { user, session } = useAuth();
  const { clients: existingClients } = useChantiers();
  const { profile, logoUrl, themeColor } = useUserSettings();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });
  const [chantierInfo, setChantierInfo] = useState({
    surface: '',
    materiaux: '',
    localisation: '',
    delai: '',
    metier: ''
  });
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<{
    descriptionZone: string;
    suggestions?: {
      typeProjet?: string;
      typeProjetConfiance?: number;
      surfaceEstimee?: string;
      etatGeneral?: string;
      complexite?: string;
      acces?: string;
      pointsAttention?: string[];
    };
  } | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoAnalysisError, setPhotoAnalysisError] = useState<string | null>(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [editableMaterials, setEditableMaterials] = useState<EditableMaterial[]>([]);
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [userTariffs, setUserTariffs] = useState<{ label: string; unit: string; price_ht: number; category: string }[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchTariffs(user.id).then((t) => setUserTariffs(t)).catch(() => {});
    }
  }, [user?.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!user?.id) {
      setImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
      return;
    }
    setUploadingImages(true);
    const pathPrefix = `${user.id}/estimations/${Date.now()}`;
    const newUrls: UploadedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const safeName = files[i].name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const url = await uploadFile(`${pathPrefix}-${i}-${safeName}`, files[i]);
        newUrls.push({ file: files[i], preview: url });
      } catch {
        newUrls.push({ file: files[i], preview: URL.createObjectURL(files[i]) });
      }
    }
    setUploadingImages(false);
    setImages(prev => {
      const next = [...prev, ...newUrls];
      if (next.length > prev.length) setPhotoAnalysis(null);
      return next;
    });
  }, [user?.id]);

  const removeImage = (index: number) => {
    setImages(prev => {
      const p = prev[index].preview;
      if (p?.startsWith('blob:')) URL.revokeObjectURL(p);
      return prev.filter((_, i) => i !== index);
    });
  };

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ base64, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const runPhotoAnalysis = async (): Promise<typeof photoAnalysis> => {
    if (images.length === 0) return null;
    setPhotoAnalysisError(null);
    setIsAnalyzingPhoto(true);
    try {
      const photosToAnalyze = images.slice(0, 3);
      const photoData = await Promise.all(photosToAnalyze.map(img => fileToBase64(img.file)));
      const res = await fetch('/api/analyze-estimation-photo', {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({ imageBase64: photoData[0].base64, mimeType: photoData[0].mimeType })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoAnalysisError(typeof data?.message === 'string' ? data.message : 'L\'analyse de la photo a échoué.');
        return null;
      }
      const result = { descriptionZone: data.descriptionZone, suggestions: data.suggestions };
      setPhotoAnalysis(result);
      return result;
    } catch {
      setPhotoAnalysisError('Erreur réseau. Réessayez.');
      return null;
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleLaunchAnalysis = async () => {
    if (!chantierInfo.surface || !chantierInfo.metier) return;
    setEstimateError(null);
    setPhotoAnalysisError(null);
    setIsEstimating(true);
    try {
      let descriptionZoneForApi = photoAnalysis?.descriptionZone ?? undefined;
      if (images.length > 0 && !descriptionZoneForApi) {
        const analysis = await runPhotoAnalysis();
        if (analysis) descriptionZoneForApi = analysis.descriptionZone;
      }

      const tariffsContext = userTariffs.length > 0
        ? userTariffs.slice(0, 30).map(t => `${t.label} (${t.category}): ${t.price_ht}€/${t.unit}`).join(', ')
        : undefined;

      const res = await fetch('/api/estimate-chantier', {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({
          client: selectedClient ? { name: selectedClient.name, email: selectedClient.email, phone: selectedClient.phone } : undefined,
          chantierInfo: {
            surface: chantierInfo.surface,
            materiaux: chantierInfo.materiaux,
            localisation: chantierInfo.localisation,
            delai: chantierInfo.delai,
            metier: chantierInfo.metier
          },
          photoAnalysis: descriptionZoneForApi,
          questionnaireAnswers: Object.keys(questionnaireAnswers).length > 0 ? questionnaireAnswers : undefined,
          userTariffs: tariffsContext,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEstimateError(typeof data?.message === 'string' ? data.message : 'L\'estimation IA est indisponible.');
        return;
      }
      setAnalysisResults(data);
      setEditableMaterials((data.materiaux ?? []).map((m: any) => ({
        nom: m.nom ?? '', quantite: m.quantite ?? '', prix: m.prix ?? 0, prixUnitaire: m.prixUnitaire, notes: m.notes
      })));
      setEditingMaterials(false);
      setStep(3);
    } catch {
      setEstimateError('Erreur réseau. Réessayez.');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleCreateClient = () => {
    setSelectedClient({ id: Date.now().toString(), ...newClient });
    setNewClient({ name: '', email: '', phone: '' });
    setShowNewClientForm(false);
  };

  const handleCreateChantierFromEstimation = useCallback(() => {
    if (!analysisResults) return;
    const prixTTC = analysisResults.couts?.prixTTC ?? analysisResults.coutTotal;
    const payload = {
      clientName: selectedClient?.name ?? undefined,
      clientEmail: selectedClient?.email ?? undefined,
      clientPhone: selectedClient?.phone ?? undefined,
      typeChantier: chantierInfo.metier ?? '',
      duree: analysisResults.tempsRealisation ?? '',
      notes: [photoAnalysis?.descriptionZone, Object.keys(questionnaireAnswers).length ? 'Réponses questionnaire: ' + JSON.stringify(questionnaireAnswers) : ''].filter(Boolean).join('\n\n'),
      montantDevis: typeof prixTTC === 'number' && !isNaN(prixTTC) ? prixTTC : undefined,
    };
    try { sessionStorage.setItem(ESTIMATION_STORAGE_KEY, JSON.stringify(payload)); } catch {}
    setLocation('/dashboard/projects?openDialog=true&fromEstimation=1');
  }, [analysisResults, selectedClient, chantierInfo.metier, photoAnalysis?.descriptionZone, questionnaireAnswers, setLocation]);

  const handleCreateDevisFromEstimation = useCallback(() => {
    if (!analysisResults) return;
    const materials = editingMaterials ? editableMaterials : (analysisResults.materiaux ?? []);
    const payload = {
      clientName: selectedClient?.name ?? '',
      clientEmail: selectedClient?.email ?? '',
      clientPhone: selectedClient?.phone ?? '',
      projectType: TYPE_CHANTIER_LABELS[chantierInfo.metier] ?? chantierInfo.metier,
      projectDescription: `Estimation — ${chantierInfo.surface} m² — ${TYPE_CHANTIER_LABELS[chantierInfo.metier] ?? chantierInfo.metier}`,
      items: materials.map((m: any) => ({
        description: m.nom ?? 'Matériau',
        quantity: parseFloat(m.quantite) || 1,
        unitPrice: m.prixUnitaire ?? m.prix ?? 0,
        unit: '',
      })),
      conditions: profile?.default_conditions ?? '',
    };
    try { sessionStorage.setItem(ESTIMATION_DEVIS_KEY, JSON.stringify(payload)); } catch {}
    setLocation('/dashboard/quotes?new=1&fromEstimation=1');
  }, [analysisResults, editableMaterials, editingMaterials, selectedClient, chantierInfo, profile, setLocation]);

  const handleRetryEstimation = () => {
    setAnalysisResults(null);
    setEstimateError(null);
    setStep(2);
  };

  const handleFullReset = () => {
    setStep(1);
    setImages([]);
    setSelectedClient(null);
    setChantierInfo({ surface: '', materiaux: '', localisation: '', delai: '', metier: '' });
    setAnalysisResults(null);
    setPhotoAnalysis(null);
    setPhotoAnalysisError(null);
    setQuestionnaireAnswers({});
    setEditableMaterials([]);
    setEditingMaterials(false);
  };

  const filteredExistingClients = useMemo(() => {
    const list = existingClients ?? [];
    const term = clientSearch.trim().toLowerCase();
    if (!term) return list.slice(0, 8);
    return list.filter(c => c.name.toLowerCase().includes(term) || (c.email ?? '').toLowerCase().includes(term) || (c.phone ?? '').toLowerCase().includes(term)).slice(0, 8);
  }, [existingClients, clientSearch]);

  const step2Questions = chantierInfo.metier ? getQuestionsForType(chantierInfo.metier) : [];
  const questionnaireValidationErrors = chantierInfo.metier ? validateAnswers(chantierInfo.metier, questionnaireAnswers) : [];
  const allQuestionnaireAnswersFilled = step2Questions.length === 0 || (step2Questions.every((q) => questionnaireAnswers[q.id]?.trim()) && questionnaireValidationErrors.length === 0);

  const safeCouts = analysisResults?.couts as { materiaux?: number; mainOeuvre?: number; transportLivraison?: number; locationEquipements?: number; sousTotal?: number; imprevu?: number; coutDeBase?: number; fraisGeneraux?: number; margeBrute?: number; prixTTC?: number; fourchetteBasse?: number; fourchetteHaute?: number } | undefined;
  const safeConfiance = analysisResults?.confiance as number | undefined;
  const safeConfianceExplication = analysisResults?.confiance_explication as string | undefined;
  const safeTempsRealisation = analysisResults?.tempsRealisation ?? 'Non estimé';
  const safeTempsDecomposition = analysisResults?.tempsRealisationDecomposition as { preparation?: string; travauxPrincipaux?: string; finitions?: string; imprevu?: string } | undefined;
  const safeNombreOuvriers = analysisResults?.nombreOuvriers ?? 1;
  const safeCoutTotal = analysisResults?.coutTotal ?? 0;
  const safeMarge = analysisResults?.marge ?? 0;
  const safeBenefice = analysisResults?.benefice ?? 0;
  const safeRecommandations = analysisResults?.recommandations ?? [];
  const safeHypotheses = analysisResults?.hypotheses as string[] | undefined;
  const safeOutilsALouer = analysisResults?.outilsaLouer as { nom: string; duree?: string; coutLocation?: number }[] | undefined;
  const safeOutilsFournis = analysisResults?.outilsFournis as string[] | undefined;
  const safeOutils = analysisResults?.outils ?? [];
  const safeEquipe = analysisResults?.equipe as { composition?: string; joursPresence?: number; productivite?: string } | undefined;
  const safeRepartitionCouts = analysisResults?.repartitionCouts ?? {};
  const safeEstimationLocationTotal = analysisResults?.estimationLocationTotal as number | undefined;

  const prixPrincipal = safeCouts?.prixTTC ?? safeCoutTotal;
  const fourchetteBasse = safeCouts?.fourchetteBasse ?? Math.round(prixPrincipal * 0.85);
  const fourchetteHaute = safeCouts?.fourchetteHaute ?? Math.round(prixPrincipal * 1.2);

  const donutData = useMemo(() => {
    const rep = safeRepartitionCouts;
    if (!rep || Object.keys(rep).length === 0) return [];
    return Object.entries(rep)
      .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
      .map(([key, value]) => ({
        name: key === 'mainOeuvre' ? 'Main-d\'œuvre' : key === 'materiaux' ? 'Matériaux' : key.charAt(0).toUpperCase() + key.slice(1),
        value: value as number,
      }));
  }, [safeRepartitionCouts]);

  const materialTotal = useMemo(() => editableMaterials.reduce((s, m) => s + (m.prix || 0), 0), [editableMaterials]);

  const selectExistingClient = (c: { id: string; name: string; email: string; phone?: string }) => {
    setSelectedClient({ id: c.id, name: c.name, email: c.email, phone: c.phone ?? '' });
    setClientSearch('');
  };

  const suggestionLabelToMetier = useCallback((typeProjet: string): string | null => {
    if (!typeProjet?.trim()) return null;
    const trimmed = typeProjet.trim();
    const exact = Object.entries(TYPE_CHANTIER_LABELS).find(([, v]) => v === trimmed);
    if (exact) return exact[0];
    const normalized = trimmed.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return Object.keys(TYPE_CHANTIER_LABELS).find(
      (k) => TYPE_CHANTIER_LABELS[k].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') === normalized
    ) ?? null;
  }, []);

  useEffect(() => {
    if (step !== 2 || !photoAnalysis?.suggestions) return;
    setChantierInfo(prev => {
      let next = { ...prev };
      if (photoAnalysis.suggestions?.surfaceEstimee && !prev.surface) next = { ...next, surface: photoAnalysis.suggestions.surfaceEstimee };
      const confiance = photoAnalysis.suggestions?.typeProjetConfiance;
      if (confiance != null && confiance > 0.75 && photoAnalysis.suggestions?.typeProjet && !prev.metier) {
        const metierKey = suggestionLabelToMetier(photoAnalysis.suggestions.typeProjet);
        if (metierKey) next = { ...next, metier: metierKey };
      }
      return next;
    });
  }, [step, photoAnalysis?.suggestions, suggestionLabelToMetier]);

  const cardClass = "bg-black/20 backdrop-blur-xl border border-white/10 text-white";

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              Estimation Automatique
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              {step === 1 ? 'Ajoutez des photos (optionnel)' : step === 2 ? 'Décrivez votre projet' : 'Résultats de l\'estimation'}
            </p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 py-4 sm:py-6 px-4 sm:px-0">
        <StepIndicator current={step} total={3} />

        <AnimatePresence mode="wait">
          {/* ==================== ÉTAPE 1 — PHOTOS (OPTIONNEL) ==================== */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-4xl mx-auto w-full">
              <Card className={cardClass}>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Camera className="h-5 w-5 text-white/70" />
                    Photo de la zone du projet
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">
                    Ajoutez des photos pour une analyse IA plus précise, ou passez directement aux questions.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-colors ${
                      isDragging ? 'border-white/40 bg-white/10' : 'border-white/20 hover:border-white/30'
                    }`}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-3 text-white/50" />
                    <p className="text-sm font-medium text-white mb-1">Glissez-déposez vos photos ici</p>
                    <p className="text-xs text-white/50 mb-3">ou cliquez pour sélectionner</p>
                    <input id="photo-upload" type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />
                    <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={() => document.getElementById('photo-upload')?.click()} disabled={uploadingImages}>
                      {uploadingImages ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Upload...</> : 'Sélectionner des photos'}
                    </Button>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img src={image.preview} alt={`Photo ${index + 1}`} className="w-full h-28 object-cover rounded-lg border border-white/20" />
                          <button onClick={() => { setPhotoAnalysis(null); removeImage(index); }} className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between mt-4 gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="text-white/70 border-white/20 hover:bg-white/10">
                      <SkipForward className="h-4 w-4 mr-2" />
                      Passer cette étape
                    </Button>
                    <Button onClick={() => setStep(2)} className="bg-white/20 text-white border border-white/10 hover:bg-white/30">
                      {images.length > 0 ? `Continuer avec ${images.length} photo${images.length > 1 ? 's' : ''}` : 'Continuer sans photo'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== ÉTAPE 2 — QUESTIONS ==================== */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-4xl mx-auto">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-white/70" />
                    Décrivez votre projet
                  </CardTitle>
                  <div className="space-y-1 mt-1">
                    {userTariffs.length > 0 && (
                      <p className="text-xs text-emerald-400/80 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {userTariffs.length} tarifs personnels seront utilisés en priorité
                      </p>
                    )}
                    {chantierInfo.metier && (
                      <p className="text-xs text-blue-400/80 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        + {getCatalogForMetier(chantierInfo.metier).length} prix de référence Artiprix ({(getCatalogForMetier(chantierInfo.metier).map(e => e.chapter as ArtiprixChapter).filter((v, i, a) => a.indexOf(v) === i).map(c => ARTIPRIX_CHAPTERS[c]).join(', '))})
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Client (optionnel) */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-white">Client (optionnel)</Label>
                    {selectedClient ? (
                      <div className="p-3 bg-black/20 border border-white/10 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{selectedClient.name}</p>
                          <p className="text-xs text-white/60">{selectedClient.email} {selectedClient.phone && `• ${selectedClient.phone}`}</p>
                        </div>
                        <Button variant="outline" size="sm" className="text-white/70 border-white/20 hover:bg-white/10" onClick={() => setSelectedClient(null)}>Changer</Button>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 bg-black/20 border border-white/10 rounded-xl">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <Input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Rechercher un client..." className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                        </div>
                        {filteredExistingClients.length > 0 && (
                          <ul className="border border-white/10 rounded-lg overflow-hidden divide-y divide-white/10 max-h-36 overflow-y-auto">
                            {filteredExistingClients.map((c) => (
                              <li key={c.id}>
                                <button type="button" onClick={() => selectExistingClient(c)} className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors">
                                  <span className="font-medium text-white text-sm">{c.name}</span>
                                  <span className="text-xs text-white/60 ml-2">{c.email}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {!showNewClientForm ? (
                          <Button type="button" variant="outline" size="sm" className="text-white/70 border-white/20 hover:bg-white/10" onClick={() => setShowNewClientForm(true)}>
                            <Plus className="h-4 w-4 mr-1" /> Nouveau client
                          </Button>
                        ) : (
                          <div className="space-y-3 border-t border-white/10 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-white/70">Nom</Label>
                                <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nom" className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/70">Email</Label>
                                <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@ex.fr" className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/70">Téléphone</Label>
                                <Input type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="06..." className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleCreateClient} disabled={!newClient.name || !newClient.email} className="bg-white/20 text-white border border-white/10 hover:bg-white/30"><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
                              <Button size="sm" variant="outline" className="text-white/60 border-white/15 hover:bg-white/10" onClick={() => { setShowNewClientForm(false); setNewClient({ name: '', email: '', phone: '' }); }}>Annuler</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Infos projet */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-white">Détails du projet</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-white/70">Type de projet *</Label>
                        <Select value={chantierInfo.metier} onValueChange={(v) => { setChantierInfo({ ...chantierInfo, metier: v }); setQuestionnaireAnswers({}); }}>
                          <SelectTrigger className="bg-black/20 border-white/10 text-white"><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TYPE_CHANTIER_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-white/70">Surface en m² *</Label>
                        <Input type="number" value={chantierInfo.surface} onChange={(e) => setChantierInfo({ ...chantierInfo, surface: e.target.value })} placeholder="Ex: 50" className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                      </div>

                      {chantierInfo.metier && getQuestionsForType(chantierInfo.metier).length > 0 && (
                        <EstimationQuestionnaire type={chantierInfo.metier} answers={questionnaireAnswers} onChange={(id, value) => setQuestionnaireAnswers((prev) => ({ ...prev, [id]: value }))} />
                      )}
                      {chantierInfo.metier && !hasQuestionsForType(chantierInfo.metier) && (
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-sm text-white/70">Précisez le projet ou les matériaux</Label>
                          <Input value={chantierInfo.materiaux} onChange={(e) => setChantierInfo({ ...chantierInfo, materiaux: e.target.value })} placeholder="Ex: Carrelage, Peinture..." className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-sm text-white/70">Localisation</Label>
                        <Input value={chantierInfo.localisation} onChange={(e) => setChantierInfo({ ...chantierInfo, localisation: e.target.value })} placeholder="Ex: Paris 75001" className="bg-black/20 border-white/10 text-white placeholder:text-white/40" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-white/70">Délai souhaité</Label>
                        <Select value={chantierInfo.delai} onValueChange={(v) => setChantierInfo({ ...chantierInfo, delai: v })}>
                          <SelectTrigger className="bg-black/20 border-white/10 text-white"><SelectValue placeholder="— Optionnel —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ASAP">ASAP</SelectItem>
                            <SelectItem value="1-2 semaines">1–2 semaines</SelectItem>
                            <SelectItem value="2-4 semaines">2–4 semaines</SelectItem>
                            <SelectItem value="1-3 mois">1–3 mois</SelectItem>
                            <SelectItem value="Flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {questionnaireValidationErrors.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-200 text-sm space-y-0.5">
                      {questionnaireValidationErrors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                  {photoAnalysisError && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-200 text-sm">
                      Analyse photo : {photoAnalysisError}
                    </div>
                  )}
                  {estimateError && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-400/25 text-red-200 text-sm">{estimateError}</div>
                  )}

                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => { setEstimateError(null); setStep(1); }} disabled={isEstimating} className="text-white/70 border-white/20 hover:bg-white/10">
                      <ArrowLeft className="h-4 w-4 mr-2" />Retour
                    </Button>
                    <Button onClick={handleLaunchAnalysis} disabled={!chantierInfo.surface || !chantierInfo.metier || !allQuestionnaireAnswersFilled || isEstimating} className="bg-white/20 text-white border border-white/10 hover:bg-white/30 disabled:opacity-50">
                      {isEstimating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Estimation en cours...</> : <><Wand2 className="h-4 w-4 mr-2" />Obtenir l&apos;estimation</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ==================== ÉTAPE 3 — RÉSULTATS ==================== */}
          {step === 3 && analysisResults && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-6xl mx-auto space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-black/40 backdrop-blur-xl border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Prix estimé</span>
                    </div>
                    <p className="text-2xl font-extrabold text-white">{prixPrincipal.toLocaleString('fr-FR')} €</p>
                    <p className="text-xs text-white/60 mt-1">{fourchetteBasse.toLocaleString('fr-FR')} – {fourchetteHaute.toLocaleString('fr-FR')} €</p>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border-2 border-blue-500/40 shadow-lg shadow-blue-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">Durée</span>
                    </div>
                    <p className="text-2xl font-extrabold text-white">{safeTempsRealisation}</p>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border-2 border-violet-500/40 shadow-lg shadow-violet-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-violet-400" />
                      </div>
                      <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">Équipe</span>
                    </div>
                    <p className="text-2xl font-extrabold text-white">{safeNombreOuvriers} ouvrier{safeNombreOuvriers > 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 backdrop-blur-xl border-2 border-amber-500/40 shadow-lg shadow-amber-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-amber-400" />
                      </div>
                      <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Marge</span>
                    </div>
                    <p className="text-2xl font-extrabold text-white">{(safeCouts?.margeBrute ?? safeMarge).toLocaleString('fr-FR')} €</p>
                    {safeConfiance != null && <div className="mt-2"><ConfidenceBadge value={safeConfiance} /></div>}
                  </CardContent>
                </Card>
              </div>

              {/* Actions principales */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreateDevisFromEstimation} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileText className="h-4 w-4 mr-2" />Créer un devis
                </Button>
                <Button variant="outline" onClick={handleCreateChantierFromEstimation} className="text-white border-white/20 hover:bg-white/10">
                  <Building className="h-4 w-4 mr-2" />Créer un projet
                </Button>
                <Button variant="outline" onClick={handleRetryEstimation} className="text-white border-white/20 hover:bg-white/10">
                  <RefreshCw className="h-4 w-4 mr-2" />Refaire l&apos;estimation
                </Button>
                <Button variant="outline" onClick={handleFullReset} className="text-white/60 border-white/15 hover:bg-white/10">
                  Nouvelle estimation
                </Button>
              </div>

              {/* Fourchette */}
              <Card className={cardClass}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-white">Fourchette de prix</h3>
                    {safeConfianceExplication && <span className="text-xs text-white/50">{safeConfianceExplication}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <TrendingDown className="h-4 w-4 text-blue-400 mx-auto" />
                      <p className="text-sm font-bold text-white">{fourchetteBasse.toLocaleString('fr-FR')} €</p>
                      <p className="text-[10px] text-white/40">Basse</p>
                    </div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full relative mx-2">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 opacity-60" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-emerald-400" style={{ left: `${Math.min(90, Math.max(10, ((prixPrincipal - fourchetteBasse) / (fourchetteHaute - fourchetteBasse)) * 100))}%` }} />
                    </div>
                    <div className="text-center">
                      <TrendingUp className="h-4 w-4 text-amber-400 mx-auto" />
                      <p className="text-sm font-bold text-white">{fourchetteHaute.toLocaleString('fr-FR')} €</p>
                      <p className="text-[10px] text-white/40">Haute</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Détail coûts */}
              <CollapsibleSection title="Détail des coûts" icon={DollarSign} defaultOpen>
                {safeCouts && (safeCouts.materiaux != null || safeCouts.mainOeuvre != null) ? (
                  <div className="space-y-2">
                    {safeCouts.materiaux != null && <div className="flex justify-between text-sm"><span className="text-white/70">Matériaux</span><span className="text-white font-medium">{safeCouts.materiaux.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.mainOeuvre != null && <div className="flex justify-between text-sm"><span className="text-white/70">Main-d&apos;œuvre</span><span className="text-white font-medium">{safeCouts.mainOeuvre.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.transportLivraison != null && <div className="flex justify-between text-sm"><span className="text-white/70">Transport</span><span className="text-white font-medium">{safeCouts.transportLivraison.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.locationEquipements != null && <div className="flex justify-between text-sm"><span className="text-white/70">Location</span><span className="text-white font-medium">{safeCouts.locationEquipements.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.imprevu != null && <div className="flex justify-between text-sm"><span className="text-white/70">Imprévus</span><span className="text-white font-medium">{safeCouts.imprevu.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.fraisGeneraux != null && <div className="flex justify-between text-sm"><span className="text-white/70">Frais généraux</span><span className="text-white font-medium">{safeCouts.fraisGeneraux.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.margeBrute != null && <div className="flex justify-between text-sm"><span className="text-white/70">Marge</span><span className="text-white font-medium">{safeCouts.margeBrute.toLocaleString('fr-FR')} €</span></div>}
                    {safeCouts.prixTTC != null && <div className="flex justify-between text-sm border-t border-white/10 pt-2 mt-2"><span className="text-white font-semibold">Prix TTC</span><span className="text-emerald-400 font-bold">{safeCouts.prixTTC.toLocaleString('fr-FR')} €</span></div>}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-white/70">Coût de base</span><span className="text-white font-medium">{safeCoutTotal.toLocaleString('fr-FR')} €</span></div>
                    <div className="flex justify-between"><span className="text-white/70">Marge</span><span className="text-white font-medium">{safeMarge.toLocaleString('fr-FR')} €</span></div>
                    <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-white font-semibold">Bénéfice</span><span className="text-emerald-400 font-bold">{safeBenefice.toLocaleString('fr-FR')} €</span></div>
                  </div>
                )}
              </CollapsibleSection>

              {/* Répartition donut + temps */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {donutData.length > 0 && (
                  <Card className={cardClass}>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-white/60" />Répartition</h3>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} €`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <CollapsibleSection title="Temps de réalisation" icon={Clock} defaultOpen>
                  <p className="text-lg font-bold text-white">{safeTempsRealisation}</p>
                  {safeTempsDecomposition && (
                    <div className="mt-2 space-y-1 text-sm text-white/80">
                      {safeTempsDecomposition.preparation && <p>• Préparation : {safeTempsDecomposition.preparation}</p>}
                      {safeTempsDecomposition.travauxPrincipaux && <p>• Travaux : {safeTempsDecomposition.travauxPrincipaux}</p>}
                      {safeTempsDecomposition.finitions && <p>• Finitions : {safeTempsDecomposition.finitions}</p>}
                      {safeTempsDecomposition.imprevu && <p>• Imprévus : {safeTempsDecomposition.imprevu}</p>}
                    </div>
                  )}
                  {safeEquipe && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-sm text-white/80">
                      {safeEquipe.composition && <p><span className="text-white/50">Composition:</span> {safeEquipe.composition}</p>}
                      {safeEquipe.joursPresence != null && <p><span className="text-white/50">Jours:</span> {safeEquipe.joursPresence}</p>}
                    </div>
                  )}
                </CollapsibleSection>
              </div>

              {/* Matériaux éditables */}
              <CollapsibleSection title={`Matériaux (${editableMaterials.length}) — Total: ${materialTotal.toLocaleString('fr-FR')} €`} icon={FileText} defaultOpen>
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingMaterials(!editingMaterials)} className="text-white/70 border-white/20 hover:bg-white/10 text-xs">
                    <Pencil className="h-3 w-3 mr-1" />{editingMaterials ? 'Terminer' : 'Modifier'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {editableMaterials.map((mat, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                      {editingMaterials ? (
                        <>
                          <Input value={mat.nom} onChange={(e) => { const m = [...editableMaterials]; m[i] = { ...m[i], nom: e.target.value }; setEditableMaterials(m); }} className="flex-1 bg-black/20 border-white/10 text-white text-sm h-8" />
                          <Input value={mat.quantite} onChange={(e) => { const m = [...editableMaterials]; m[i] = { ...m[i], quantite: e.target.value }; setEditableMaterials(m); }} className="w-20 bg-black/20 border-white/10 text-white text-sm h-8" />
                          <Input type="number" value={mat.prix} onChange={(e) => { const m = [...editableMaterials]; m[i] = { ...m[i], prix: parseFloat(e.target.value) || 0 }; setEditableMaterials(m); }} className="w-24 bg-black/20 border-white/10 text-white text-sm h-8" />
                          <span className="text-white/50 text-xs">€</span>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{mat.nom}</p>
                            <p className="text-white/50 text-xs">{mat.quantite}{mat.notes ? ` — ${mat.notes}` : ''}</p>
                          </div>
                          <div className="text-right">
                            {mat.prixUnitaire != null && <p className="text-white/40 text-[10px]">P.U. {mat.prixUnitaire} €</p>}
                            <p className="text-white font-medium text-sm">{mat.prix.toLocaleString('fr-FR')} €</p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {editableMaterials.length === 0 && <p className="text-white/50 text-sm">Aucun matériau.</p>}
                </div>
              </CollapsibleSection>

              {/* Outils */}
              <CollapsibleSection title="Outils nécessaires" icon={Wand2}>
                {(safeOutilsALouer?.length || safeOutilsFournis?.length) ? (
                  <div className="space-y-3">
                    {safeOutilsALouer && safeOutilsALouer.length > 0 && (
                      <div>
                        <p className="text-white/70 text-xs font-medium mb-1">À louer</p>
                        <ul className="space-y-1">{safeOutilsALouer.map((o, i) => <li key={i} className="text-white/80 text-sm flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">•</span>{o.nom}{o.duree ? ` (${o.duree})` : ''}{o.coutLocation != null ? ` — ${o.coutLocation} €` : ''}</li>)}</ul>
                      </div>
                    )}
                    {safeOutilsFournis && safeOutilsFournis.length > 0 && (
                      <div>
                        <p className="text-white/70 text-xs font-medium mb-1">Fournis</p>
                        <ul className="space-y-1">{safeOutilsFournis.map((o, i) => <li key={i} className="text-white/80 text-sm flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">•</span>{o}</li>)}</ul>
                      </div>
                    )}
                    {safeEstimationLocationTotal != null && <p className="text-white/50 text-xs mt-2">Location totale: <span className="text-white font-medium">{safeEstimationLocationTotal} €</span></p>}
                  </div>
                ) : safeOutils.length > 0 ? (
                  <ul className="space-y-1">{safeOutils.map((o: string, i: number) => <li key={i} className="text-white/80 text-sm flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">•</span>{o}</li>)}</ul>
                ) : <p className="text-white/50 text-sm">Aucun outil listé.</p>}
              </CollapsibleSection>

              {/* Recommandations */}
              {safeRecommandations.length > 0 && (
                <CollapsibleSection title="Recommandations" icon={CheckCircle2}>
                  <ul className="space-y-1.5">{safeRecommandations.map((r: string, i: number) => <li key={i} className="text-white/80 text-sm flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">•</span>{r}</li>)}</ul>
                </CollapsibleSection>
              )}

              {/* Hypothèses */}
              {safeHypotheses && safeHypotheses.length > 0 && (
                <CollapsibleSection title="Hypothèses" icon={AlertTriangle}>
                  <ul className="space-y-1.5">{safeHypotheses.map((h, i) => <li key={i} className="text-white/70 text-sm flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">•</span>{h}</li>)}</ul>
                </CollapsibleSection>
              )}

              {/* Photo analysis */}
              {photoAnalysis && (
                <CollapsibleSection title="Analyse photo IA" icon={Camera}>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{photoAnalysis.descriptionZone}</p>
                  {photoAnalysis.suggestions && (
                    <div className="mt-2 space-y-0.5 text-xs text-white/50">
                      {photoAnalysis.suggestions.typeProjet && <p>Type détecté: {photoAnalysis.suggestions.typeProjet}</p>}
                      {photoAnalysis.suggestions.surfaceEstimee && <p>Surface estimée: ~{photoAnalysis.suggestions.surfaceEstimee} m²</p>}
                      {photoAnalysis.suggestions.etatGeneral && <p>État: {photoAnalysis.suggestions.etatGeneral}</p>}
                      {photoAnalysis.suggestions.complexite && <p>Complexité: {photoAnalysis.suggestions.complexite}</p>}
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* Récapitulatif */}
              <CollapsibleSection title="Récapitulatif de saisie" icon={User}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {selectedClient && <div><span className="text-white/50">Client:</span> <span className="text-white">{selectedClient.name}</span></div>}
                  {chantierInfo.surface && <div><span className="text-white/50">Surface:</span> <span className="text-white">{chantierInfo.surface} m²</span></div>}
                  {chantierInfo.metier && <div><span className="text-white/50">Type:</span> <span className="text-white">{TYPE_CHANTIER_LABELS[chantierInfo.metier] ?? chantierInfo.metier}</span></div>}
                  {chantierInfo.localisation && <div><span className="text-white/50">Lieu:</span> <span className="text-white">{chantierInfo.localisation}</span></div>}
                  {chantierInfo.delai && <div><span className="text-white/50">Délai:</span> <span className="text-white">{chantierInfo.delai}</span></div>}
                </div>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {images.slice(0, 6).map((img, i) => (
                      <img key={i} src={img.preview} alt={`Photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageWrapper>
  );
}
