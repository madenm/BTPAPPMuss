import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Menu, X, ChevronLeft, Home, Calculator, Building, Calendar, Workflow, FileText, Users, User, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-200, 0], [0, 1]);

  const menuItems = [
    { icon: Home, label: 'Vue d\'ensemble', path: '/dashboard' },
    { icon: Calculator, label: 'Estimation automatique', path: '/dashboard/estimation' },
    { icon: Building, label: 'Mes Chantiers', path: '/dashboard/projects' },
    { icon: Calendar, label: 'Planning', path: '/dashboard/planning' },
    { icon: Workflow, label: 'CRM Pipeline', path: '/dashboard/crm' },
    { icon: FileText, label: 'Générateur de Devis', path: '/dashboard/quotes' },
    { icon: Receipt, label: 'Factures', path: '/dashboard/invoices' },
    { icon: Users, label: 'Équipe', path: '/dashboard/team' },
    { icon: User, label: 'Clients', path: '/dashboard/clients' },
  ];


  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x < -100) {
      setIsOpen(false);
    }
    dragX.set(0);
  };

  const menuVariants = {
    closed: {
      x: '-100%',
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 30,
        mass: 0.8,
      },
    },
    open: {
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 30,
        mass: 0.8,
      },
    },
  };

  const itemVariants = {
    closed: { x: -50, opacity: 0 },
    open: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: 0.1 + i * 0.08,
        type: 'spring',
        stiffness: 250,
        damping: 25,
      },
    }),
  };

  const overlayVariants = {
    closed: { 
      opacity: 0,
      transition: {
        duration: 0.3,
      },
    },
    open: { 
      opacity: 1,
      transition: {
        duration: 0.4,
      },
    },
  };


  return (
    <>
      {/* Menu Button - Always visible, aligné avec le contenu sur mobile */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 left-6 z-50 p-3 rounded-xl transition-colors shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 max-md:left-4 max-md:top-[max(1rem,env(safe-area-inset-top))] max-md:min-w-[44px] max-md:min-h-[44px] max-md:flex max-md:items-center max-md:justify-center max-md:[&_svg]:w-5 max-md:[&_svg]:h-5"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </motion.button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
          />
        )}
      </AnimatePresence>

      {/* Side Menu */}
      <motion.nav
        variants={menuVariants}
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        drag="x"
        dragConstraints={{ left: -320, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="fixed top-0 left-0 h-full w-80 z-40 shadow-2xl bg-white dark:bg-gray-800 flex flex-col rounded-r-3xl"
      >
        {/* Drag Indicator */}
        <motion.div
          style={{ opacity: dragOpacity }}
          className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none z-10"
        >
          <ChevronLeft 
            size={32} 
            className="text-gray-400 dark:text-gray-600"
          />
        </motion.div>

        {/* Content - défilable si la hauteur ne suffit pas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-8 pt-20">
          {/* Header - logo à gauche du titre TitanBtp */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden role="img">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-full w-full" width="48" height="48">
                  <circle cx="50" cy="50" r="48" fill="#1e3a8a" stroke="#fff" strokeWidth="2"/>
                  <g fill="#fff">
                    <rect x="25" y="25" width="50" height="8" rx="2"/>
                    <rect x="46" y="25" width="8" height="50" rx="2"/>
                    <path d="M 35 75 L 50 68 L 65 75 Z"/>
                  </g>
                  <circle cx="50" cy="29" r="2" fill="#fbbf24"/>
                  <circle cx="50" cy="45" r="2" fill="#fbbf24"/>
                  <circle cx="50" cy="60" r="2" fill="#fbbf24"/>
                </svg>
              </span>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                TitanBtp
              </h2>
            </div>
            <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">
              Construire pour durer
            </p>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              className="h-1 rounded bg-violet-600 dark:bg-violet-500"
            />
          </div>

          {/* Navigation Items */}
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide mb-4 text-gray-500 dark:text-gray-400">
              Navigation
            </p>
            <ul className="space-y-1.5">
              {menuItems.map((item, i) => {
                // Pour "Vue d'ensemble", on vérifie exactement le chemin
                // Pour les autres, on vérifie si le chemin commence par le chemin de l'item
                const isActive = item.path === '/dashboard' 
                  ? location === '/dashboard' 
                  : location === item.path || location.startsWith(item.path + '/');
                return (
                  <motion.li
                    key={item.path}
                    custom={i}
                    variants={itemVariants}
                    initial="closed"
                    animate={isOpen ? 'open' : 'closed'}
                  >
                    <Link href={item.path} onClick={() => setIsOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer group",
                          isActive
                            ? 'bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                        )}
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "p-1.5 rounded-md transition-all duration-300",
                            isActive
                              ? 'bg-violet-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-violet-500 group-hover:text-white'
                          )}
                        >
                          <item.icon size={16} />
                        </motion.div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </div>

        </div>
      </motion.nav>

      {/* Grid Background - Only visible when menu is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-20"
          >
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(0,0,0,0.05)"
                    className="dark:stroke-white/5"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
