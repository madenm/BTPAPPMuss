import { Card, CardContent } from '@/components/ui/card';
import { FileText, Wand2, Users, Calendar, Euro, Camera } from 'lucide-react';
import dashboardImage from '@assets/generated_images/Dashboard_interface_mockup_f808bffd.png';
import photoEnhancementImage from '@assets/generated_images/Photo_enhancement_comparison_c1eb7a8f.png';

export default function FeaturesSection() {
  const features = [
    {
      icon: <FileText className="h-8 w-8 text-white" />,
      title: "Générateur de Devis",
      description: "Créez des devis professionnels en quelques clics. Templates personnalisables pour piscines, paysage, menuiserie et plus.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
    {
      icon: <Wand2 className="h-8 w-8 text-white" />,
      title: "Visualisation IA",
      description: "Uploadez une photo du terrain, sélectionnez votre projet et l'IA génère un rendu professionnel pour impressionner vos clients.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
    {
      icon: <Users className="h-8 w-8 text-white" />,
      title: "Gestion des Prospects",
      description: "CRM intégré pour suivre vos leads, organiser vos rendez-vous et transformer vos prospects en clients fidèles.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
    {
      icon: <Calendar className="h-8 w-8 text-white" />,
      title: "Planning Chantiers",
      description: "Calendrier intelligent pour planifier vos interventions, suivre l'avancement et respecter vos délais.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
    {
      icon: <Euro className="h-8 w-8 text-white" />,
      title: "Suivi Paiements",
      description: "Facturation automatique, suivi des encaissements et relances clients pour optimiser votre trésorerie.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
    {
      icon: <Camera className="h-8 w-8 text-white" />,
      title: "Portfolio Avant/Après",
      description: "Showcasez vos réalisations avec des portfolios automatiques. Génération PDF pour présenter vos références.",
      color: "bg-black/20 backdrop-blur-md border border-white/10",
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-background to-muted/20" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="text-white">
              Fonctionnalités
            </span>{' '}
            <span className="text-foreground">Complètes</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tout ce dont votre entreprise artisanale a besoin pour professionnaliser vos devis, gérer vos chantiers et impressionner vos clients.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="hover-elevate cursor-pointer group" data-testid={`card-feature-${index}`}>
              <CardContent className="p-6">
                <div className={`w-16 h-16 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dashboard Preview */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">
              Dashboard Complet
            </h3>
            <p className="text-lg text-muted-foreground">
              Notre interface vous donne un contrôle total sur votre activité artisanale. 
              Suivez vos chantiers, gérez vos prospects et optimisez votre productivité depuis un seul endroit.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">Suivi en temps réel de tous vos chantiers</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span className="text-muted-foreground">Génération automatique de devis professionnels</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">Analytics détaillées de votre activité</span>
              </li>
            </ul>
          </div>
          <div className="relative">
            <img 
              src={dashboardImage} 
              alt="Dashboard interface" 
              className="rounded-xl shadow-2xl w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-xl"></div>
          </div>
        </div>

        {/* Photo Enhancement Preview */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mt-24">
          <div className="relative order-2 lg:order-1">
            <img 
              src={photoEnhancementImage} 
              alt="Photo enhancement comparison" 
              className="rounded-xl shadow-2xl w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-xl"></div>
          </div>
          <div className="space-y-6 order-1 lg:order-2">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">
              Visualisation IA de Projets
            </h3>
            <p className="text-lg text-muted-foreground">
              Impressionnez vos clients avec des rendus professionnels de leurs futurs projets. 
              Uploadez une photo du terrain et obtenez une visualisation réaliste en quelques minutes.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">IA spécialisée pour piscines, paysage et menuiserie</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span className="text-muted-foreground">Rendus photoréalistes pour convaincre vos clients</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">Génération en moins de 5 minutes</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}