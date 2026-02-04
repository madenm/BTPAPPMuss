import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/lib/supabaseUserProfile";

const DEFAULT_THEME_COLOR = "#8b5cf6";

interface UserSettingsContextType {
  profile: UserProfile | null;
  loading: boolean;
  logoUrl: string | null;
  themeColor: string;
  refetch: () => Promise<void>;
  setLogoUrl: (url: string | null) => Promise<void>;
  setThemeColor: (color: string) => Promise<void>;
  setCompanyInfo: (payload: {
    company_address?: string | null;
    company_city_postal?: string | null;
    company_phone?: string | null;
    company_email?: string | null;
    company_siret?: string | null;
  }) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(
  undefined
);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await fetchUserProfile(user.id);
      setProfile(p ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const color = profile?.theme_color ?? DEFAULT_THEME_COLOR;
    document.documentElement.style.setProperty("--color-primary", color);
  }, [profile?.theme_color]);

  const refetch = useCallback(() => loadProfile(), [loadProfile]);

  const setLogoUrl = useCallback(
    async (url: string | null) => {
      if (!user?.id) return;
      await updateUserProfile(user.id, { logo_url: url });
      await loadProfile();
    },
    [user?.id, loadProfile]
  );

  const setThemeColor = useCallback(
    async (color: string) => {
      if (!user?.id) return;
      await updateUserProfile(user.id, { theme_color: color });
      await loadProfile();
    },
    [user?.id, loadProfile]
  );

  const setCompanyInfo = useCallback(
    async (payload: {
      company_address?: string | null;
      company_city_postal?: string | null;
      company_phone?: string | null;
      company_email?: string | null;
      company_siret?: string | null;
    }) => {
      if (!user?.id) return;
      await updateUserProfile(user.id, payload);
      await loadProfile();
    },
    [user?.id, loadProfile]
  );

  const value: UserSettingsContextType = {
    profile,
    loading,
    logoUrl: profile?.logo_url ?? null,
    themeColor: profile?.theme_color ?? DEFAULT_THEME_COLOR,
    refetch,
    setLogoUrl,
    setThemeColor,
    setCompanyInfo,
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext);
  if (ctx === undefined) {
    throw new Error("useUserSettings must be used within UserSettingsProvider");
  }
  return ctx;
}
