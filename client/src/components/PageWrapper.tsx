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
      <div className="relative z-10">
        {/* Sidebar - animated menu */}
        <Sidebar />

        {/* Main Content - animated */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={contentVariants}
            className="py-6 lg:py-8 px-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

