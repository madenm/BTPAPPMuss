import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

interface ProtectedTeamRouteProps {
  children: React.ReactNode;
}

export function ProtectedTeamRoute({ children }: ProtectedTeamRouteProps) {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Vérifier si l'utilisateur est un membre d'équipe authentifié
    const storedMember = localStorage.getItem('teamMember');
    const userType = localStorage.getItem('userType');

    if (!storedMember || userType !== 'team') {
      // Rediriger vers la page de connexion si pas authentifié
      setLocation('/login');
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
  }, [setLocation]);

  // Afficher un écran de chargement pendant la vérification
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  // Ne rien afficher si non authentifié (redirection en cours)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
