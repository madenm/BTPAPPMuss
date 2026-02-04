import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Lorsque `allowGuest` est à true, la route n'exige pas
   * que l'utilisateur soit authentifié. Utile pour exposer
   * certaines pages (ex: dashboard démo) sans login.
   */
  allowGuest?: boolean;
}

export function ProtectedRoute({ children, allowGuest = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user && !allowGuest) {
      setLocation('/auth');
    }
  }, [user, loading, allowGuest, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  if (!user && !allowGuest) {
    return null;
  }

  return <>{children}</>;
}

