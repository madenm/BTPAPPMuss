import { createContext, useContext, ReactNode } from 'react';

const TeamEffectiveUserIdContext = createContext<string | null>(null);

export function TeamEffectiveUserIdProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}) {
  return (
    <TeamEffectiveUserIdContext.Provider value={value}>
      {children}
    </TeamEffectiveUserIdContext.Provider>
  );
}

/** À utiliser dans les pages rendues dans le dashboard membre : retourne l'user_id du propriétaire quand un membre d'équipe consulte la page. */
export function useTeamEffectiveUserId(): string | null {
  return useContext(TeamEffectiveUserIdContext);
}
