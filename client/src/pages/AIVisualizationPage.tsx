import { useState, useRef } from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { useAuth } from '@/context/AuthContext';
import { uploadFile } from '@/lib/supabaseStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAccountButton } from '@/components/UserAccountButton';
import { 
  Wand2, 
  Upload, 
  Image as ImageIcon, 
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle
} from 'lucide-react';

interface UploadedImage {
  file: File;
  preview: string;
}

export default function AIVisualizationPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'configure' | 'generating' | 'result'>('upload');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (user?.id) {
      setUploadingImage(true);
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/visualizations/${Date.now()}-${safeName}`;
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

  const generateVisualization = () => {
    setStep('generating');
    setProgress(0);
    
    // Simulate AI generation progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('result');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const resetProcess = () => {
    setStep('upload');
    setUploadedImage(null);
    setSelectedProjectType('');
    setSelectedStyle('');
    setProgress(0);
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 ml-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Visualisation IA
            </h1>
            <p className="text-sm text-white/70">Générez des rendus professionnels de vos projets</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
            <Badge variant={step === 'upload' ? 'default' : 'secondary'}>1. Upload</Badge>
            <Badge variant={step === 'configure' ? 'default' : 'secondary'}>2. Configuration</Badge>
            <Badge variant={step === 'generating' ? 'default' : 'secondary'}>3. Génération</Badge>
            <Badge variant={step === 'result' ? 'default' : 'secondary'}>4. Résultat</Badge>
            </div>
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 ml-20">
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
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer la visualisation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 'generating' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="hover-elevate text-center">
                <CardHeader>
                  <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
                    <RefreshCw className="h-8 w-8 text-white animate-spin" />
                  </div>
                  <CardTitle>Génération en cours...</CardTitle>
                  <p className="text-white/70">
                    Notre IA analyse votre terrain et génère le rendu professionnel
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={progress} className="w-full" data-testid="generation-progress" />
                  <p className="text-sm text-muted-foreground">
                    {progress < 30 && "Analyse de l'image..."}
                    {progress >= 30 && progress < 60 && "Application du style..."}
                    {progress >= 60 && progress < 90 && "Génération du rendu..."}
                    {progress >= 90 && "Finalisation..."}
                  </p>
                </CardContent>
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
                    <CardTitle>Visualisation générée avec succès !</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid="button-download">
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
                      <h3 className="text-lg font-semibold">Après - Rendu IA</h3>
                      <div className="w-full h-80 bg-black/20 backdrop-blur-xl border border-white/10 rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Sparkles className="h-12 w-12 mx-auto text-white" />
                          <p className="text-lg font-medium">Rendu IA généré</p>
                          <p className="text-sm text-muted-foreground">
                            Ici apparaîtrait le rendu professionnel<br />
                            avec votre {selectedProjectType} en style {selectedStyle}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-black/20 backdrop-blur-md border border-white/10 text-white">
                        Généré par IA
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