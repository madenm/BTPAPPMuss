import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Users } from 'lucide-react';

export default function ProspectsPage() {
  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Gestion des Prospects
            </h1>
            <p className="text-sm text-white/70">CRM intégré pour suivre vos leads</p>
          </div>
          <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md text-center bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
          <CardHeader className="pb-4">
            <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-xl text-white">CRM Bientôt Disponible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">
              Le module de gestion des prospects arrive prochainement ! Gérez vos leads, 
              suivez vos rendez-vous et transformez vos contacts en clients.
            </p>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span>Suivi des leads</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span>Calendrier RDV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Historique client</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </PageWrapper>
  );
}