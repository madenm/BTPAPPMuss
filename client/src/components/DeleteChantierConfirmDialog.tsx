import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteChantierConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chantierName: string;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function DeleteChantierConfirmDialog({
  open,
  onOpenChange,
  chantierName,
  onConfirm,
  loading = false,
}: DeleteChantierConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Archiver ce projet ?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/70">
            « {chantierName} » sera archivé et n'apparaîtra plus dans la liste. Vous pourrez le restaurer plus tard si besoin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? 'Archivage...' : 'Archiver'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
