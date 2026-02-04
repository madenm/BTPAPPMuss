import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Mail, Phone, MapPin } from 'lucide-react';

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    console.log(`${name} updated:`, value); // todo: remove mock functionality
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData); // todo: remove mock functionality
    // Reset form
    setFormData({ name: '', email: '', company: '', message: '' });
  };

  return (
    <section className="py-24 bg-gradient-to-b from-muted/20 to-background" id="contact">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">Prêt à</span>{' '}
            <span className="text-white">
              Commencer ?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Rejoignez les artisans qui utilisent déjà ArtisanPro pour digitaliser et développer leur activité.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="text-2xl">Demander une Démo</CardTitle>
              <p className="text-muted-foreground">
                Découvrez comment ArtisanPro peut révolutionner votre entreprise artisanale.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      Nom complet *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Jean Dupont"
                      required
                      data-testid="input-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email professionnel *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="jean@piscines-dupont.fr"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-2">
                    Nom de l'entreprise
                  </label>
                  <Input
                    id="company"
                    name="company"
                    type="text"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Piscines Dupont, Menuiserie Martin..."
                    data-testid="input-company"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Parlez-nous de vos besoins..."
                    rows={4}
                    data-testid="textarea-message"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30"
                  data-testid="button-submit-contact"
                >
                  Demander une Démo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info & CTA */}
          <div className="space-y-8">
            <Card className="hover-elevate">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Rejoignez ArtisanPro</h3>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-muted-foreground">Accès complet à toutes les fonctionnalités</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-muted-foreground">Configuration et formation incluses</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                    <span className="text-muted-foreground">Support prioritaire 7j/7</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-muted-foreground">Plateforme sécurisée</span>
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => console.log('Join clicked')} // todo: remove mock functionality
                  data-testid="button-join"
                >
                  S'inscrire maintenant
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Nous Contacter</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-white" />
                    <span className="text-muted-foreground">contact@artisanpro.fr</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-white" />
                    <span className="text-muted-foreground">+33 1 23 45 67 89</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-green-400" />
                    <span className="text-muted-foreground">Paris, France</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}