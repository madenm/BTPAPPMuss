/**
 * Server-side Artiprix catalog — compact version for AI prompt injection.
 * Maps each métier to the most relevant reference prices.
 */

interface CatalogLine {
  ref: string;
  label: string;
  unit: string;
  total: number;
}

const METIER_CATALOG: Record<string, CatalogLine[]> = {
  renovation: [
    { ref: "1.4.6", label: "Démolition mur agglos 20 cm", unit: "M2", total: 7.42 },
    { ref: "1.11.2", label: "Démolition cloison placo ≤10 cm", unit: "M2", total: 7.42 },
    { ref: "1.13.5", label: "Démolition carrelage sur mortier", unit: "M2", total: 20.08 },
    { ref: "1.14.1", label: "Démolition faïence collée", unit: "M2", total: 11.59 },
    { ref: "1.15.4", label: "Décollage papiers peints", unit: "M2", total: 6.57 },
    { ref: "30.6.8", label: "Cloison placo BA13 72/48 + LDV 45 mm", unit: "M2", total: 42.00 },
    { ref: "30.6.12", label: "Cloison placo BA15 100/70 + LDV 70 mm", unit: "M2", total: 53.29 },
    { ref: "30.7.2", label: "Doublage plaque collée BA13", unit: "M2", total: 17.18 },
    { ref: "30.9.1", label: "Faux-plafond BA13 sur ossature", unit: "M2", total: 33.67 },
    { ref: "31.1.3", label: "Carrelage sol grès 45×45 collé", unit: "M2", total: 53.10 },
    { ref: "31.3.1", label: "Faïence murale 20×20 collée", unit: "M2", total: 43.10 },
    { ref: "31.7.1", label: "Ragréage autolissant 5 mm", unit: "M2", total: 14.29 },
    { ref: "32.1.7", label: "Bloc-porte isoplane 204×73", unit: "U", total: 140.29 },
    { ref: "38.3.1", label: "Peinture mate aqueuse finition C plafond", unit: "M2", total: 10.22 },
    { ref: "38.4.28", label: "Peinture satinée aqueuse finition C mur", unit: "M2", total: 11.87 },
    { ref: "38.4.31", label: "Peinture satinée finition A mur (enduit repassé)", unit: "M2", total: 35.55 },
  ],
  piscine: [
    { ref: "9.1.1", label: "Terrassement piscine (déblai)", unit: "M3", total: 17.79 },
    { ref: "9.2.1", label: "Radier piscine béton armé ép. 20 cm", unit: "M2", total: 73.62 },
    { ref: "9.3.1", label: "Parois piscine béton banché ép. 20 cm", unit: "M2", total: 90.28 },
    { ref: "9.4.1", label: "Enduit étanchéité piscine 2 couches", unit: "M2", total: 37.31 },
    { ref: "9.5.1", label: "Margelle pierre reconstituée", unit: "ML", total: 70.10 },
    { ref: "9.6.1", label: "Liner PVC armé 150/100", unit: "M2", total: 50.45 },
    { ref: "31.9.5", label: "Pâte de verre 2×2 (piscine)", unit: "M2", total: 48.60 },
    { ref: "48.2.1", label: "Terrasse lames composites", unit: "M2", total: 67.10 },
  ],
  terrasse: [
    { ref: "47.1.1", label: "Dallage béton désactivé ép. 12 cm", unit: "M2", total: 47.10 },
    { ref: "47.2.1", label: "Pavage béton autobloquant ép. 6 cm", unit: "M2", total: 37.31 },
    { ref: "47.3.1", label: "Dallage pierres naturelles sur sable", unit: "M2", total: 77.05 },
    { ref: "48.1.1", label: "Terrasse lames bois pin traité", unit: "M2", total: 63.97 },
    { ref: "48.1.3", label: "Terrasse lames bois exotique", unit: "M2", total: 83.97 },
    { ref: "48.2.1", label: "Terrasse lames composites", unit: "M2", total: 67.10 },
    { ref: "49.1.1", label: "Muret agglos 20 cm enduit h=1 m", unit: "ML", total: 80.28 },
    { ref: "36.4.3", label: "Garde-corps filant MC + lisse + plinthe", unit: "ML", total: 113.57 },
  ],
  peinture: [
    { ref: "38.1.17", label: "Rebouchage enduit + ponçage plafond", unit: "M2", total: 4.21 },
    { ref: "38.1.22", label: "Enduit ratissage + ponçage plafond", unit: "M2", total: 9.06 },
    { ref: "38.2.17", label: "Rebouchage enduit + ponçage mur", unit: "M2", total: 3.75 },
    { ref: "38.2.22", label: "Enduit ratissage + ponçage mur", unit: "M2", total: 8.10 },
    { ref: "38.3.1", label: "Peinture mate aqueuse finition C plafond", unit: "M2", total: 10.22 },
    { ref: "38.3.4", label: "Peinture mate aqueuse finition B plafond", unit: "M2", total: 17.13 },
    { ref: "38.3.7", label: "Peinture mate finition A plafond", unit: "M2", total: 28.90 },
    { ref: "38.4.28", label: "Peinture satinée aqueuse finition C mur", unit: "M2", total: 11.87 },
    { ref: "38.4.31", label: "Peinture satinée finition A mur", unit: "M2", total: 35.55 },
    { ref: "38.5.1", label: "Laque brillante finition C mur", unit: "M2", total: 16.09 },
    { ref: "38.6.1", label: "Enduit décoratif stucco marbré", unit: "M2", total: 38.08 },
    { ref: "29.1.1", label: "Peinture façade acrylique 2 couches fin. C", unit: "M2", total: 12.00 },
    { ref: "29.1.4", label: "Peinture façade acrylique 2 couches fin. A", unit: "M2", total: 24.54 },
    { ref: "29.5.1", label: "Lasure bois extérieur 2 couches", unit: "M2", total: 11.22 },
  ],
  maconnerie: [
    { ref: "7.2.1", label: "Fouilles terrain ordinaire", unit: "M3", total: 15.26 },
    { ref: "7.4.1", label: "Béton de propreté ép. 5 cm", unit: "M2", total: 10.99 },
    { ref: "7.5.3", label: "Blocs béton perforés ép. 150 mm", unit: "M2", total: 55.39 },
    { ref: "7.5.5", label: "Blocs béton creux ép. 200 mm", unit: "M2", total: 51.49 },
    { ref: "7.6.5", label: "Linteau bloc U ép. 150 mm", unit: "ML", total: 31.61 },
    { ref: "7.7.1", label: "Dalle béton armé ép. 10 cm", unit: "M2", total: 65.12 },
    { ref: "7.8.1", label: "Semelle filante béton armé 40×40", unit: "ML", total: 37.81 },
    { ref: "7.13.33", label: "Maçonnerie moellons 1 face ép. 30 cm", unit: "M2", total: 123.21 },
    { ref: "28.1.1", label: "Enduit monocouche projeté finition grattée", unit: "M2", total: 22.02 },
    { ref: "28.2.1", label: "Enduit traditionnel 3 couches mortier bâtard", unit: "M2", total: 31.38 },
  ],
  menuiserie: [
    { ref: "19.1.1", label: "Fenêtre bois 1 vantail haute isolation 75×60", unit: "U", total: 485.65 },
    { ref: "19.1.5", label: "Fenêtre bois 2 vantaux haute isolation 115×100", unit: "U", total: 691.45 },
    { ref: "19.11.1", label: "Porte entrée bois pleine 215×90", unit: "U", total: 939.55 },
    { ref: "21.1.1", label: "Fenêtre PVC 1 vantail oscillo-battant 75×60", unit: "U", total: 337.93 },
    { ref: "21.1.5", label: "Fenêtre PVC 2 vantaux 115×100", unit: "U", total: 445.65 },
    { ref: "22.1.1", label: "Fenêtre alu 1 vantail RPT 60×60", unit: "U", total: 515.65 },
    { ref: "22.1.5", label: "Fenêtre alu 2 vantaux RPT 115×100", unit: "U", total: 723.38 },
    { ref: "26.1.1", label: "Porte garage basculante acier 200×240", unit: "U", total: 668.88 },
    { ref: "32.1.7", label: "Bloc-porte isoplane 204×73", unit: "U", total: 140.29 },
    { ref: "32.1.8", label: "Bloc-porte isoplane 204×83", unit: "U", total: 145.06 },
    { ref: "32.1.14", label: "Porte coulissante galandage 204×83", unit: "U", total: 356.39 },
    { ref: "32.1.22", label: "Bloc-porte bois exotique 204×73", unit: "U", total: 268.31 },
  ],
  isolation: [
    { ref: "27.1.1", label: "ITE polystyrène 40 mm collé", unit: "M2", total: 33.89 },
    { ref: "27.1.3", label: "ITE polystyrène 80 mm collé", unit: "M2", total: 37.49 },
    { ref: "27.1.5", label: "ITE polystyrène 100 mm collé", unit: "M2", total: 39.99 },
    { ref: "27.2.1", label: "ITE laine de roche 60 mm", unit: "M2", total: 47.31 },
    { ref: "27.3.1", label: "Enduit finition sur ITE grattée", unit: "M2", total: 27.45 },
    { ref: "30.8.1", label: "Doublage isolant polystyrène 10+40 mm", unit: "M2", total: 26.02 },
    { ref: "30.8.3", label: "Doublage isolant polystyrène 10+80 mm", unit: "M2", total: 29.52 },
    { ref: "30.8.5", label: "Doublage isolant polystyrène 10+100 mm", unit: "M2", total: 32.52 },
    { ref: "30.11.1", label: "Isolation combles LDV 200 mm rouleau", unit: "M2", total: 16.79 },
    { ref: "30.11.3", label: "Isolation combles LDV 300 mm rouleau", unit: "M2", total: 21.95 },
    { ref: "30.12.1", label: "Isolation soufflée combles perdus 300 mm", unit: "M2", total: 15.86 },
  ],
  chauffage: [
    { ref: "30.8.1", label: "Doublage isolant polystyrène 10+40 mm", unit: "M2", total: 26.02 },
    { ref: "30.8.5", label: "Doublage isolant polystyrène 10+100 mm", unit: "M2", total: 32.52 },
    { ref: "30.6.8", label: "Cloison placo BA13 72/48 + LDV 45 mm", unit: "M2", total: 42.00 },
    { ref: "30.11.1", label: "Isolation combles LDV 200 mm", unit: "M2", total: 16.79 },
  ],
  electricite: [
    { ref: "30.6.7", label: "Cloison placo BA13 72/48 EI30", unit: "M2", total: 37.30 },
    { ref: "38.4.28", label: "Peinture satinée finition C mur", unit: "M2", total: 11.87 },
    { ref: "38.3.1", label: "Peinture mate finition C plafond", unit: "M2", total: 10.22 },
  ],
  paysage: [
    { ref: "47.1.1", label: "Dallage béton désactivé ép. 12 cm", unit: "M2", total: 47.10 },
    { ref: "47.2.1", label: "Pavage béton autobloquant 6 cm", unit: "M2", total: 37.31 },
    { ref: "47.3.1", label: "Dallage pierres naturelles sur sable", unit: "M2", total: 77.05 },
    { ref: "48.1.1", label: "Terrasse bois pin traité", unit: "M2", total: 63.97 },
    { ref: "48.1.3", label: "Terrasse bois exotique", unit: "M2", total: 83.97 },
    { ref: "49.1.1", label: "Muret agglos enduit h=1 m", unit: "ML", total: 80.28 },
    { ref: "50.1.1", label: "Clôture grillage simple torsion h=1,5 m", unit: "ML", total: 29.59 },
    { ref: "50.2.1", label: "Clôture panneaux rigides h=1,5 m", unit: "ML", total: 47.45 },
    { ref: "50.3.1", label: "Clôture palissade bois h=1,8 m", unit: "ML", total: 64.31 },
    { ref: "51.1.1", label: "Portail battant alu 2 vantaux 3 m", unit: "U", total: 985.17 },
    { ref: "51.2.1", label: "Portail coulissant alu 4 m", unit: "U", total: 1354.48 },
  ],
  couverture: [
    { ref: "15.1.1", label: "Couverture tuiles plates terre cuite", unit: "M2", total: 63.10 },
    { ref: "15.1.5", label: "Couverture tuiles à emboîtement", unit: "M2", total: 39.38 },
    { ref: "15.2.1", label: "Couverture ardoises naturelles", unit: "M2", total: 80.05 },
    { ref: "15.3.1", label: "Faîtage tuiles scellées", unit: "ML", total: 22.02 },
    { ref: "15.5.1", label: "Gouttière pendante zinc dév. 25 cm", unit: "ML", total: 31.52 },
    { ref: "15.5.5", label: "Descente EP zinc Ø80", unit: "ML", total: 25.59 },
    { ref: "30.11.1", label: "Isolation combles LDV 200 mm", unit: "M2", total: 16.79 },
    { ref: "1.21.3", label: "Dépose couverture tuiles plates", unit: "M2", total: 8.50 },
    { ref: "1.21.4", label: "Dépose couverture tuiles emboîtement", unit: "M2", total: 4.63 },
  ],
};

export function getArtiprixForMetier(metier: string): string {
  const lines = METIER_CATALOG[metier];
  if (!lines || lines.length === 0) return "";
  return lines
    .map(l => `[${l.ref}] ${l.label}: ${l.total.toFixed(2)}€/${l.unit}`)
    .join("\n");
}
