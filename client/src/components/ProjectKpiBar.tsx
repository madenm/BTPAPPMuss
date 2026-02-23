import { Building, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import type { Chantier } from '@/context/ChantiersContext';

function formatMontantEuro(value?: number | null): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function isChantierEnRetard(chantier: Chantier): boolean {
  if (!chantier.dateFin || chantier.statut === 'terminé') return false;
  const fin = chantier.dateFin.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return fin < today;
}

interface ProjectKpiBarProps {
  chantiers: Chantier[];
  filteredCount: number;
}

export function ProjectKpiBar({ chantiers, filteredCount }: ProjectKpiBarProps) {
  const enCours = chantiers.filter((c) => c.statut === 'en cours').length;
  const planifies = chantiers.filter((c) => c.statut === 'planifié').length;
  const termines = chantiers.filter((c) => c.statut === 'terminé').length;
  const enRetardCount = chantiers.filter(isChantierEnRetard).length;
  const caEnCours = chantiers
    .filter((c) => c.statut !== 'terminé')
    .reduce((sum, c) => sum + (c.montantDevis ?? 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <Building className="h-3.5 w-3.5" />
          En cours
        </div>
        <p className="text-2xl font-bold text-white">{enCours}</p>
        <p className="text-xs text-white/50">{planifies} planifié{planifies > 1 ? 's' : ''} · {termines} terminé{termines > 1 ? 's' : ''}</p>
      </div>
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          En retard
        </div>
        <p className={`text-2xl font-bold ${enRetardCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{enRetardCount}</p>
        <p className="text-xs text-white/50">{enRetardCount > 0 ? 'Projets à traiter en priorité' : 'Aucun retard'}</p>
      </div>
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <TrendingUp className="h-3.5 w-3.5" />
          CA en cours
        </div>
        <p className="text-2xl font-bold text-white">{formatMontantEuro(caEnCours) || '0 €'}</p>
        <p className="text-xs text-white/50">Montant des devis actifs</p>
      </div>
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <BarChart3 className="h-3.5 w-3.5" />
          Total projets
        </div>
        <p className="text-2xl font-bold text-white">{chantiers.length}</p>
        <p className="text-xs text-white/50">{filteredCount !== chantiers.length ? `${filteredCount} affichés` : 'Tous affichés'}</p>
      </div>
    </div>
  );
}
