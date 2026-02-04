import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth, AuthContext } from '@/context/AuthContext';
import {
  fetchChantiersForUser,
  fetchChantiersForTeamMember,
  insertChantier as insertChantierRemote,
  updateChantierRemote,
  type NewChantierPayload,
} from '@/lib/supabaseChantiers';
import {
  fetchClientsForUser,
  insertClient as insertClientRemote,
  type Client,
  type NewClientPayload,
} from '@/lib/supabaseClients';
import { fetchChantierAssignmentsByTeamMember } from '@/lib/supabase';

export type { Client };

export type TypeChantier = 'piscine' | 'paysage' | 'menuiserie' | 'renovation' | 'autre';

export interface Chantier {
  id: string;
  nom: string;
  clientId: string;
  clientName: string;
  dateDebut: string;
  duree: string;
  images: string[];
  statut: 'planifié' | 'en cours' | 'terminé';
  notes?: string;
  typeChantier?: TypeChantier | string;
  notesAvancement?: string;
  montantDevis?: number;
}

interface ChantiersContextType {
  clients: Client[];
  chantiers: Chantier[];
  loading: boolean;
  error: string | null;
  addClient: (payload: NewClientPayload) => Promise<Client>;
  addChantier: (payload: NewChantierPayload) => Promise<Chantier>;
  updateChantier: (id: string, updates: Partial<Chantier>) => Promise<void>;
  refreshChantiers: () => void;
}

const ChantiersContext = createContext<ChantiersContextType | undefined>(undefined);

export function ChantiersProvider({ children }: { children: ReactNode }) {
  // Utiliser useContext directement pour éviter l'erreur si AuthProvider n'est pas encore monté
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;

  const [clients, setClients] = useState<Client[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const [chantiersRefreshKey, setChantiersRefreshKey] = useState(0);

  // Charger les clients de l'utilisateur connecté
  useEffect(() => {
    if (!user) {
      setClients([]);
      return;
    }
    const loadClients = async () => {
      try {
        const data = await fetchClientsForUser(user.id);
        setClients(data);
      } catch (e) {
        console.error('Error loading clients', e);
      }
    };
    void loadClients();
  }, [user?.id]);

  // Charger les chantiers : utilisateur connecté (Supabase) ou membre d'équipe (localStorage)
  useEffect(() => {
    const load = async () => {
      const userType = typeof window !== 'undefined' ? localStorage.getItem('userType') : null;
      const teamMemberJson = typeof window !== 'undefined' ? localStorage.getItem('teamMember') : null;
      const isTeamMember = userType === 'team' && teamMemberJson;

      if (!user && !isTeamMember) {
        setChantiers([]);
        return;
      }

      if (loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // #region agent log
        const teamMemberForLog = teamMemberJson ? (JSON.parse(teamMemberJson) as { id: string }) : null;
        fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChantiersContext.tsx:load:branch', message: 'which load branch', data: { hasUser: !!user, isTeamMember, teamMemberId: teamMemberForLog?.id }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,D,E' }) }).catch(() => {});
        // #endregion
        if (user) {
          const data = await fetchChantiersForUser(user.id);
          if (isTeamMember) {
            try {
              const teamMember = JSON.parse(teamMemberJson!) as { id: string };
              const assignedIds = await fetchChantierAssignmentsByTeamMember(teamMember.id);
              const filtered = assignedIds.length > 0 ? data.filter((c) => assignedIds.includes(c.id)) : [];
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChantiersContext.tsx:load:admin+team', message: 'filtered for team', data: { assignedIdsLength: assignedIds.length, assignedIds, dataLength: data.length, filteredLength: filtered.length, filteredIds: filtered.map((c) => c.id) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => {});
              // #endregion
              setChantiers(filtered);
            } catch {
              setChantiers(data);
            }
          } else {
            setChantiers(data);
          }
        } else {
          const teamMember = JSON.parse(teamMemberJson!) as { id: string };
          const data = await fetchChantiersForTeamMember(teamMember.id);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7368fd83-5944-4f0a-b197-039e814236a5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChantiersContext.tsx:load:teamOnly', message: 'setChantiers team path', data: { dataLength: data.length, ids: data.map((c) => c.id) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,D' }) }).catch(() => {});
          // #endregion
          setChantiers(data);
        }
      } catch (e: any) {
        console.error('Error loading chantiers', e);
        setError('Impossible de charger les chantiers.');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    void load();
  }, [user?.id, chantiersRefreshKey]);

  const refreshChantiers = useCallback(() => {
    setChantiersRefreshKey(k => k + 1);
  }, []);

  const addClient = async (payload: NewClientPayload): Promise<Client> => {
    if (!user) {
      console.error('addClient called without authenticated user');
      throw new Error('User not authenticated');
    }
    const created = await insertClientRemote(user.id, payload);
    setClients(prev => [created, ...prev]);
    return created;
  };

  const addChantier = async (payload: NewChantierPayload): Promise<Chantier> => {
    if (!user) {
      console.error('addChantier called without authenticated user');
      throw new Error('User not authenticated');
    }
    const created = await insertChantierRemote(user.id, payload);
    setChantiers(prev => [created, ...prev]);
    return created;
  };

  const updateChantier = async (id: string, updates: Partial<Chantier>) => {
    if (!user) {
      console.error('updateChantier called without authenticated user');
      return;
    }
    const updated = await updateChantierRemote(id, user.id, updates);
    setChantiers(prev => prev.map(c => (c.id === id ? updated : c)));
  };

  return (
    <ChantiersContext.Provider
      value={{ clients, chantiers, loading, error, addClient, addChantier, updateChantier, refreshChantiers }}
    >
      {children}
    </ChantiersContext.Provider>
  );
}

export function useChantiers() {
  const context = useContext(ChantiersContext);
  if (context === undefined) {
    throw new Error('useChantiers must be used within a ChantiersProvider');
  }
  return context;
}
