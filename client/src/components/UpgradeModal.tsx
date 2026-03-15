import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Check } from 'lucide-react';

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Message expliquant la limite atteinte (ex. "Vous avez atteint la limite de 5 chantiers actifs.") */
  message: string;
  /** Titre court (ex. "Limite chantiers atteinte") */
  title?: string;
}

const PRO_FEATURES = [
  'Chantiers illimités',
  'Devis illimités',
  'Gestion d\'équipe complète',
  'IA illimitée',
  'Support prioritaire',
];

export function UpgradeModal({
  open,
  onOpenChange,
  message,
  title = 'Limite de votre plan atteinte',
}: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm font-medium text-foreground">Passez en Pro pour débloquer :</p>
          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
