import { Link } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, ArrowLeft } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-8 w-8 text-violet-500" />
            <h1 className="text-2xl font-bold">Passer en Pro</h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            La page tarifs et passage au plan Pro est en cours de préparation.
          </p>
          <p className="text-sm text-muted-foreground">
            Contactez-nous pour un passage en Pro ou revenez plus tard.
          </p>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
