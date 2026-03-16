import Sidebar from '@/components/Sidebar'
import { useLocation } from 'wouter'
import { AnimatePresence, motion } from 'framer-motion'

interface PageWrapperProps {
  children: React.ReactNode
}

const contentVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export function PageWrapper({ children }: PageWrapperProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Contenu principal - en premier dans le DOM pour être sous le menu */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={contentVariants}
            className="max-md:pb-2 sm:py-6 lg:py-8 px-3 sm:px-6 md:px-20 max-w-[100vw] min-w-0 overflow-x-auto max-md:pb-[env(safe-area-inset-bottom)] relative z-0 flex-1 min-h-0 max-md:pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)]"
          >
            <div className="w-full min-w-0 max-w-none">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Sidebar : couche en pointer-events-none ; le Sidebar réactive les clics uniquement sur le bouton et le menu ouvert */}
        <div className="relative z-[100] pointer-events-none [&>*]:pointer-events-none">
          <Sidebar />
        </div>
      </div>
    </div>
  )
}

