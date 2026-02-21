import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Upload, Wand2, Plus, Calculator, User, ArrowRight, ArrowLeft, CheckCircle2, Search, Loader2, FileDown, Building } from 'lucide-react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiPostHeaders } from '@/lib/apiHeaders';
import { useAuth } from '@/context/AuthContext';
import { useChantiers } from '@/context/ChantiersContext';
import { uploadFile } from '@/lib/supabaseStorage';
import { Input } from '@/components/ui/input';
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

const ESTIMATION_STORAGE_KEY = 'estimationForChantier';

export default function EstimationPage() {
  const { user, session } = useAuth();
  const { clients: existingClients } = useChantiers();
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
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!user?.id) {
      const newImages = files.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImages(prev => [...prev, ...newImages]);
      return;
    }
    setUploadingImages(true);
    const pathPrefix = `${user.id}/estimations/${Date.now()}`;
    const newUrls: UploadedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${pathPrefix}-${i}-${safeName}`;
        const url = await uploadFile(path, file);
        newUrls.push({ file, preview: url });
      } catch (err) {
        console.error('Upload failed:', err);
        newUrls.push({ file, preview: URL.createObjectURL(file) });
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
      const newImages = prev.filter((_, i) => i !== index);
      const p = prev[index].preview;
      if (p && p.startsWith('blob:')) URL.revokeObjectURL(p);
      return newImages;
    });
  };

  const handleNext = () => {
    if (step === 1 && images.length > 0) {
      setStep(2);
    }
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

  /** Lance l'analyse photo (première image) et retourne le résultat. Utilisé à l'étape 2 avant l'estimation ; les résultats sont affichés à l'étape 3. */
  const runPhotoAnalysisForEstimate = async (): Promise<{ descriptionZone: string; suggestions?: { typeProjet?: string; typeProjetConfiance?: number; surfaceEstimee?: string; etatGeneral?: string; complexite?: string; acces?: string; pointsAttention?: string[] } } | null> => {
    if (images.length === 0) return null;
    setPhotoAnalysisError(null);
    try {
      const { base64, mimeType } = await fileToBase64(images[0].file);
      const res = await fetch('/api/analyze-estimation-photo', {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({ imageBase64: base64, mimeType })
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
    }
  };

  const handleLaunchAnalysis = async () => {
    if (!chantierInfo.surface || !chantierInfo.metier) return;
    setEstimateError(null);
    setPhotoAnalysisError(null);
    setIsEstimating(true);
    try {
      // Analyse photo si des images sont présentes et pas encore analysées (résultat affiché à l'étape 3)
      let descriptionZoneForApi = photoAnalysis?.descriptionZone ?? undefined;
      if (images.length > 0 && !descriptionZoneForApi) {
        const analysis = await runPhotoAnalysisForEstimate();
        if (analysis) descriptionZoneForApi = analysis.descriptionZone;
      }

      const res = await fetch('/api/estimate-chantier', {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify({
          client: selectedClient ? {
            name: selectedClient.name,
            email: selectedClient.email,
            phone: selectedClient.phone
          } : undefined,
          chantierInfo: {
            surface: chantierInfo.surface,
            materiaux: chantierInfo.materiaux,
            localisation: chantierInfo.localisation,
            delai: chantierInfo.delai,
            metier: chantierInfo.metier
          },
          photoAnalysis: descriptionZoneForApi,
          questionnaireAnswers: Object.keys(questionnaireAnswers).length > 0 ? questionnaireAnswers : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEstimateError(typeof data?.message === 'string' ? data.message : 'L\'estimation IA est indisponible.');
        return;
      }
      setAnalysisResults(data);
      setStep(3);
    } catch {
      setEstimateError('Erreur réseau. Réessayez.');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleCreateClient = () => {
    const client: Client = {
      id: Date.now().toString(),
      ...newClient
    };
    setSelectedClient(client);
    setNewClient({ name: '', email: '', phone: '' });
    setShowNewClientForm(false);
  };

  const handleExportPdf = useCallback(() => {
    if (!analysisResults) return;
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(16);
    doc.text('Estimation de projet', 14, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Type: ${chantierInfo.metier ? (TYPE_CHANTIER_LABELS[chantierInfo.metier] ?? chantierInfo.metier) : '—'} | Surface: ${chantierInfo.surface ?? '—'} m²`, 14, y);
    y += 8;
    doc.text(`Temps estimé: ${analysisResults.tempsRealisation ?? '—'} | Ouvriers: ${analysisResults.nombreOuvriers ?? 1}`, 14, y);
    y += 8;
    if (analysisResults.materiaux?.length) {
      doc.text('Matériaux:', 14, y);
      y += 6;
      analysisResults.materiaux.forEach((m: { nom?: string; quantite?: string; prix?: number }) => {
        doc.text(`  • ${m.nom ?? ''} — ${m.quantite ?? ''} — ${m.prix ?? 0} €`, 14, y);
        y += 5;
      });
      y += 3;
    }
    if (analysisResults.outils?.length) {
      doc.text('Outils: ' + (analysisResults.outils as string[]).join(', '), 14, y);
      y += 8;
    }
    const coutTotal = analysisResults.coutTotal ?? analysisResults.couts?.prixTTC ?? 0;
    const marge = analysisResults.marge ?? analysisResults.couts?.margeBrute ?? 0;
    const benefice = analysisResults.benefice ?? 0;
    doc.text(`Coût de base: ${coutTotal} € | Marge: ${marge} € | Bénéfice estimé: ${benefice} €`, 14, y);
    y += 8;
    if (Array.isArray(analysisResults.recommandations) && analysisResults.recommandations.length) {
      doc.text('Recommandations:', 14, y);
      y += 6;
      analysisResults.recommandations.slice(0, 5).forEach((r: string) => {
        doc.text(`  • ${r}`, 14, y);
        y += 5;
      });
    }
    doc.save('estimation-chantier.pdf');
  }, [analysisResults, chantierInfo.metier, chantierInfo.surface]);

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
    try {
      sessionStorage.setItem(ESTIMATION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
    setLocation('/dashboard/projects?openDialog=true&fromEstimation=1');
  }, [analysisResults, selectedClient, chantierInfo.metier, photoAnalysis?.descriptionZone, questionnaireAnswers, setLocation]);

  const filteredExistingClients = useMemo(() => {
    const list = existingClients ?? [];
    const term = clientSearch.trim().toLowerCase();
    if (!term) return list.slice(0, 8);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term) ||
          (c.phone ?? '').toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [existingClients, clientSearch]);

  const step2Questions = chantierInfo.metier ? getQuestionsForType(chantierInfo.metier) : [];
  const questionnaireValidationErrors = chantierInfo.metier ? validateAnswers(chantierInfo.metier, questionnaireAnswers) : [];
  const allQuestionnaireAnswersFilled = step2Questions.length === 0 || (step2Questions.every((q) => questionnaireAnswers[q.id]?.trim()) && questionnaireValidationErrors.length === 0);

  const safeMateriaux = analysisResults?.materiaux ?? [];
  const safeOutils = analysisResults?.outils ?? [];
  const safeRepartitionCouts = analysisResults?.repartitionCouts ?? {};
  const safeRecommandations = analysisResults?.recommandations ?? [];
  const safeTempsRealisation = analysisResults?.tempsRealisation ?? 'Non estimé';
  const safeTempsDecomposition = analysisResults?.tempsRealisationDecomposition as { preparation?: string; travauxPrincipaux?: string; finitions?: string; imprevu?: string } | undefined;
  const safeOutilsALouer = analysisResults?.outilsaLouer as { nom: string; duree?: string; coutLocation?: number }[] | undefined;
  const safeOutilsFournis = analysisResults?.outilsFournis as string[] | undefined;
  const safeEstimationLocationTotal = analysisResults?.estimationLocationTotal as number | undefined;
  const safeEquipe = analysisResults?.equipe as { composition?: string; joursPresence?: number; productivite?: string } | undefined;
  const safeCouts = analysisResults?.couts as { materiaux?: number; mainOeuvre?: number; transportLivraison?: number; locationEquipements?: number; sousTotal?: number; imprevu?: number; coutDeBase?: number; fraisGeneraux?: number; margeBrute?: number; prixTTC?: number } | undefined;
  const safeHypotheses = analysisResults?.hypotheses as string[] | undefined;
  const safeConfiance = analysisResults?.confiance as number | undefined;
  const safeConfianceExplication = analysisResults?.confiance_explication as string | undefined;
  const safeNombreOuvriers = analysisResults?.nombreOuvriers ?? 1;
  const safeCoutTotal = analysisResults?.coutTotal ?? 0;
  const safeMarge = analysisResults?.marge ?? 0;
  const safeBenefice = analysisResults?.benefice ?? 0;

  const selectExistingClient = (c: { id: string; name: string; email: string; phone?: string }) => {
    setSelectedClient({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? ''
    });
    setClientSearch('');
  };

  // Map suggestion label (e.g. "Rénovation") to metier key (e.g. "renovation")
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
      if (photoAnalysis.suggestions?.surfaceEstimee && !prev.surface)
        next = { ...next, surface: photoAnalysis.suggestions.surfaceEstimee };
      const confiance = photoAnalysis.suggestions?.typeProjetConfiance;
      const shouldPrefillType = confiance != null && confiance > 0.75;
      if (shouldPrefillType && photoAnalysis.suggestions?.typeProjet && !prev.metier) {
        const metierKey = suggestionLabelToMetier(photoAnalysis.suggestions.typeProjet);
        if (metierKey) next = { ...next, metier: metierKey };
      }
      return next;
    });
  }, [step, photoAnalysis?.suggestions, suggestionLabelToMetier]);

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              Estimation Automatique des Chantiers
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Étape {step}/3 - {step === 1 ? 'Photo de la zone' : step === 2 ? 'Questions' : 'Résultats de l\'estimation'}
            </p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 py-4 sm:py-6 px-4 sm:px-0">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto w-full"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white/70 flex-shrink-0" />
                    <span className="break-words">Photo de la zone du projet</span>
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">
                    Insérez une photo de la zone où aura lieu le chantier. Elle sera analysée par l’IA.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition-colors ${
                      isDragging
                        ? 'border-white/40 bg-white/10'
                        : 'border-white/20 hover:border-white/30'
                    }`}
                  >
                    <Upload className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-white/70" />
                    <p className="text-sm sm:text-lg font-medium text-white mb-1 sm:mb-2">
                      Glissez-déposez une photo ici
                    </p>
                    <p className="text-xs sm:text-sm text-white/60 mb-3 sm:mb-4">
                      ou cliquez pour sélectionner un fichier
                    </p>
                    <input
                      id="photo-upload"
                      name="photo"
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="text-white border-white/20 hover:bg-white/10"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                      disabled={uploadingImages}
                    >
                      {uploadingImages ? 'Upload en cours...' : 'Sélectionner une photo'}
                    </Button>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      {images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-white/20"
                          />
                          <button
                            onClick={() => { setPhotoAnalysis(null); setPhotoAnalysisError(null); removeImage(index); }}
                            className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-white/60 text-sm mt-2">L&apos;analyse de la photo et tous les résultats seront affichés à l&apos;étape 3.</p>

                  <div className="flex justify-end mt-6 gap-2">
                    <Button
                      onClick={handleNext}
                      disabled={images.length === 0}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      Continuer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-white/70" />
                    Questions pour l&apos;estimation
                  </CardTitle>
                  <p className="text-sm text-white/60 mt-1">
                    Répondez aux questions suivantes pour obtenir une estimation.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Client (optionnel) */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Client (optionnel)</h3>
                    {selectedClient ? (
                      <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                        <p className="text-white font-medium">{selectedClient.name}</p>
                        <p className="text-sm text-white/70">{selectedClient.email}</p>
                        <p className="text-sm text-white/70">{selectedClient.phone}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-white border-white/20 hover:bg-white/10"
                          onClick={() => setSelectedClient(null)}
                        >
                          Changer de client
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                        <label className="text-sm font-medium text-white block mb-2">Rechercher un client existant</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                          <Input
                            type="text"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Nom, email ou téléphone..."
                            className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-white/50"
                          />
                        </div>
                        {filteredExistingClients.length > 0 && (
                          <ul className="border border-white/10 rounded-lg overflow-hidden divide-y divide-white/10 max-h-48 overflow-y-auto">
                            {filteredExistingClients.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => selectExistingClient(c)}
                                  className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex flex-col gap-0.5"
                                >
                                  <span className="font-medium text-white">{c.name}</span>
                                  <span className="text-sm text-white/70">{c.email}</span>
                                  {c.phone && (
                                    <span className="text-sm text-white/60">{c.phone}</span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(existingClients ?? []).length === 0 && !showNewClientForm && (
                          <p className="text-sm text-white/60">Aucun client enregistré. Créez-en un ci-dessous.</p>
                        )}
                        <div className="pt-2 border-t border-white/10">
                          {!showNewClientForm ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-white border-white/20 hover:bg-white/10"
                              onClick={() => setShowNewClientForm(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Créer un nouveau client
                            </Button>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-white mb-3">Nouveau client</p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-white/80 block mb-2" htmlFor="new-client-name">Nom</label>
                                  <input
                                    id="new-client-name"
                                    name="newClientName"
                                    type="text"
                                    value={newClient.name}
                                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                                    placeholder="Nom du client"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-white/80 block mb-2" htmlFor="new-client-email">Email</label>
                                  <input
                                    id="new-client-email"
                                    name="newClientEmail"
                                    type="email"
                                    value={newClient.email}
                                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                                    placeholder="email@example.com"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-white/80 block mb-2" htmlFor="new-client-phone">Téléphone</label>
                                  <input
                                    id="new-client-phone"
                                    name="newClientPhone"
                                    type="tel"
                                    value={newClient.phone}
                                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                    className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                                    placeholder="06 12 34 56 78"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  onClick={handleCreateClient}
                                  disabled={!newClient.name || !newClient.email || !newClient.phone}
                                  className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ajouter le client
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="text-white border-white/20 hover:bg-white/10"
                                  onClick={() => {
                                    setShowNewClientForm(false);
                                    setNewClient({ name: '', email: '', phone: '' });
                                  }}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Questions */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Réponses</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-white block mb-2" htmlFor="chantier-metier">Quel est le type de projet ?</label>
                        <select
                          id="chantier-metier"
                          name="metier"
                          value={chantierInfo.metier}
                          onChange={(e) => {
                            const metier = e.target.value;
                            setChantierInfo({ ...chantierInfo, metier });
                            setQuestionnaireAnswers({});
                          }}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white"
                        >
                          <option value="">Sélectionner un type</option>
                          {Object.entries(TYPE_CHANTIER_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white block mb-2" htmlFor="chantier-surface">Quelle est la surface en m² ?</label>
                        <input
                          id="chantier-surface"
                          name="surface"
                          type="number"
                          value={chantierInfo.surface}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, surface: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: 50"
                        />
                      </div>
                      {chantierInfo.metier && getQuestionsForType(chantierInfo.metier).length > 0 && (
                        <EstimationQuestionnaire
                          type={chantierInfo.metier}
                          answers={questionnaireAnswers}
                          onChange={(id, value) => setQuestionnaireAnswers((prev) => ({ ...prev, [id]: value }))}
                        />
                      )}
                      {chantierInfo.metier && !hasQuestionsForType(chantierInfo.metier) && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-white block mb-2" htmlFor="chantier-materiaux">Précisez le projet ou les matériaux</label>
                          <input
                            id="chantier-materiaux"
                            name="materiaux"
                            type="text"
                            value={chantierInfo.materiaux}
                            onChange={(e) => setChantierInfo({ ...chantierInfo, materiaux: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                            placeholder="Ex: Carrelage, Peinture, détail du projet..."
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-white block mb-2" htmlFor="chantier-localisation">Localisation ?</label>
                        <input
                          id="chantier-localisation"
                          name="localisation"
                          type="text"
                          value={chantierInfo.localisation}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, localisation: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: Paris 75001"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white block mb-2" htmlFor="chantier-delai">Délai souhaité ?</label>
                        <select
                          id="chantier-delai"
                          name="delai"
                          value={chantierInfo.delai}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, delai: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white"
                        >
                          <option value="">— Optionnel —</option>
                          <option value="ASAP">ASAP</option>
                          <option value="1-2 semaines">1–2 semaines</option>
                          <option value="2-4 semaines">2–4 semaines</option>
                          <option value="1-3 mois">1–3 mois</option>
                          <option value="Flexible">Flexible</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {questionnaireValidationErrors.length > 0 && (
                    <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-200 text-sm space-y-1">
                      {questionnaireValidationErrors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                  {photoAnalysisError && (
                    <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-200 text-sm">
                      Analyse photo : {photoAnalysisError} L&apos;estimation a été calculée sans la photo.
                    </div>
                  )}
                  {estimateError && (
                    <div className="p-4 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
                      {estimateError}
                    </div>
                  )}
                  <div className="flex justify-between mt-6">
                    <Button
                      variant="outline"
                      onClick={() => { setEstimateError(null); setStep(1); }}
                      disabled={isEstimating}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Retour
                    </Button>
                    <Button
                      onClick={handleLaunchAnalysis}
                      disabled={!chantierInfo.surface || !chantierInfo.metier || !allQuestionnaireAnswersFilled || isEstimating}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      {isEstimating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Estimation en cours...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Obtenir l&apos;estimation
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && analysisResults && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    Résultats de l'Analyse IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Récapitulatif de la saisie */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <User className="h-5 w-5 text-white/70" />
                      Récapitulatif de votre saisie
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedClient && (
                        <>
                          <div><span className="text-white/60">Client :</span> <span className="text-white">{selectedClient.name}</span></div>
                          {selectedClient.email && <div><span className="text-white/60">Email :</span> <span className="text-white">{selectedClient.email}</span></div>}
                          {selectedClient.phone && <div><span className="text-white/60">Tél :</span> <span className="text-white">{selectedClient.phone}</span></div>}
                        </>
                      )}
                      {chantierInfo.surface && <div><span className="text-white/60">Surface :</span> <span className="text-white">{chantierInfo.surface} m²</span></div>}
                      {chantierInfo.metier && <div><span className="text-white/60">Type :</span> <span className="text-white">{TYPE_CHANTIER_LABELS[chantierInfo.metier] ?? chantierInfo.metier}</span></div>}
                      {chantierInfo.materiaux && <div><span className="text-white/60">Matériaux :</span> <span className="text-white">{chantierInfo.materiaux}</span></div>}
                      {chantierInfo.localisation && <div><span className="text-white/60">Localisation :</span> <span className="text-white">{chantierInfo.localisation}</span></div>}
                      {chantierInfo.delai && <div><span className="text-white/60">Délai :</span> <span className="text-white">{chantierInfo.delai}</span></div>}
                    </div>
                  </div>

                  {/* Photo(s) du chantier (gardées en mémoire) */}
                  {images.length > 0 && (
                    <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Upload className="h-5 w-5 text-white/70" />
                        Photo(s) du chantier
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {images.slice(0, 6).map((img, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-white/10 w-24 h-24 flex-shrink-0">
                            <img src={img.preview} alt={`Chantier ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Résultat de l'analyse (photo) — affiché à l'étape 3 */}
                  {photoAnalysis && (
                    <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                      <h3 className="text-sm font-semibold text-white mb-2">Résultat de l&apos;analyse</h3>
                      <p className="text-white/90 text-sm whitespace-pre-wrap">{photoAnalysis.descriptionZone}</p>
                      {photoAnalysis.suggestions && (photoAnalysis.suggestions.typeProjet || photoAnalysis.suggestions.surfaceEstimee) && (
                        <p className="text-white/70 text-xs mt-2">
                          Suggestions : type {photoAnalysis.suggestions.typeProjet ?? '—'}, surface ~{photoAnalysis.suggestions.surfaceEstimee ?? '—'} m²
                        </p>
                      )}
                      {photoAnalysis.suggestions?.etatGeneral && (
                        <p className="text-white/60 text-xs mt-1">État général : {photoAnalysis.suggestions.etatGeneral}</p>
                      )}
                      {photoAnalysis.suggestions?.complexite && (
                        <p className="text-white/60 text-xs mt-0.5">Complexité : {photoAnalysis.suggestions.complexite}</p>
                      )}
                      {photoAnalysis.suggestions?.acces && (
                        <p className="text-white/60 text-xs mt-0.5">Accès : {photoAnalysis.suggestions.acces}</p>
                      )}
                      {photoAnalysis.suggestions?.pointsAttention && photoAnalysis.suggestions.pointsAttention.length > 0 && (
                        <div className="mt-2">
                          <p className="text-white/60 text-xs font-medium mb-1">Points d&apos;attention :</p>
                          <ul className="text-white/60 text-xs list-disc list-inside space-y-0.5">
                            {photoAnalysis.suggestions.pointsAttention.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Estimation du temps */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Estimation du temps de réalisation
                    </h3>
                    <p className="text-2xl font-bold text-white">{safeTempsRealisation}</p>
                    {safeTempsDecomposition && (safeTempsDecomposition.preparation || safeTempsDecomposition.travauxPrincipaux || safeTempsDecomposition.finitions || safeTempsDecomposition.imprevu) && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-sm text-white/80">
                        <p><span className="text-white/60">Décomposition :</span></p>
                        {safeTempsDecomposition.preparation && <p>• Préparation : {safeTempsDecomposition.preparation}</p>}
                        {safeTempsDecomposition.travauxPrincipaux && <p>• Travaux principaux : {safeTempsDecomposition.travauxPrincipaux}</p>}
                        {safeTempsDecomposition.finitions && <p>• Finitions : {safeTempsDecomposition.finitions}</p>}
                        {safeTempsDecomposition.imprevu && <p>• Imprévus : {safeTempsDecomposition.imprevu}</p>}
                      </div>
                    )}
                  </div>

                  {/* Liste des matériaux */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Liste des matériaux nécessaires
                    </h3>
                    <div className="space-y-2">
                      {safeMateriaux.length > 0 ? (
                        safeMateriaux.map((mat: { nom?: string; quantite?: string; prix?: number; prixUnitaire?: number; notes?: string }, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-black/10 rounded">
                            <div>
                              <p className="text-white font-medium">{mat.nom}</p>
                              <p className="text-sm text-white/70">{mat.quantite}{mat.notes ? ` — ${mat.notes}` : ''}</p>
                            </div>
                            <div className="text-right">
                              {mat.prixUnitaire != null && <p className="text-white/60 text-xs">P.U. {mat.prixUnitaire} €</p>}
                              <p className="text-white font-semibold">{mat.prix ?? 0} €</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-white/60 text-sm">Aucun matériau listé par l’estimation.</p>
                      )}
                    </div>
                  </div>

                  {/* Outils nécessaires */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Outils nécessaires
                    </h3>
                    {(safeOutilsALouer?.length || safeOutilsFournis?.length) ? (
                      <div className="space-y-4">
                        {safeOutilsALouer && safeOutilsALouer.length > 0 && (
                          <div>
                            <p className="text-white/80 font-medium text-sm mb-2">Équipements à louer</p>
                            <ul className="space-y-2">
                              {safeOutilsALouer.map((o, i) => (
                                <li key={i} className="flex items-start gap-2 text-white/90 text-sm">
                                  <span className="text-green-400 mt-0.5">•</span>
                                  <span>{o.nom}{o.duree ? ` (${o.duree})` : ''}{o.coutLocation != null ? ` — ${o.coutLocation} €` : ''}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {safeOutilsFournis && safeOutilsFournis.length > 0 && (
                          <div>
                            <p className="text-white/80 font-medium text-sm mb-2">Fournis par l’artisan</p>
                            <ul className="space-y-2">
                              {safeOutilsFournis.map((o, i) => (
                                <li key={i} className="flex items-start gap-2 text-white/90 text-sm">
                                  <span className="text-green-400 mt-0.5">•</span>
                                  <span>{o}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {safeEstimationLocationTotal != null && (
                          <p className="text-white/70 text-sm">Estimation location totale : <span className="font-semibold text-white">{safeEstimationLocationTotal} €</span></p>
                        )}
                      </div>
                    ) : safeOutils.length > 0 ? (
                      <ul className="space-y-2">
                        {safeOutils.map((outil: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-white/90">
                            <span className="text-green-400 mt-1">•</span>
                            <span>{outil}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-white/60 text-sm">Aucun outil listé.</p>
                    )}
                  </div>

                  {/* Équipe / Nombre d'ouvriers */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Équipe requise
                    </h3>
                    <p className="text-2xl font-bold text-white">{safeNombreOuvriers} ouvrier(s)</p>
                    {safeEquipe && (safeEquipe.composition || safeEquipe.joursPresence != null || safeEquipe.productivite) && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-sm text-white/80">
                        {safeEquipe.composition && <p><span className="text-white/60">Composition :</span> {safeEquipe.composition}</p>}
                        {safeEquipe.joursPresence != null && <p><span className="text-white/60">Jours de présence :</span> {safeEquipe.joursPresence}</p>}
                        {safeEquipe.productivite && <p><span className="text-white/60">Productivité :</span> {safeEquipe.productivite}</p>}
                      </div>
                    )}
                  </div>

                  {/* Coût total */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Coût total prévisionnel
                    </h3>
                    {safeCouts && (safeCouts.materiaux != null || safeCouts.mainOeuvre != null || safeCouts.prixTTC != null) ? (
                      <div className="space-y-2">
                        {safeCouts.materiaux != null && <div className="flex justify-between"><span className="text-white/70">Matériaux</span><span className="text-white font-semibold">{safeCouts.materiaux} €</span></div>}
                        {safeCouts.mainOeuvre != null && <div className="flex justify-between"><span className="text-white/70">Main-d’œuvre</span><span className="text-white font-semibold">{safeCouts.mainOeuvre} €</span></div>}
                        {safeCouts.transportLivraison != null && <div className="flex justify-between"><span className="text-white/70">Transport / livraison</span><span className="text-white font-semibold">{safeCouts.transportLivraison} €</span></div>}
                        {safeCouts.locationEquipements != null && <div className="flex justify-between"><span className="text-white/70">Location équipements</span><span className="text-white font-semibold">{safeCouts.locationEquipements} €</span></div>}
                        {safeCouts.sousTotal != null && <div className="flex justify-between"><span className="text-white/70">Sous-total</span><span className="text-white font-semibold">{safeCouts.sousTotal} €</span></div>}
                        {safeCouts.imprevu != null && <div className="flex justify-between"><span className="text-white/70">Imprévus (15%)</span><span className="text-white font-semibold">{safeCouts.imprevu} €</span></div>}
                        {safeCouts.coutDeBase != null && <div className="flex justify-between"><span className="text-white/70">Coût de base</span><span className="text-white font-semibold">{safeCouts.coutDeBase} €</span></div>}
                        {safeCouts.fraisGeneraux != null && <div className="flex justify-between"><span className="text-white/70">Frais généraux</span><span className="text-white font-semibold">{safeCouts.fraisGeneraux} €</span></div>}
                        {safeCouts.margeBrute != null && <div className="flex justify-between"><span className="text-white/70">Marge</span><span className="text-white font-semibold">{safeCouts.margeBrute} €</span></div>}
                        {safeCouts.prixTTC != null && <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-white font-semibold">Prix TTC estimé</span><span className="text-green-400 font-bold text-xl">{safeCouts.prixTTC} €</span></div>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/70">Coût de base</span>
                          <span className="text-white font-semibold">{safeCoutTotal} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Marge</span>
                          <span className="text-white font-semibold">{safeMarge} €</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2">
                          <span className="text-white font-semibold">Bénéfice estimé</span>
                          <span className="text-green-400 font-bold text-xl">{safeBenefice} €</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Graphique de répartition */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Répartition des coûts
                    </h3>
                    <div className="space-y-3">
                      {Object.keys(safeRepartitionCouts).length > 0 ? (
                        Object.entries(safeRepartitionCouts).map(([key, value]: [string, any]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/70 capitalize">{key === 'mainOeuvre' ? 'Main-d\'œuvre' : key}</span>
                              <span className="text-white font-semibold">{value} €</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-2">
                              <div
                                className="bg-white/30 h-2 rounded-full"
                                style={{ width: `${(safeCoutTotal ? (value / safeCoutTotal) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-white/60 text-sm">Aucune répartition fournie.</p>
                      )}
                    </div>
                  </div>

                  {/* Recommandations */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Recommandations automatiques
                    </h3>
                    {safeRecommandations.length > 0 ? (
                      <ul className="space-y-2">
                        {safeRecommandations.map((rec: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-white/90">
                            <span className="text-green-400 mt-1">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-white/60 text-sm">Aucune recommandation fournie.</p>
                    )}
                  </div>

                  {/* Hypothèses */}
                  {safeHypotheses && safeHypotheses.length > 0 && (
                    <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        Hypothèses utilisées
                      </h3>
                      <ul className="space-y-2">
                        {safeHypotheses.map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-white/90 text-sm">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Confiance */}
                  {(safeConfiance != null || safeConfianceExplication) && (
                    <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        Niveau de confiance
                      </h3>
                      {safeConfiance != null && (
                        <p className="text-2xl font-bold text-white">{(safeConfiance * 100).toFixed(0)} %</p>
                      )}
                      {safeConfianceExplication && (
                        <p className="text-white/80 text-sm mt-2">{safeConfianceExplication}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleExportPdf}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Exporter en PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCreateChantierFromEstimation}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Créer un chantier
                    </Button>
                    <Button
                      onClick={() => {
                        setStep(1);
                        setImages([]);
                        setSelectedClient(null);
                        setChantierInfo({ surface: '', materiaux: '', localisation: '', delai: '', metier: '' });
                        setAnalysisResults(null);
                        setPhotoAnalysis(null);
                        setPhotoAnalysisError(null);
                        setQuestionnaireAnswers({});
                      }}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30"
                    >
                      Nouvelle estimation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageWrapper>
  );
}
