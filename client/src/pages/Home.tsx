import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        {/* Hero Section */}
        <section className="w-full">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-6xl md:text-7xl lg:text-8xl font-light tracking-tight text-white mb-6 drop-shadow-lg"
                style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
              >
                ChantierPro
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-2xl md:text-3xl font-light text-white/90 mb-4 drop-shadow-md"
              >
                Construire pour durer
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="text-lg text-white/80 mb-12 max-w-2xl mx-auto drop-shadow-sm"
              >
                Votre application professionnelle pour gérer vos chantiers, devis et équipes avec intelligence
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
              >
                <button
                  onClick={() => setLocation("/auth")}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/90 hover:bg-white text-violet-600 rounded-2xl font-medium text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm"
                >
                  Se connecter
                  <ArrowRight className="h-5 w-5" />
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
