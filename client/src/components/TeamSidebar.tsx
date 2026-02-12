import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Building,
  Calendar,
  FileText,
  LayoutGrid,
  Receipt,
  Users,
  UserCircle,
  Sparkles,
} from 'lucide-react';
import type { TeamMember } from '@/lib/supabase';

export default function TeamSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);

  const loadMemberFromStorage = useCallback(() => {
    const storedMember = localStorage.getItem('teamMember');
    if (!storedMember) return;
    try {
      const member = JSON.parse(storedMember);
      let permissionsFromStorage: Partial<TeamMember> = {};
      try {
        const storedPermissions = localStorage.getItem(`team_member_permissions_${member.id}`);
        if (storedPermissions) permissionsFromStorage = JSON.parse(storedPermissions);
      } catch (e) {
        console.warn('Could not load permissions from localStorage:', e);
      }
      const memberWithPermissions: TeamMember = {
        ...member,
        can_view_dashboard: permissionsFromStorage.can_view_dashboard !== undefined ? permissionsFromStorage.can_view_dashboard : (member.can_view_dashboard ?? false),
        can_use_estimation: permissionsFromStorage.can_use_estimation !== undefined ? permissionsFromStorage.can_use_estimation : (member.can_use_estimation ?? false),
        can_view_all_chantiers: permissionsFromStorage.can_view_all_chantiers !== undefined ? permissionsFromStorage.can_view_all_chantiers : (member.can_view_all_chantiers ?? false),
        can_manage_chantiers: permissionsFromStorage.can_manage_chantiers !== undefined ? permissionsFromStorage.can_manage_chantiers : (member.can_manage_chantiers ?? false),
        can_view_planning: permissionsFromStorage.can_view_planning !== undefined ? permissionsFromStorage.can_view_planning : (member.can_view_planning ?? false),
        can_manage_planning: permissionsFromStorage.can_manage_planning !== undefined ? permissionsFromStorage.can_manage_planning : (member.can_manage_planning ?? false),
        can_access_crm: permissionsFromStorage.can_access_crm !== undefined ? permissionsFromStorage.can_access_crm : (member.can_access_crm ?? false),
        can_create_quotes: permissionsFromStorage.can_create_quotes !== undefined ? permissionsFromStorage.can_create_quotes : (member.can_create_quotes ?? false),
        can_manage_invoices: permissionsFromStorage.can_manage_invoices !== undefined ? permissionsFromStorage.can_manage_invoices : (member.can_manage_invoices ?? false),
        can_use_ai_visualization: permissionsFromStorage.can_use_ai_visualization !== undefined ? permissionsFromStorage.can_use_ai_visualization : (member.can_use_ai_visualization ?? false),
        can_manage_team: permissionsFromStorage.can_manage_team !== undefined ? permissionsFromStorage.can_manage_team : (member.can_manage_team ?? false),
        can_manage_clients: permissionsFromStorage.can_manage_clients !== undefined ? permissionsFromStorage.can_manage_clients : (member.can_manage_clients ?? false),
      };
      setTeamMember(memberWithPermissions);
    } catch (error) {
      console.error('Error parsing team member from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    loadMemberFromStorage();
  }, [loadMemberFromStorage]);

  useEffect(() => {
    const onRefreshed = () => loadMemberFromStorage();
    window.addEventListener('teamMemberRefreshed', onRefreshed);
    return () => window.removeEventListener('teamMemberRefreshed', onRefreshed);
  }, [loadMemberFromStorage]);

  // Construire les éléments de menu selon les permissions
  const menuItems = [];
  
  // Vue d'ensemble - toujours accessible
  menuItems.push({ icon: Home, label: 'Vue d\'ensemble', path: '/team-dashboard', active: location === '/team-dashboard' });
  
  // Mes Chantiers - accessible si can_view_all_chantiers ou can_manage_chantiers
  if (teamMember?.can_view_all_chantiers || teamMember?.can_manage_chantiers) {
    menuItems.push({ icon: Building, label: 'Mes Chantiers', path: '/team-dashboard/projects', active: location === '/team-dashboard/projects' });
  }
  
  // Planning - accessible si can_view_planning ou can_manage_planning
  if (teamMember?.can_view_planning || teamMember?.can_manage_planning) {
    menuItems.push({ icon: Calendar, label: 'Planning', path: '/team-dashboard/planning', active: location === '/team-dashboard/planning' });
  }
  
  // Créer un Devis - accessible si can_create_quotes
  if (teamMember?.can_create_quotes) {
    menuItems.push({ icon: FileText, label: 'Créer un Devis', path: '/team-dashboard/quotes', active: location === '/team-dashboard/quotes' });
  }
  if (teamMember?.can_access_crm) {
    menuItems.push({ icon: LayoutGrid, label: 'CRM', path: '/team-dashboard/crm', active: location === '/team-dashboard/crm' });
  }
  if (teamMember?.can_manage_invoices) {
    menuItems.push({ icon: Receipt, label: 'Factures', path: '/team-dashboard/invoices', active: location === '/team-dashboard/invoices' });
  }
  if (teamMember?.can_manage_team) {
    menuItems.push({ icon: Users, label: 'Équipe', path: '/team-dashboard/team', active: location === '/team-dashboard/team' });
  }
  if (teamMember?.can_manage_clients) {
    menuItems.push({ icon: UserCircle, label: 'Clients', path: '/team-dashboard/clients', active: location === '/team-dashboard/clients' });
  }
  if (teamMember?.can_use_ai_visualization) {
    menuItems.push({ icon: Sparkles, label: 'IA Visualisation', path: '/team-dashboard/ai-visualization', active: location === '/team-dashboard/ai-visualization' });
  }

  return (
    <div className={cn(
      "fixed left-0 top-0 h-screen bg-black/20 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col z-50 rounded-r-3xl",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex flex-col">
          <span className="font-semibold text-white">Membre d'équipe</span>
          {teamMember?.role && (
            <span className="text-xs text-white/70 mt-1">
              Connecté en tant qu'{teamMember.role}
            </span>
          )}
          <span className="text-xs text-white/70 italic mt-1">ChantierPro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {!collapsed && (
          <div className="text-xs font-medium text-white/60 uppercase tracking-wide mb-4">
            Navigation
          </div>
        )}
        
        {menuItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-10 text-white",
                collapsed && "justify-center",
                item.active && "bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30",
                !item.active && "hover:bg-white/10"
              )}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          </Link>
        ))}
      </nav>
    </div>
  );
}

