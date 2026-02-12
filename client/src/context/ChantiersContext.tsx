import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth, AuthContext } from '@/context/AuthContext';
import {
  fetchChantiersForUser,
  fetchChantiersForTeamMember,
  insertChantier as insertChantierRemote,
  updateChantierRemote,
  softDeleteChantier as softDeleteChantierRemote,
  type NewChantierPayload,
} from '@/lib/supabaseChantiers';
import {
  fetchClientsForUser,
  insertClient as insertClientRemote,
  updateClient as updateClientRemote,
  softDeleteClient as softDeleteClientRemote,
  type Client,
  type NewClientPayload,
  type UpdateClientPayload,
} from '@/lib/supabaseClients';
import { fetchChantierAssignmentsByTeamMember } from '@/lib/supabase';
import { debugIngest } from '@/lib/debugIngest';

export type { Client };

export type TypeChantier = 'piscine' | 'paysage' | 'menuiserie' | 'renovation' | 'plomberie' | 'maconnerie' | 'terrasse' | 'chauffage' | 'isolation' | 'electricite' | 'peinture' | 'autre';

export interface Chantier {
  id: string;
  nom: string;
  clientId: string;
  clientName: string;
  dateDebut: string;
  dateFin?: string;
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
  updateClient: (id: string, payload: UpdateClientPayload) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  addChantier: (payload: NewChantierPayload) => Promise<Chantier>;
  updateChantier: (id: string, updates: Partial<Chantier>) => Promise<void>;
  deleteChantier: (id: string) => Promise<void>;
  refreshChantiers: () => void;
  refreshClients: () => void;
}

const ChantiersContext = createContext<ChantiersContextType | undefined>(undefined);

export function ChantiersProvider({ children }: { children: ReactNode }) {
  // Utiliser useContext directement pour éviter l'erreur si AuthProvider n'est pas encore monté
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const ownerId = user?.id ?? (typeof window !== 'undefined' ? window.__AOS_TEAM_EFFECTIVE_USER_ID__ : null);

  const [clients, setClients] = useState<Client[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const [chantiersRefreshKey, setChantiersRefreshKey] = useState(0);
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);

  // Charger les clients : utilisateur connecté ou membre d'équipe (owner id via global)
  useEffect(() => {
    if (!ownerId) {
      setClients([]);
      return;
    }
    const loadClients = async () => {
      try {
        const data = await fetchClientsForUser(ownerId);
        setClients(data);
      } catch (e) {
        console.error('Error loading clients', e);
      }
    };
    void loadClients();
  }, [ownerId, clientsRefreshKey]);

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
        const teamMemberForLog = teamMemberJson ? (JSON.parse(teamMemberJson) as { id: string }) : null;
        debugIngest({ location: 'ChantiersContext.tsx:load:branch', message: 'which load branch', data: { hasUser: !!user, isTeamMember, teamMemberId: teamMemberForLog?.id }, sessionId: 'debug-session', hypothesisId: 'C,D,E' });
        if (ownerId) {
          const data = await fetchChantiersForUser(ownerId);
          if (isTeamMember) {
            try {
              const teamMember = JSON.parse(teamMemberJson!) as { id: string; can_view_all_chantiers?: boolean };
              
              // Charger les permissions depuis localStorage si elles n'existent pas
              let permissionsFromStorage: { can_view_all_chantiers?: boolean } = {};
              try {
                const storedPermissions = localStorage.getItem(`team_member_permissions_${teamMember.id}`);
                if (storedPermissions) {
                  permissionsFromStorage = JSON.parse(storedPermissions);
                }
              } catch (e) {
                console.warn('Could not load permissions from localStorage:', e);
              }
              
              const canViewAll = teamMember.can_view_all_chantiers ?? permissionsFromStorage.can_view_all_chantiers ?? false;
              
              // Si le membre a la permission de voir tous les chantiers, afficher tous les chantiers
              // Sinon, filtrer pour ne montrer que les chantiers assignés
              if (canViewAll) {
                setChantiers(data);
              } else {
                const assignedIds = await fetchChantierAssignmentsByTeamMember(teamMember.id);
                const filtered = assignedIds.length > 0 ? data.filter((c) => assignedIds.includes(c.id)) : [];
                debugIngest({ location: 'ChantiersContext.tsx:load:admin+team', message: 'filtered for team', data: { assignedIdsLength: assignedIds.length, assignedIds, dataLength: data.length, filteredLength: filtered.length, filteredIds: filtered.map((c) => c.id) }, sessionId: 'debug-session', hypothesisId: 'E' });
                setChantiers(filtered);
              }
            } catch {
              setChantiers(data);
            }
          } else {
            setChantiers(data);
          }
        } else {
          const teamMember = JSON.parse(teamMemberJson!) as { id: string; can_view_all_chantiers?: boolean; user_id?: string | null };
          
          // Charger les permissions depuis localStorage si elles n'existent pas
          let permissionsFromStorage: { can_view_all_chantiers?: boolean } = {};
          try {
            const storedPermissions = localStorage.getItem(`team_member_permissions_${teamMember.id}`);
            if (storedPermissions) {
              permissionsFromStorage = JSON.parse(storedPermissions);
            }
          } catch (e) {
            console.warn('Could not load permissions from localStorage:', e);
          }
          
          const canViewAll = teamMember.can_view_all_chantiers ?? permissionsFromStorage.can_view_all_chantiers ?? false;
          
          // Si le membre a la permission de voir tous les chantiers ET qu'il a un user_id,
          // charger tous les chantiers de l'utilisateur propriétaire
          // Sinon, charger seulement les chantiers assignés
          if (canViewAll && teamMember.user_id) {
            const data = await fetchChantiersForUser(teamMember.user_id);
            setChantiers(data);
          } else {
            const data = await fetchChantiersForTeamMember(teamMember.id);
            debugIngest({ location: 'ChantiersContext.tsx:load:teamOnly', message: 'setChantiers team path', data: { dataLength: data.length, ids: data.map((c) => c.id) }, sessionId: 'debug-session', hypothesisId: 'C,D' });
            setChantiers(data);
          }
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
  }, [ownerId, chantiersRefreshKey]);

  const refreshChantiers = useCallback(() => {
    setChantiersRefreshKey(k => k + 1);
  }, []);

  const refreshClients = useCallback(() => {
    setClientsRefreshKey(k => k + 1);
  }, []);

  const addClient = async (payload: NewClientPayload): Promise<Client> => {
    if (!ownerId) {
      console.error('addClient called without authenticated user or effective owner');
      throw new Error('User not authenticated');
    }
    const created = await insertClientRemote(ownerId, payload);
    setClients(prev => [created, ...prev]);
    return created;
  };

  const updateClient = async (id: string, payload: UpdateClientPayload): Promise<Client> => {
    if (!ownerId) {
      console.error('updateClient called without authenticated user or effective owner');
      throw new Error('User not authenticated');
    }
    const updated = await updateClientRemote(ownerId, id, payload);
    setClients(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteClient = async (id: string): Promise<void> => {
    if (!ownerId) {
      console.error('deleteClient called without authenticated user or effective owner');
      throw new Error('User not authenticated');
    }
    await softDeleteClientRemote(ownerId, id);
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const addChantier = async (payload: NewChantierPayload): Promise<Chantier> => {
    if (!ownerId) {
      console.error('addChantier called without authenticated user or effective owner');
      throw new Error('User not authenticated');
    }
    const created = await insertChantierRemote(ownerId, payload);
    setChantiers(prev => [created, ...prev]);
    return created;
  };

  const updateChantier = async (id: string, updates: Partial<Chantier>) => {
    if (!ownerId) {
      console.error('updateChantier called without authenticated user or effective owner');
      return;
    }
    const updated = await updateChantierRemote(id, ownerId, updates);
    setChantiers(prev => prev.map(c => (c.id === id ? updated : c)));
  };

  const deleteChantier = async (id: string) => {
    if (!ownerId) {
      console.error('deleteChantier called without authenticated user or effective owner');
      throw new Error('User not authenticated');
    }
    await softDeleteChantierRemote(id, ownerId);
    setChantiers(prev => prev.filter(c => c.id !== id));
  };

  return (
    <ChantiersContext.Provider
      value={{ clients, chantiers, loading, error, addClient, updateClient, deleteClient, addChantier, updateChantier, deleteChantier, refreshChantiers, refreshClients }}
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
