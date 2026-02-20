import { useState, useRef } from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { getApiPostHeaders } from '@/lib/apiHeaders';
import { useAuth } from '@/context/AuthContext';
import { useTeamEffectiveUserId } from '@/context/TeamEffectiveUserIdContext';
import { uploadFile } from '@/lib/supabaseStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAccountButton } from '@/components/UserAccountButton';
import {
  Upload,
  Image as ImageIcon,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
interface UploadedImage {
  file: File;
  preview: string;
}

export default function AIVisualizationPage() {
  const { user, session } = useAuth();
  const effectiveUserId = useTeamEffectiveUserId();
  const userId = effectiveUserId ?? user?.id ?? null;
  const [step, setStep] = useState<'upload' | 'configure' | 'generating' | 'result'>('upload');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [progress, setProgress] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function getBase64FromPreview(preview: string): Promise<{ imageBase64: string; mimeType: string }> {
    if (preview.startsWith('data:')) {
      const match = preview.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match?.[1]?.trim() || 'image/jpeg';
      const imageBase64 = match?.[2]?.trim() || preview.split(',')[1]?.trim() || '';
      return { imageBase64, mimeType };
    }
    const res = await fetch(preview);
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '').trim();
        resolve({ imageBase64: base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const projectTypes = [
    { id: 'piscine', name: 'Piscine & Spa', icon: '🏊‍♂️', description: 'Piscines creusées, hors-sol, spas' },
    { id: 'paysage', name: 'Aménagement Paysager', icon: '🌳', description: 'Jardins, terrasses, allées' },
    { id: 'menuiserie', name: 'Menuiserie Extérieure', icon: '🔨', description: 'Pergolas, clôtures, abris' },
    { id: 'terrasse', name: 'Terrasse & Patio', icon: '🏡', description: 'Terrasses bois, pierre, composite' }
  ];

  const styles = [
    { id: 'moderne', name: 'Moderne', description: 'Lignes épurées, matériaux contemporains' },
    { id: 'traditionnel', name: 'Traditionnel', description: 'Style classique, matériaux naturels' },
    { id: 'tropical', name: 'Tropical', description: 'Végétation luxuriante, ambiance exotique' },
    { id: 'mediterraneen', name: 'Méditerranéen', description: 'Pierre, olivier, couleurs chaudes' }
  ];

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (userId) {
      setUploadingImage(true);
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${userId}/visualizations/${Date.now()}-${safeName}`;
        const url = await uploadFile(path, file);
        setUploadedImage({ file, preview: url });
        setStep('configure');
      } catch (err) {
        console.error('Upload failed:', err);
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedImage({ file, preview: e.target?.result as string });
          setStep('configure');
        };
        reader.readAsDataURL(file);
      } finally {
        setUploadingImage(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage({
          file,
          preview: e.target?.result as string
        });
        setStep('configure');
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const generateVisualization = async () => {
    if (!uploadedImage) return;
    setStep('generating');
    setProgress(0);
    setGenerationError(null);
    setGeneratedImageUrl(null);
    const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '::1'
      ? `http://127.0.0.1:${window.location.port || '5000'}`
      : window.location.origin;
    const apiUrl = `${apiBase}/api/generate-visualization`;
    try {
      let body: { imageUrl?: string; imageBase64?: string; mimeType?: string; projectType: string; style: string };
      if (uploadedImage.preview.startsWith('http')) {
        body = { imageUrl: uploadedImage.preview, projectType: selectedProjectType, style: selectedStyle };
      } else {
        const { imageBase64, mimeType } = await getBase64FromPreview(uploadedImage.preview);
        body = { imageBase64, mimeType, projectType: selectedProjectType, style: selectedStyle };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: getApiPostHeaders(session?.access_token),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({})) as { message?: string; imageUrl?: string; images?: Array<{ url?: string }> };
      if (!res.ok) {
        const raw = typeof data?.message === 'string' ? data.message : 'La génération a échoué.';
        const message = /replicate|REPLICATE_API/i.test(raw) ? 'Impossible d\'obtenir l\'aperçu. Réessayez.' : raw;
        setGenerationError(message);
        toast({ title: 'Erreur', description: message, variant: 'destructive' });
        return;
      }
      let imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : undefined;
      if (!imageUrl && Array.isArray(data?.images) && data.images[0] && typeof data.images[0].url === 'string') {
        imageUrl = data.images[0].url;
      }
      const isValidImageUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'));
      if (isValidImageUrl) {
        setGeneratedImageUrl(imageUrl);
        setStep('result');
      } else {
        const raw = typeof data?.message === 'string' ? data.message : 'Le serveur n\'a pas renvoyé d\'image.';
        const msg = /replicate|REPLICATE_API/i.test(raw) ? 'Impossible d\'obtenir l\'aperçu. Réessayez.' : raw;
        setGenerationError(msg);
        toast({ title: 'Erreur', description: 'Réponse invalide du serveur.', variant: 'destructive' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau. Réessayez.';
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setGenerationError(isAbort ? 'Délai dépassé.' : message);
      toast({ title: 'Erreur', description: isAbort ? 'Délai dépassé.' : message, variant: 'destructive' });
    }
  };

  const handleDownloadGenerated = async () => {
    if (!generatedImageUrl) return;
    try {
      if (generatedImageUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = generatedImageUrl;
        a.download = `rendu-visualisation-${Date.now()}.png`;
        a.click();
        toast({ title: 'Téléchargement démarré' });
        return;
      }
      const res = await fetch(generatedImageUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rendu-visualisation-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: 'Téléchargement démarré' });
    } catch {
      window.open(generatedImageUrl, '_blank');
    }
  };

  const resetProcess = () => {
    setStep('upload');
    setUploadedImage(null);
    setSelectedProjectType('');
    setSelectedStyle('');
    setProgress(0);
    setGeneratedImageUrl(null);
    setGenerationError(null);
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0 sm:flex-nowrap">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              Visualisation
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Prévisualisez votre projet avec type et style</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end w-full sm:w-auto">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Badge variant={step === 'upload' ? 'default' : 'secondary'}>1. Upload</Badge>
            <Badge variant={step === 'configure' ? 'default' : 'secondary'}>2. Config</Badge>
            <Badge variant={step === 'generating' ? 'default' : 'secondary'}>3. Génér.</Badge>
            <Badge variant={step === 'result' ? 'default' : 'secondary'}>4. Résultat</Badge>
            </div>
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
                    <ImageIcon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle>Uploadez votre photo de terrain</CardTitle>
                  <p className="text-white/70">
                    Sélectionnez une photo claire de l'espace à aménager pour obtenir le meilleur rendu
                  </p>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors cursor-pointer bg-black/10 ${uploadingImage ? 'pointer-events-none opacity-70' : ''}`}
                    onClick={() => !uploadingImage && fileInputRef.current?.click()}
                    data-testid="upload-zone"
                  >
                    <Upload className="h-12 w-12 mx-auto text-white/70 mb-4" />
                    <p className="text-lg font-medium mb-2 text-white">
                      {uploadingImage ? 'Upload en cours...' : 'Cliquez pour sélectionner une photo'}
                    </p>
                    <p className="text-sm text-white/70">
                      Formats supportés: JPG, PNG, WEBP • Max 10MB
                    </p>
                  </div>
                  <input
                    id="ai-viz-file-input"
                    name="aiVizImage"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="file-input"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && uploadedImage && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image Preview */}
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
                  <CardHeader>
                    <CardTitle>Image téléchargée</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={uploadedImage.preview}
                      alt="Terrain à aménager"
                      className="w-full h-64 object-cover rounded-lg"
                      data-testid="uploaded-image-preview"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-change-image"
                    >
                      Changer d'image
                    </Button>
                  </CardContent>
                </Card>

                {/* Configuration */}
                <div className="space-y-6">
                  {/* Project Type */}
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
                    <CardHeader>
                      <CardTitle>Type de projet</CardTitle>
                      <p className="text-sm text-muted-foreground">Sélectionnez le type d'aménagement souhaité</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3">
                      {projectTypes.map((type) => (
                        <div
                          key={type.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all text-white ${
                            selectedProjectType === type.id 
                              ? 'border-white/10 bg-black/20' 
                              : 'border-white/20 hover:border-white/40 bg-black/10'
                          }`}
                          onClick={() => setSelectedProjectType(type.id)}
                          data-testid={`project-type-${type.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{type.icon}</span>
                            <div>
                              <h4 className="font-medium">{type.name}</h4>
                              <p className="text-sm text-white/70">{type.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Style */}
                  {selectedProjectType && (
                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
                      <CardHeader>
                        <CardTitle>Style de rendu</CardTitle>
                        <p className="text-sm text-muted-foreground">Choisissez l'ambiance désirée</p>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3">
                        {styles.map((style) => (
                          <div
                            key={style.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-all text-white ${
                              selectedStyle === style.id 
                                ? 'border-white/10 bg-black/20' 
                                : 'border-white/20 hover:border-white/40 bg-black/10'
                            }`}
                            onClick={() => setSelectedStyle(style.id)}
                            data-testid={`style-${style.id}`}
                          >
                            <h4 className="font-medium">{style.name}</h4>
                            <p className="text-sm text-muted-foreground">{style.description}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {selectedProjectType && selectedStyle && (
                    <Button 
                      className="w-full" 
                      onClick={generateVisualization}
                      data-testid="button-generate"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Obtenir l'aperçu
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 'generating' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="hover-elevate text-center bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                {generationError ? (
                  <>
                    <CardHeader>
                      <div className="w-16 h-16 mx-auto rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                      </div>
                      <CardTitle>Échec de la génération</CardTitle>
                      <p className="text-white/70">{generationError}</p>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={generateVisualization} data-testid="button-retry">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Réessayer la génération
                      </Button>
                      <Button variant="outline" className="ml-3" onClick={() => { setGenerationError(null); setStep('configure'); }}>
                        Retour à la configuration
                      </Button>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
                        <RefreshCw className="h-8 w-8 text-white animate-spin" />
                      </div>
                      <CardTitle>Préparation de l'aperçu...</CardTitle>
                      <p className="text-white/70">
                        Préparation en cours.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress value={undefined} className="w-full h-2 [&>div]:animate-pulse" data-testid="generation-progress" />
                      <p className="text-sm text-muted-foreground">Préparation en cours...</p>
                    </CardContent>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && uploadedImage && (
            <div className="max-w-6xl mx-auto space-y-6">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <CardTitle>Aperçu prêt</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-download"
                      onClick={handleDownloadGenerated}
                      disabled={!generatedImageUrl}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetProcess} data-testid="button-new-render">
                      Nouveau rendu
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Before */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Avant</h3>
                      <img
                        src={uploadedImage.preview}
                        alt="Terrain original"
                        className="w-full h-80 object-cover rounded-lg border"
                        data-testid="before-image"
                      />
                      <Badge variant="outline">Image originale</Badge>
                    </div>

                    {/* After */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Après - Aperçu</h3>
                      <div className="w-full h-80 bg-black/20 backdrop-blur-xl border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                        {generatedImageUrl ? (
                          <img
                            src={generatedImageUrl}
                            alt="Aperçu"
                            className="w-full h-full object-cover rounded-lg"
                            data-testid="after-image"
                          />
                        ) : (
                          <div className="text-center space-y-2 p-4">
                            <ImageIcon className="h-12 w-12 mx-auto text-white" />
                            <p className="text-lg font-medium">Aperçu</p>
                            <p className="text-sm text-muted-foreground">
                              {generationError ? generationError : 'Chargement de l\'aperçu...'}
                            </p>
                            {generationError && (
                              <Button size="sm" onClick={generateVisualization} className="mt-2">
                                Réessayer la génération
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge className="bg-black/20 backdrop-blur-md border border-white/10 text-white">
                        Visualisation
                      </Badge>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="mt-6 p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h4 className="font-semibold mb-2 text-white">Détails du projet</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white/70">Type de projet:</span>
                        <span className="ml-2 font-medium text-white">{projectTypes.find(p => p.id === selectedProjectType)?.name}</span>
                      </div>
                      <div>
                        <span className="text-white/70">Style appliqué:</span>
                        <span className="ml-2 font-medium text-white">{styles.find(s => s.id === selectedStyle)?.name}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Hidden file input for step 2 */}
          <input
            id="ai-viz-file-input-step2"
            name="aiVizImageStep2"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </main>
    </PageWrapper>
  );
}