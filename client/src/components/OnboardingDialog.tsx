import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Building, CalendarDays, FileText, Sparkles, Settings, ChevronRight, ChevronLeft, X,
} from 'lucide-react';

const STORAGE_KEY = 'titanbtp_onboarding_done';

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    icon: <Sparkles className="h-10 w-10" />,
    title: 'Bienvenue sur TitanBtp',
    description: 'Votre espace tout-en-un pour gérer vos chantiers, devis et factures. Voici un tour rapide en 30 secondes.',
    color: 'text-violet-400',
  },
  {
    icon: <LayoutDashboard className="h-10 w-10" />,
    title: 'Tableau de bord',
    description: 'Retrouvez vos indicateurs clés, alertes et activités récentes. Tout ce qui compte en un coup d\'œil.',
    color: 'text-blue-400',
  },
  {
    icon: <Building className="h-10 w-10" />,
    title: 'Projets & Planning',
    description: 'Créez vos chantiers, planifiez-les au calendrier avec vue semaine/mois, et suivez l\'avancement en temps réel.',
    color: 'text-amber-400',
  },
  {
    icon: <FileText className="h-10 w-10" />,
    title: 'Devis & Factures',
    description: 'Générez des devis professionnels avec votre grille tarifaire, puis convertissez-les en factures.',
    color: 'text-emerald-400',
  },
  {
    icon: <Sparkles className="h-10 w-10" />,
    title: 'Estimation IA',
    description: 'Uploadez une photo de chantier et obtenez une estimation automatique des coûts, matériaux et délais.',
    color: 'text-pink-400',
  },
  {
    icon: <Settings className="h-10 w-10" />,
    title: 'Personnalisez votre espace',
    description: 'Rendez-vous dans les Paramètres pour ajouter votre logo, infos entreprise et valeurs par défaut de vos documents.',
    color: 'text-cyan-400',
  },
];

export function useOnboarding() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }, []);

  return { showOnboarding: show, dismissOnboarding: dismiss };
}

interface OnboardingDialogProps {
  open: boolean;
  onDone: () => void;
  userName?: string;
}

export function OnboardingDialog({ open, onDone, userName }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[step];
  const isLast = step === total - 1;

  const next = () => {
    if (isLast) { onDone(); return; }
    setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const personalizedTitle = step === 0 && userName
    ? `Bienvenue ${userName} sur TitanBtp`
    : slide.title;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDone(); }}>
      <DialogContent className="bg-gray-950 border border-white/10 text-white max-w-md p-0 overflow-hidden gap-0 [&>button]:hidden">
        {/* Skip button */}
        <button
          type="button"
          onClick={onDone}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Passer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-8 pt-10 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon */}
              <div className={`mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 ${slide.color}`}>
                {slide.icon}
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-white mb-3">
                {personalizedTitle}
              </h2>

              {/* Description */}
              <p className="text-sm text-white/70 leading-relaxed max-w-[320px]">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots + navigation */}
        <div className="px-8 pb-6 flex items-center justify-between">
          {/* Prev */}
          <div className="w-20">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={prev}
                className="text-white/50 hover:text-white hover:bg-white/10 text-xs"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            )}
          </div>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 h-2 bg-violet-500'
                    : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Étape ${i + 1}`}
              />
            ))}
          </div>

          {/* Next / Done */}
          <div className="w-20 flex justify-end">
            <Button
              size="sm"
              onClick={next}
              className={`text-xs ${isLast ? 'bg-violet-500 hover:bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}
            >
              {isLast ? 'C\'est parti !' : 'Suivant'}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
