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

    if (!error && data.user) {
      // Le trigger SQL créera automatiquement le profil, mais on essaie quand même côté client
      // pour être sûr (en cas d'échec du trigger ou si l'utilisateur existe déjà)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: email,
          full_name: fullName || '',
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Ne pas bloquer l'inscription si le profil échoue (le trigger SQL devrait le créer)
        // Si la table n'existe pas, c'est normal - le trigger SQL la créera automatiquement
        if (profileError.code === 'PGRST205') {
          console.warn('User profile table does not exist yet. The SQL trigger should create it automatically. Make sure you have executed the supabase-schema.sql script in Supabase.');
        }
      }
    }

    return { error };
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
      setSession(data.session);
      setUser(data.session.user ?? null);
      setLoading(false);
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resendConfirmationEmail }}>
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
