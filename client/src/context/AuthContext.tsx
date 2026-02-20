import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, setRememberMe } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Récupérer la session initiale
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Error getting session:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Validation basique avant l'appel API
    if (!email || !password) {
      return { error: { message: 'Email et mot de passe requis', status: 400 } };
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    });

    // Profil créé côté serveur par le trigger handle_new_user (auth.users) ; pas d'upsert client pour éviter 401/RLS quand la confirmation email est requise.
    if (!error && data.user) {
      // Rien à faire : le trigger on_auth_user_created crée la ligne user_profiles.
    }

    return { error };
  };

  /** Nettoie la session membre d'équipe (localStorage/sessionStorage) pour éviter d'afficher le dashboard équipe après déconnexion ou connexion propriétaire. */
  const clearTeamMemberSession = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('userType');
    localStorage.removeItem('teamMember');
    localStorage.removeItem('teamMemberLoginCode');
    sessionStorage.removeItem('teamMemberLoginCode');
  };

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    // Validation basique avant l'appel API
    if (!email || !password) {
      return { error: { message: 'Email et mot de passe requis', status: 400 } };
    }
    setRememberMe(rememberMe ?? true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    // Mise à jour immédiate du contexte pour éviter la race : redirect avant onAuthStateChange
    if (!error && data?.session) {
      clearTeamMemberSession(); // Connexion propriétaire = plus de contexte membre d'équipe
      setSession(data.session);
      setUser(data.session.user ?? null);
      setLoading(false);
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearTeamMemberSession();
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth`,
      },
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      return { error: { message: 'Le mot de passe doit contenir au moins 6 caractères.', status: 400 } };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resendConfirmationEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
