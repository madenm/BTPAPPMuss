import { PageWrapper } from '@/components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAccountButton } from '@/components/UserAccountButton';
import { Euro } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Suivi des Paiements
            </h1>
            <p className="text-sm text-white/70">Facturation et gestion de trésorerie</p>
          </div>
          <UserAccountButton variant="inline" />
        </div>
      </header>

      <main className="flex-1 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md text-center bg-black/20 backdrop-blur-xl border border-white/10 text-white hover-elevate">
          <CardHeader className="pb-4">
            <div className="w-16 h-16 mx-auto rounded-xl bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4">
              <Euro className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-xl text-white">Gestion Financière</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">
              Le module de suivi des paiements est en développement ! Gérez vos factures, 
              suivez vos encaissements et optimisez votre trésorerie.
            </p>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span>Facturation automatique</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                <span>Suivi encaissements</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Relances automatiques</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </PageWrapper>
  );
}