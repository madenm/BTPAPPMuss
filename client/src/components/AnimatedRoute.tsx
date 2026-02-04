import { Route, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactElement } from 'react';

interface AnimatedRouteProps {
  path: string;
  component: () => ReactElement;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export function AnimatedRoute({ path, component: Component }: AnimatedRouteProps) {
  const [location] = useLocation();
  const isActive = location === path;

  return (
    <Route path={path}>
      {isActive && (
        <motion.div
          key={path}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          className="w-full h-full"
        >
          <Component />
        </motion.div>
      )}
    </Route>
  );
}

