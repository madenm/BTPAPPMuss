import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';

export default function LoadingRedirectPage() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animation de la barre de progression sur 5 secondes
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2; // 100% en 5 secondes (50 intervalles de 100ms)
      });
    }, 100);

    // Redirection après 5 secondes
    const timeout = setTimeout(() => {
      setLocation('/dashboard');
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [setLocation]);

  return (
    <div className="h-screen w-screen flex items-center justify-center font-sans">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full px-6">
        {/* Logo ou icône */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-xl"
        >
          <span className="text-3xl font-bold text-white">P</span>
        </motion.div>

        {/* Texte principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1 className="text-4xl font-light tracking-tight text-white mb-2 drop-shadow-lg">
            Aos Renov
          </h1>
          <p className="text-lg text-white/80 font-light drop-shadow-md">
            Chargement de votre espace...
          </p>
        </motion.div>

        {/* Barre de progression */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: '100%' }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="w-full"
        >
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        </motion.div>

        {/* Indicateur de chargement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-1"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-violet-500"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

