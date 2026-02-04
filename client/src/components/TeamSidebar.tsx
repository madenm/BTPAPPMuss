import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Building,
  Calendar,
} from 'lucide-react';
import type { TeamMember } from '@/lib/supabase';

export default function TeamSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    const storedMember = localStorage.getItem('teamMember');
    if (storedMember) {
      try {
        setTeamMember(JSON.parse(storedMember));
      } catch (error) {
        console.error('Error parsing team member from localStorage:', error);
      }
    }
  }, []);

  const menuItems = [
    { icon: Home, label: 'Vue d\'ensemble', path: '/team-dashboard', active: location === '/team-dashboard' },
    { icon: Building, label: 'Mes Chantiers', path: '/team-dashboard/projects', active: location === '/team-dashboard/projects' },
    { icon: Calendar, label: 'Planning', path: '/team-dashboard/planning', active: location === '/team-dashboard/planning' },
  ];

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
          <span className="text-xs text-white/70 italic mt-1">Aos Renov</span>
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

