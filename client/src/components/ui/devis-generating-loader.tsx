import { motion } from "framer-motion";
import { TextShimmer } from "./text-shimmer";
import { Wand2 } from "lucide-react";

export function DevisGeneratingLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-4 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-transparent to-violet-500/10 px-5 py-3 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-2 ring-violet-400/50"
      >
        <Wand2 className="h-5 w-5 text-violet-400" />
      </motion.div>

      <div className="flex items-baseline gap-2">
        <TextShimmer
          duration={1}
          className="text-base font-semibold [--base-color:#ffffff] [--base-gradient-color:#c7d2fe]"
        >
          Votre devis est en train d'être généré
        </TextShimmer>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}
