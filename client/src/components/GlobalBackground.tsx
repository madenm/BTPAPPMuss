/**
 * Fond d'écran fixe : gradient CSS statique (sans WebGL) pour de meilleures perfs.
 * Couleurs inspirées de l'ancien MeshGradient (bleu / violet profond).
 */
export function GlobalBackground() {
  return (
    <div
      className="fixed inset-0 w-screen h-screen -z-10 pointer-events-none"
      style={{
        background:
          "linear-gradient(135deg, hsl(216, 90%, 18%) 0%, hsl(243, 68%, 28%) 35%, hsl(205, 91%, 28%) 65%, hsl(211, 61%, 32%) 100%)",
      }}
    />
  )
}
