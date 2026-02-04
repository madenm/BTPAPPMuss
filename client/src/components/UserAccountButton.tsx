import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { User, LogOut, ChevronDown, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface UserAccountButtonProps {
  variant?: 'fixed' | 'inline';
}

export function UserAccountButton({ variant = 'fixed' }: UserAccountButtonProps) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const handleSignOut = async () => {
    await signOut();
    setLocation('/auth');
  };

  const handleSettings = () => {
    setIsExiting(true);
    setIsOpen(false);
    setLocation('/dashboard/settings');
  };

  const userEmail = user?.email || 'Utilisateur';
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0];

  const handleToggle = () => {
    if (isOpen) {
      setIsExiting(true);
    } else {
      // Calculer la position du dropdown avant de l'ouvrir
      if (buttonRef.current && variant === 'inline') {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8, // mt-2 = 8px
          right: window.innerWidth - rect.right,
        });
      }
    }
    setIsOpen(!isOpen);
  };

  const handleBackdropClick = () => {
    setIsExiting(true);
    setIsOpen(false);
  };

  const isInline = variant === 'inline';
  const containerClassName = isInline 
    ? 'relative' 
    : 'fixed top-6 right-6 z-50';

  const button = (
    <motion.button
      ref={buttonRef}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleToggle}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/20 backdrop-blur-xl border border-white/10 text-white hover:bg-black/30 transition-colors shadow-lg"
    >
      <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
        <User size={16} />
      </div>
      <span className="text-sm font-medium hidden md:block">{userName}</span>
      <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </motion.button>
  );

  const dropdownContent = (
    <AnimatePresence
      onExitComplete={() => {
        setIsExiting(false);
      }}
    >
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[9998]"
            style={{ 
              pointerEvents: isExiting ? 'none' : (isOpen ? 'auto' : 'none')
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed w-64 bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden z-[9999]"
            style={isInline ? {
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            } : {
              top: 'auto',
              right: '0',
              marginTop: '8px',
            }}
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{userName}</p>
                  <p className="text-xs text-white/70 truncate">{userEmail}</p>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-1">
              <Button
                onClick={handleSettings}
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10 rounded-lg"
              >
                <Settings size={16} className="mr-2" />
                Paramètres
              </Button>
              <Button
                onClick={handleSignOut}
                className="w-full justify-start bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg"
              >
                <LogOut size={16} className="mr-2" />
                Se déconnecter
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className={containerClassName}>
        {button}
        {!isInline && dropdownContent}
      </div>
      {isInline && typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
}
