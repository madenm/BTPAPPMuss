import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Upload, Wand2, Plus, Calculator, User, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { uploadFile } from '@/lib/supabaseStorage';

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

export default function EstimationPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });
  const [chantierInfo, setChantierInfo] = useState({
    surface: '',
    materiaux: '',
    localisation: '',
    delai: '',
    metier: ''
  });
  const [analysisResults, setAnalysisResults] = useState<any>(null);

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
    setImages(prev => [...prev, ...newUrls]);
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

  const handleLaunchAnalysis = () => {
    // TODO: Implement AI analysis API call
    // Simulate analysis results
    setAnalysisResults({
      tempsRealisation: '3 semaines',
      materiaux: [
        { nom: 'Carrelage', quantite: '50m²', prix: 800 },
        { nom: 'Colle carrelage', quantite: '5 sacs', prix: 150 },
        { nom: 'Joint carrelage', quantite: '3kg', prix: 50 }
      ],
      nombreOuvriers: 2,
      coutTotal: 2500,
      marge: 500,
      benefice: 300,
      repartitionCouts: {
        transport: 100,
        mainOeuvre: 1200,
        materiaux: 1000,
        autres: 200
      },
      recommandations: [
        'Prévoir un échafaudage pour les travaux en hauteur',
        'Outil spécifique nécessaire : coupe-carrelage électrique',
        'Vérifier l\'état des murs avant pose du carrelage'
      ]
    });
    setStep(3);
  };

  const handleCreateClient = () => {
    const client: Client = {
      id: Date.now().toString(),
      ...newClient
    };
    setSelectedClient(client);
    setNewClient({ name: '', email: '', phone: '' });
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-tl-3xl ml-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Estimation Automatique des Chantiers
            </h1>
            <p className="text-sm text-white/70">
              Étape {step}/3 - {step === 1 ? 'Import des photos' : step === 2 ? 'Informations du chantier' : 'Résultats de l\'analyse'}
            </p>
          </div>
          <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 py-6 ml-20">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-white/70" />
                    Import des Photos du Chantier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isDragging
                        ? 'border-white/40 bg-white/10'
                        : 'border-white/20 hover:border-white/30'
                    }`}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-white/70" />
                    <p className="text-lg font-medium text-white mb-2">
                      Glissez-déposez vos photos ici
                    </p>
                    <p className="text-sm text-white/60 mb-4">
                      ou cliquez pour sélectionner des fichiers
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button
                      variant="outline"
                      className="text-white border-white/20 hover:bg-white/10"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                      disabled={uploadingImages}
                    >
                      {uploadingImages ? 'Upload en cours...' : 'Sélectionner des photos'}
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
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={handleNext}
                      disabled={images.length === 0}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      Suivant
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
                    <User className="h-5 w-5 text-white/70" />
                    Informations du Chantier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Client Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Client</h3>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-white block mb-2">Nom</label>
                            <input
                              type="text"
                              value={newClient.name}
                              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                              className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                              placeholder="Nom du client"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-white block mb-2">Email</label>
                            <input
                              type="email"
                              value={newClient.email}
                              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                              className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                              placeholder="email@example.com"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-white block mb-2">Téléphone</label>
                            <input
                              type="tel"
                              value={newClient.phone}
                              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                              className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                              placeholder="06 12 34 56 78"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleCreateClient}
                          disabled={!newClient.name || !newClient.email || !newClient.phone}
                          className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter le client
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Chantier Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Informations du Chantier</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-white block mb-2">Surface (m²)</label>
                        <input
                          type="number"
                          value={chantierInfo.surface}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, surface: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: 50"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white block mb-2">Métier</label>
                        <select
                          value={chantierInfo.metier}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, metier: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white"
                        >
                          <option value="">Sélectionner un métier</option>
                          <option value="plombier">Plombier</option>
                          <option value="carreleur">Carreleur</option>
                          <option value="electricien">Électricien</option>
                          <option value="peintre">Peintre</option>
                          <option value="maçon">Maçon</option>
                          <option value="charpentier">Charpentier</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white block mb-2">Matériaux</label>
                        <input
                          type="text"
                          value={chantierInfo.materiaux}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, materiaux: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: Carrelage, Peinture"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-white block mb-2">Localisation</label>
                        <input
                          type="text"
                          value={chantierInfo.localisation}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, localisation: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: Paris 75001"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-white block mb-2">Délai souhaité</label>
                        <input
                          type="text"
                          value={chantierInfo.delai}
                          onChange={(e) => setChantierInfo({ ...chantierInfo, delai: e.target.value })}
                          className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
                          placeholder="Ex: 2 semaines"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Retour
                    </Button>
                    <Button
                      onClick={handleLaunchAnalysis}
                      disabled={!selectedClient || !chantierInfo.surface || !chantierInfo.metier}
                      className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Lancer l'analyse
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
                  {/* Estimation du temps */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Estimation du temps de réalisation
                    </h3>
                    <p className="text-2xl font-bold text-white">{analysisResults.tempsRealisation}</p>
                  </div>

                  {/* Liste des matériaux */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Liste des matériaux nécessaires
                    </h3>
                    <div className="space-y-2">
                      {analysisResults.materiaux.map((mat: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-black/10 rounded">
                          <div>
                            <p className="text-white font-medium">{mat.nom}</p>
                            <p className="text-sm text-white/70">{mat.quantite}</p>
                          </div>
                          <p className="text-white font-semibold">{mat.prix} €</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nombre d'ouvriers */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Estimation du nombre d'ouvriers requis
                    </h3>
                    <p className="text-2xl font-bold text-white">{analysisResults.nombreOuvriers} ouvrier(s)</p>
                  </div>

                  {/* Coût total */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Coût total prévisionnel
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/70">Coût de base</span>
                        <span className="text-white font-semibold">{analysisResults.coutTotal} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Marge</span>
                        <span className="text-white font-semibold">{analysisResults.marge} €</span>
                      </div>
                      <div className="flex justify-between border-t border-white/10 pt-2">
                        <span className="text-white font-semibold">Bénéfice estimé</span>
                        <span className="text-green-400 font-bold text-xl">{analysisResults.benefice} €</span>
                      </div>
                    </div>
                  </div>

                  {/* Graphique de répartition */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Répartition des coûts
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(analysisResults.repartitionCouts).map(([key, value]: [string, any]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/70 capitalize">{key === 'mainOeuvre' ? 'Main-d\'œuvre' : key}</span>
                            <span className="text-white font-semibold">{value} €</span>
                          </div>
                          <div className="w-full bg-black/20 rounded-full h-2">
                            <div
                              className="bg-white/30 h-2 rounded-full"
                              style={{ width: `${(value / analysisResults.coutTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommandations */}
                  <div className="p-4 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Recommandations automatiques
                    </h3>
                    <ul className="space-y-2">
                      {analysisResults.recommandations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-white/90">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={() => {
                        setStep(1);
                        setImages([]);
                        setSelectedClient(null);
                        setChantierInfo({ surface: '', materiaux: '', localisation: '', delai: '', metier: '' });
                        setAnalysisResults(null);
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
