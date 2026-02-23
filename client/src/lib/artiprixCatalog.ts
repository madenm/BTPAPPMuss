/**
 * Catalogue de prix Artiprix Gros Œuvre – Second Œuvre
 * Source : bordereau Artiprix (édition 2013, prix indicatifs ajustés)
 * Sélection des postes les plus courants pour artisans BTP / rénovation.
 *
 * Chaque entrée contient le prix « exécution normale » (MO+fournitures)
 * sauf mention contraire.
 */

export interface ArtiprixEntry {
  ref: string;
  label: string;
  chapter: string;
  unit: string;
  laborOnly: number;
  materialOnly: number;
  total: number;
}

export type ArtiprixChapter =
  | "demolition"
  | "gros-oeuvre"
  | "couverture"
  | "isolation"
  | "cloisons-plafonds"
  | "menuiseries-ext"
  | "menuiseries-int"
  | "carrelage"
  | "peinture-int"
  | "peinture-ext"
  | "facades-ite"
  | "terrasses"
  | "clotures-portails"
  | "piscine"
  | "serrurerie"
  | "enduits";

const CATALOG: ArtiprixEntry[] = [
  // ═══════════════════════════════════════════
  // 1 – DÉMOLITION / DÉPOSE
  // ═══════════════════════════════════════════
  { ref: "1.1.1", label: "Démolition toutes maçonneries à l'engin mécanique", chapter: "demolition", unit: "M3", laborOnly: 6.57, materialOnly: 13.19, total: 19.76 },
  { ref: "1.3.1", label: "Démolition matériaux creux, plâtras, béton cellulaire (masse/pioche)", chapter: "demolition", unit: "M3", laborOnly: 59.09, materialOnly: 0, total: 59.09 },
  { ref: "1.3.5", label: "Démolition ouvrage béton armé (marteau piqueur)", chapter: "demolition", unit: "M3", laborOnly: 300.47, materialOnly: 203.66, total: 504.13 },
  { ref: "1.4.6", label: "Démolition mur en agglos 20 cm, manuellement", chapter: "demolition", unit: "M2", laborOnly: 7.42, materialOnly: 0, total: 7.42 },
  { ref: "1.4.7", label: "Démolition mur béton non armé ≤25 cm (mécanique)", chapter: "demolition", unit: "M2", laborOnly: 15.83, materialOnly: 11.42, total: 27.26 },
  { ref: "1.4.9", label: "Démolition mur béton armé ≤25 cm (mécanique)", chapter: "demolition", unit: "M2", laborOnly: 22.21, materialOnly: 14.92, total: 37.13 },
  { ref: "1.6.1", label: "Démolition plancher poutrelles-hourdis (engin)", chapter: "demolition", unit: "M2", laborOnly: 7.72, materialOnly: 15.24, total: 22.97 },
  { ref: "1.9.1", label: "Démolition doublage isolant collé ou sur ossature", chapter: "demolition", unit: "M2", laborOnly: 12.74, materialOnly: 0, total: 12.74 },
  { ref: "1.11.1", label: "Démolition cloison briques ≤10 cm", chapter: "demolition", unit: "M2", laborOnly: 4.63, materialOnly: 0, total: 4.63 },
  { ref: "1.11.2", label: "Démolition cloison placo ≤10 cm", chapter: "demolition", unit: "M2", laborOnly: 7.42, materialOnly: 0, total: 7.42 },
  { ref: "1.12.1", label: "Démolition plafond en plâtre", chapter: "demolition", unit: "M2", laborOnly: 8.50, materialOnly: 0, total: 8.50 },
  { ref: "1.12.2", label: "Démolition plafond plaques de plâtre", chapter: "demolition", unit: "M2", laborOnly: 6.95, materialOnly: 0, total: 6.95 },
  { ref: "1.13.1", label: "Démolition chape ciment (sur béton conservé)", chapter: "demolition", unit: "M2", laborOnly: 27.03, materialOnly: 0, total: 27.03 },
  { ref: "1.13.5", label: "Démolition carrelage sur mortier", chapter: "demolition", unit: "M2", laborOnly: 20.08, materialOnly: 0, total: 20.08 },
  { ref: "1.14.1", label: "Démolition faïence collée", chapter: "demolition", unit: "M2", laborOnly: 11.59, materialOnly: 0, total: 11.59 },
  { ref: "1.15.1", label: "Arrachage moquette collée", chapter: "demolition", unit: "M2", laborOnly: 5.79, materialOnly: 0, total: 5.79 },
  { ref: "1.15.4", label: "Décollage papiers peints", chapter: "demolition", unit: "M2", laborOnly: 6.57, materialOnly: 0, total: 6.57 },
  { ref: "1.21.3", label: "Dépose couverture tuiles plates", chapter: "demolition", unit: "M2", laborOnly: 8.50, materialOnly: 0, total: 8.50 },
  { ref: "1.21.4", label: "Dépose couverture tuiles à emboîtements", chapter: "demolition", unit: "M2", laborOnly: 4.63, materialOnly: 0, total: 4.63 },
  { ref: "1.22.3", label: "Dépose fenêtre 2 vantaux", chapter: "demolition", unit: "U", laborOnly: 16.61, materialOnly: 0, total: 16.61 },

  // ═══════════════════════════════════════════
  // 7 – GROS-ŒUVRE / MAÇONNERIE
  // ═══════════════════════════════════════════
  { ref: "7.2.1", label: "Fouilles en terrain ordinaire", chapter: "gros-oeuvre", unit: "M3", laborOnly: 4.41, materialOnly: 10.85, total: 15.26 },
  { ref: "7.4.1", label: "Béton de propreté ép. 5 cm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 6.57, materialOnly: 4.42, total: 10.99 },
  { ref: "7.5.1", label: "Maçonnerie blocs béton creux ép. 100 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 28.97, materialOnly: 14.41, total: 43.38 },
  { ref: "7.5.3", label: "Maçonnerie blocs béton perforés ép. 150 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 35.53, materialOnly: 19.85, total: 55.39 },
  { ref: "7.5.5", label: "Maçonnerie blocs béton creux ép. 200 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 35.53, materialOnly: 15.95, total: 51.49 },
  { ref: "7.6.5", label: "Linteau bloc U, mur ép. 150 mm", chapter: "gros-oeuvre", unit: "ML", laborOnly: 19.31, materialOnly: 12.29, total: 31.61 },
  { ref: "7.7.1", label: "Dalle béton armé ép. 10 cm (coffrage + ferraillage)", chapter: "gros-oeuvre", unit: "M2", laborOnly: 38.62, materialOnly: 26.50, total: 65.12 },
  { ref: "7.8.1", label: "Semelle filante béton armé (40x40 cm)", chapter: "gros-oeuvre", unit: "ML", laborOnly: 19.31, materialOnly: 18.50, total: 37.81 },
  { ref: "7.13.33", label: "Maçonnerie moellons 1 face alignée ép. 30 cm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 110.07, materialOnly: 13.15, total: 123.21 },
  { ref: "7.14.1", label: "Mur pierre ponce ép. 200 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 28.97, materialOnly: 43.72, total: 72.69 },
  { ref: "7.15.3", label: "Mur argile expansée ép. 200 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 29.35, materialOnly: 36.00, total: 65.35 },
  { ref: "7.21.1", label: "Cloison briques de verre 190×190 ép. 50 mm", chapter: "gros-oeuvre", unit: "M2", laborOnly: 193.10, materialOnly: 176.07, total: 369.17 },

  // ═══════════════════════════════════════════
  // 15 – COUVERTURE
  // ═══════════════════════════════════════════
  { ref: "15.1.1", label: "Couverture tuiles plates terre cuite", chapter: "couverture", unit: "M2", laborOnly: 25.10, materialOnly: 38.00, total: 63.10 },
  { ref: "15.1.5", label: "Couverture tuiles à emboîtement", chapter: "couverture", unit: "M2", laborOnly: 17.38, materialOnly: 22.00, total: 39.38 },
  { ref: "15.2.1", label: "Couverture ardoises naturelles à crochet", chapter: "couverture", unit: "M2", laborOnly: 32.05, materialOnly: 48.00, total: 80.05 },
  { ref: "15.3.1", label: "Faîtage tuiles scellées au mortier", chapter: "couverture", unit: "ML", laborOnly: 13.52, materialOnly: 8.50, total: 22.02 },
  { ref: "15.5.1", label: "Gouttière pendante zinc développé 25 cm", chapter: "couverture", unit: "ML", laborOnly: 13.52, materialOnly: 18.00, total: 31.52 },
  { ref: "15.5.5", label: "Descente EP zinc Ø 80 mm", chapter: "couverture", unit: "ML", laborOnly: 11.59, materialOnly: 14.00, total: 25.59 },

  // ═══════════════════════════════════════════
  // 27 – FAÇADES / ISOLATION PAR L'EXTÉRIEUR
  // ═══════════════════════════════════════════
  { ref: "27.1.1", label: "ITE panneau polystyrène 40 mm collé", chapter: "facades-ite", unit: "M2", laborOnly: 16.99, materialOnly: 16.90, total: 33.89 },
  { ref: "27.1.3", label: "ITE panneau polystyrène 80 mm collé", chapter: "facades-ite", unit: "M2", laborOnly: 16.99, materialOnly: 20.50, total: 37.49 },
  { ref: "27.1.5", label: "ITE panneau polystyrène 100 mm collé", chapter: "facades-ite", unit: "M2", laborOnly: 16.99, materialOnly: 23.00, total: 39.99 },
  { ref: "27.2.1", label: "ITE panneau laine de roche 60 mm", chapter: "facades-ite", unit: "M2", laborOnly: 19.31, materialOnly: 28.00, total: 47.31 },
  { ref: "27.3.1", label: "Enduit de finition sur ITE (finition grattée)", chapter: "facades-ite", unit: "M2", laborOnly: 15.45, materialOnly: 12.00, total: 27.45 },

  // ═══════════════════════════════════════════
  // 28 – ENDUITS FAÇADES
  // ═══════════════════════════════════════════
  { ref: "28.1.1", label: "Enduit monocouche projeté ép. 15 mm, finition grattée", chapter: "enduits", unit: "M2", laborOnly: 13.52, materialOnly: 8.50, total: 22.02 },
  { ref: "28.1.3", label: "Enduit monocouche projeté ép. 15 mm, finition écrasée", chapter: "enduits", unit: "M2", laborOnly: 14.68, materialOnly: 8.50, total: 23.18 },
  { ref: "28.2.1", label: "Enduit traditionnel 3 couches au mortier bâtard", chapter: "enduits", unit: "M2", laborOnly: 25.88, materialOnly: 5.50, total: 31.38 },

  // ═══════════════════════════════════════════
  // 30 – CLOISONS / PLAFONDS / ISOLATION
  // ═══════════════════════════════════════════
  { ref: "30.1.1", label: "Cloison briques plâtrières 35 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 15.45, materialOnly: 7.22, total: 22.67 },
  { ref: "30.1.4", label: "Cloison briques plâtrières double alvéole 100 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 18.92, materialOnly: 16.62, total: 35.54 },
  { ref: "30.3.1", label: "Cloison carreaux de plâtre 50 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 15.45, materialOnly: 12.09, total: 27.54 },
  { ref: "30.3.3", label: "Cloison carreaux de plâtre 100 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 21.24, materialOnly: 25.75, total: 47.00 },
  { ref: "30.6.7", label: "Cloison placo BA13 72/48 simple parement EI30", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 23.17, materialOnly: 14.13, total: 37.30 },
  { ref: "30.6.8", label: "Cloison placo BA13 72/48 + laine de verre 45 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 24.72, materialOnly: 17.28, total: 42.00 },
  { ref: "30.6.11", label: "Cloison placo BA15 100/70 simple parement EI30", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 24.33, materialOnly: 22.80, total: 47.13 },
  { ref: "30.6.12", label: "Cloison placo BA15 100/70 + laine de verre 70 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 25.88, materialOnly: 27.42, total: 53.29 },
  { ref: "30.6.14", label: "Cloison placo BA13 98/48 double parement EI60", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 28.97, materialOnly: 21.18, total: 50.15 },
  { ref: "30.6.47", label: "Cloison phonique Placo Phonique 72/48 + LDV 45 mm", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 24.72, materialOnly: 23.63, total: 48.35 },
  { ref: "30.7.2", label: "Doublage plaque collée BA13", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 13.13, materialOnly: 4.05, total: 17.18 },
  { ref: "30.8.1", label: "Doublage collé isolant polystyrène 10+40 mm", chapter: "isolation", unit: "M2", laborOnly: 13.52, materialOnly: 12.50, total: 26.02 },
  { ref: "30.8.3", label: "Doublage collé isolant polystyrène 10+80 mm", chapter: "isolation", unit: "M2", laborOnly: 13.52, materialOnly: 16.00, total: 29.52 },
  { ref: "30.8.5", label: "Doublage collé isolant polystyrène 10+100 mm", chapter: "isolation", unit: "M2", laborOnly: 13.52, materialOnly: 19.00, total: 32.52 },
  { ref: "30.9.1", label: "Faux-plafond plaques plâtre BA13 sur ossature", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 23.17, materialOnly: 10.50, total: 33.67 },
  { ref: "30.10.1", label: "Faux-plafond dalles 600×600 sur ossature apparente", chapter: "cloisons-plafonds", unit: "M2", laborOnly: 17.38, materialOnly: 15.00, total: 32.38 },
  { ref: "30.11.1", label: "Isolation combles laine de verre 200 mm en rouleau", chapter: "isolation", unit: "M2", laborOnly: 5.79, materialOnly: 11.00, total: 16.79 },
  { ref: "30.11.3", label: "Isolation combles laine de verre 300 mm en rouleau", chapter: "isolation", unit: "M2", laborOnly: 6.95, materialOnly: 15.00, total: 21.95 },
  { ref: "30.12.1", label: "Isolation soufflée combles perdus 300 mm", chapter: "isolation", unit: "M2", laborOnly: 3.86, materialOnly: 12.00, total: 15.86 },

  // ═══════════════════════════════════════════
  // 31 – CARRELAGE / REVÊTEMENT MURAL
  // ═══════════════════════════════════════════
  { ref: "31.1.1", label: "Carrelage sol grès cérame 30×30 pose scellée", chapter: "carrelage", unit: "M2", laborOnly: 28.97, materialOnly: 22.00, total: 50.97 },
  { ref: "31.1.3", label: "Carrelage sol grès cérame 45×45 pose collée", chapter: "carrelage", unit: "M2", laborOnly: 25.10, materialOnly: 28.00, total: 53.10 },
  { ref: "31.2.1", label: "Carrelage sol grès cérame 60×60 pose collée", chapter: "carrelage", unit: "M2", laborOnly: 30.12, materialOnly: 35.00, total: 65.12 },
  { ref: "31.3.1", label: "Faïence murale 20×20 pose collée", chapter: "carrelage", unit: "M2", laborOnly: 25.10, materialOnly: 18.00, total: 43.10 },
  { ref: "31.3.3", label: "Faïence murale 30×60 pose collée", chapter: "carrelage", unit: "M2", laborOnly: 28.97, materialOnly: 25.00, total: 53.97 },
  { ref: "31.5.1", label: "Plinthe carrelage 8 cm collée", chapter: "carrelage", unit: "ML", laborOnly: 6.95, materialOnly: 5.00, total: 11.95 },
  { ref: "31.7.1", label: "Chape de ragréage autolissante (5 mm)", chapter: "carrelage", unit: "M2", laborOnly: 5.79, materialOnly: 8.50, total: 14.29 },
  { ref: "31.9.5", label: "Pâte de verre 2×2 entrée de gamme (piscine)", chapter: "carrelage", unit: "M2", laborOnly: 32.05, materialOnly: 16.54, total: 48.60 },
  { ref: "31.10.2", label: "Dalles de galets posées", chapter: "carrelage", unit: "M2", laborOnly: 33.10, materialOnly: 98.20, total: 131.30 },

  // ═══════════════════════════════════════════
  // 32 – MENUISERIES INTÉRIEURES
  // ═══════════════════════════════════════════
  { ref: "32.1.6", label: "Bloc-porte isoplane prépeint 204×63", chapter: "menuiseries-int", unit: "U", laborOnly: 63.72, materialOnly: 75.13, total: 138.85 },
  { ref: "32.1.7", label: "Bloc-porte isoplane prépeint 204×73", chapter: "menuiseries-int", unit: "U", laborOnly: 63.72, materialOnly: 76.56, total: 140.29 },
  { ref: "32.1.8", label: "Bloc-porte isoplane prépeint 204×83", chapter: "menuiseries-int", unit: "U", laborOnly: 65.65, materialOnly: 79.40, total: 145.06 },
  { ref: "32.1.14", label: "Porte coulissante à galandage 204×83", chapter: "menuiseries-int", unit: "U", laborOnly: 138.65, materialOnly: 217.74, total: 356.39 },
  { ref: "32.1.16", label: "Bloc-porte postformé 3 panneaux 204×73", chapter: "menuiseries-int", unit: "U", laborOnly: 63.72, materialOnly: 106.84, total: 170.56 },
  { ref: "32.1.22", label: "Bloc-porte bois exotique 3 panneaux 204×73", chapter: "menuiseries-int", unit: "U", laborOnly: 67.59, materialOnly: 200.73, total: 268.31 },

  // ═══════════════════════════════════════════
  // 19-22 – MENUISERIES EXTÉRIEURES
  // ═══════════════════════════════════════════
  { ref: "19.1.1", label: "Fenêtre bois 1 vantail haute isolation 75×60", chapter: "menuiseries-ext", unit: "U", laborOnly: 65.65, materialOnly: 420.00, total: 485.65 },
  { ref: "19.1.5", label: "Fenêtre bois 2 vantaux haute isolation 115×100", chapter: "menuiseries-ext", unit: "U", laborOnly: 71.45, materialOnly: 620.00, total: 691.45 },
  { ref: "19.11.1", label: "Porte d'entrée bois pleine à panneau 215×90", chapter: "menuiseries-ext", unit: "U", laborOnly: 106.21, materialOnly: 833.34, total: 939.55 },
  { ref: "21.1.1", label: "Fenêtre PVC 1 vantail oscillo-battant 75×60", chapter: "menuiseries-ext", unit: "U", laborOnly: 57.93, materialOnly: 280.00, total: 337.93 },
  { ref: "21.1.5", label: "Fenêtre PVC 2 vantaux oscillo-battant 115×100", chapter: "menuiseries-ext", unit: "U", laborOnly: 65.65, materialOnly: 380.00, total: 445.65 },
  { ref: "22.1.1", label: "Fenêtre alu 1 vantail rupture pont thermique 60×60", chapter: "menuiseries-ext", unit: "U", laborOnly: 65.65, materialOnly: 450.00, total: 515.65 },
  { ref: "22.1.5", label: "Fenêtre alu 2 vantaux RPT 115×100", chapter: "menuiseries-ext", unit: "U", laborOnly: 73.38, materialOnly: 650.00, total: 723.38 },
  { ref: "19.10.1", label: "Porte-fenêtre bois coulissante 215×180", chapter: "menuiseries-ext", unit: "U", laborOnly: 135.17, materialOnly: 1745.44, total: 1880.61 },
  { ref: "26.1.1", label: "Porte garage basculante acier 200×240", chapter: "menuiseries-ext", unit: "U", laborOnly: 193.10, materialOnly: 475.78, total: 668.88 },

  // ═══════════════════════════════════════════
  // 38 – PEINTURE INTÉRIEURE
  // ═══════════════════════════════════════════
  { ref: "38.1.17", label: "Rebouchage enduit à l'eau + ponçage (plafond)", chapter: "peinture-int", unit: "M2", laborOnly: 3.55, materialOnly: 0.66, total: 4.21 },
  { ref: "38.1.22", label: "Enduit pelliculaire de ratissage + ponçage (plafond)", chapter: "peinture-int", unit: "M2", laborOnly: 6.76, materialOnly: 2.31, total: 9.06 },
  { ref: "38.2.17", label: "Rebouchage enduit à l'eau + ponçage (mur)", chapter: "peinture-int", unit: "M2", laborOnly: 3.09, materialOnly: 0.66, total: 3.75 },
  { ref: "38.2.22", label: "Enduit pelliculaire de ratissage + ponçage (mur)", chapter: "peinture-int", unit: "M2", laborOnly: 5.79, materialOnly: 2.31, total: 8.10 },
  { ref: "38.3.1", label: "Peinture mate phase aqueuse, finition C, plafond", chapter: "peinture-int", unit: "M2", laborOnly: 7.72, materialOnly: 2.50, total: 10.22 },
  { ref: "38.3.4", label: "Peinture mate phase aqueuse, finition B, plafond", chapter: "peinture-int", unit: "M2", laborOnly: 13.13, materialOnly: 4.00, total: 17.13 },
  { ref: "38.3.7", label: "Peinture mate phase aqueuse, finition A, plafond (rebouchage+enduit repassé)", chapter: "peinture-int", unit: "M2", laborOnly: 22.40, materialOnly: 6.50, total: 28.90 },
  { ref: "38.4.28", label: "Peinture satinée phase aqueuse, finition C, mur", chapter: "peinture-int", unit: "M2", laborOnly: 9.00, materialOnly: 2.88, total: 11.87 },
  { ref: "38.4.31", label: "Peinture satinée, finition A, mur (rebouchage+enduit repassé)", chapter: "peinture-int", unit: "M2", laborOnly: 28.62, materialOnly: 6.93, total: 35.55 },
  { ref: "38.4.41", label: "Peinture satinée Milieu Alimentaire, finition C, mur", chapter: "peinture-int", unit: "M2", laborOnly: 10.85, materialOnly: 4.11, total: 14.96 },
  { ref: "38.5.1", label: "Peinture laque brillante, finition C, mur", chapter: "peinture-int", unit: "M2", laborOnly: 11.59, materialOnly: 4.50, total: 16.09 },
  { ref: "38.6.1", label: "Enduit décoratif acrylique effet marbré (Stucco)", chapter: "peinture-int", unit: "M2", laborOnly: 25.10, materialOnly: 12.98, total: 38.08 },

  // ═══════════════════════════════════════════
  // 29 – PEINTURE EXTÉRIEURE
  // ═══════════════════════════════════════════
  { ref: "29.1.1", label: "Peinture façade acrylique 2 couches, finition C", chapter: "peinture-ext", unit: "M2", laborOnly: 8.50, materialOnly: 3.50, total: 12.00 },
  { ref: "29.1.4", label: "Peinture façade acrylique 2 couches, finition A", chapter: "peinture-ext", unit: "M2", laborOnly: 18.54, materialOnly: 6.00, total: 24.54 },
  { ref: "29.2.1", label: "Peinture façade pliolite 2 couches, finition C", chapter: "peinture-ext", unit: "M2", laborOnly: 9.27, materialOnly: 4.00, total: 13.27 },
  { ref: "29.5.1", label: "Lasure bois extérieur 2 couches", chapter: "peinture-ext", unit: "M2", laborOnly: 7.72, materialOnly: 3.50, total: 11.22 },
  { ref: "29.7.1", label: "Résine étanchéité liquide terrasse (impression)", chapter: "peinture-ext", unit: "M2", laborOnly: 7.72, materialOnly: 15.66, total: 23.38 },

  // ═══════════════════════════════════════════
  // 9 – PISCINE
  // ═══════════════════════════════════════════
  { ref: "9.1.1", label: "Terrassement piscine (déblai)", chapter: "piscine", unit: "M3", laborOnly: 5.79, materialOnly: 12.00, total: 17.79 },
  { ref: "9.2.1", label: "Radier piscine béton armé ép. 20 cm", chapter: "piscine", unit: "M2", laborOnly: 38.62, materialOnly: 35.00, total: 73.62 },
  { ref: "9.3.1", label: "Parois piscine béton banché ép. 20 cm", chapter: "piscine", unit: "M2", laborOnly: 48.28, materialOnly: 42.00, total: 90.28 },
  { ref: "9.4.1", label: "Enduit d'étanchéité piscine (2 couches)", chapter: "piscine", unit: "M2", laborOnly: 19.31, materialOnly: 18.00, total: 37.31 },
  { ref: "9.5.1", label: "Margelle piscine en pierre reconstituée", chapter: "piscine", unit: "ML", laborOnly: 25.10, materialOnly: 45.00, total: 70.10 },
  { ref: "9.6.1", label: "Liner piscine PVC armé 150/100", chapter: "piscine", unit: "M2", laborOnly: 15.45, materialOnly: 35.00, total: 50.45 },

  // ═══════════════════════════════════════════
  // 47-48 – TERRASSES
  // ═══════════════════════════════════════════
  { ref: "47.1.1", label: "Dallage extérieur béton désactivé ép. 12 cm", chapter: "terrasses", unit: "M2", laborOnly: 25.10, materialOnly: 22.00, total: 47.10 },
  { ref: "47.2.1", label: "Pavage béton autobloquant ép. 6 cm", chapter: "terrasses", unit: "M2", laborOnly: 19.31, materialOnly: 18.00, total: 37.31 },
  { ref: "47.3.1", label: "Dallage pierres naturelles sur lit de sable", chapter: "terrasses", unit: "M2", laborOnly: 32.05, materialOnly: 45.00, total: 77.05 },
  { ref: "48.1.1", label: "Terrasse lames bois résineux (pin traité) sur lambourdes", chapter: "terrasses", unit: "M2", laborOnly: 28.97, materialOnly: 35.00, total: 63.97 },
  { ref: "48.1.3", label: "Terrasse lames bois exotique sur lambourdes", chapter: "terrasses", unit: "M2", laborOnly: 28.97, materialOnly: 55.00, total: 83.97 },
  { ref: "48.2.1", label: "Terrasse lames composites sur lambourdes", chapter: "terrasses", unit: "M2", laborOnly: 25.10, materialOnly: 42.00, total: 67.10 },

  // ═══════════════════════════════════════════
  // 49-51 – CLÔTURES / PORTAILS
  // ═══════════════════════════════════════════
  { ref: "49.1.1", label: "Muret agglos ép. 20 cm enduit 2 faces, h=1 m", chapter: "clotures-portails", unit: "ML", laborOnly: 48.28, materialOnly: 32.00, total: 80.28 },
  { ref: "49.2.1", label: "Pilier agglos 30×30 enduit, h=1,50 m", chapter: "clotures-portails", unit: "U", laborOnly: 57.93, materialOnly: 38.00, total: 95.93 },
  { ref: "50.1.1", label: "Clôture grillage simple torsion h=1,50 m", chapter: "clotures-portails", unit: "ML", laborOnly: 11.59, materialOnly: 18.00, total: 29.59 },
  { ref: "50.2.1", label: "Clôture panneaux rigides soudés h=1,50 m", chapter: "clotures-portails", unit: "ML", laborOnly: 15.45, materialOnly: 32.00, total: 47.45 },
  { ref: "50.3.1", label: "Clôture palissade bois h=1,80 m", chapter: "clotures-portails", unit: "ML", laborOnly: 19.31, materialOnly: 45.00, total: 64.31 },
  { ref: "51.1.1", label: "Portail battant aluminium 2 vantaux 3 m", chapter: "clotures-portails", unit: "U", laborOnly: 135.17, materialOnly: 850.00, total: 985.17 },
  { ref: "51.2.1", label: "Portail coulissant aluminium 4 m", chapter: "clotures-portails", unit: "U", laborOnly: 154.48, materialOnly: 1200.00, total: 1354.48 },
  { ref: "51.3.1", label: "Portillon aluminium 1 m", chapter: "clotures-portails", unit: "U", laborOnly: 77.24, materialOnly: 350.00, total: 427.24 },

  // ═══════════════════════════════════════════
  // 36 – SERRURERIE
  // ═══════════════════════════════════════════
  { ref: "36.4.3", label: "Garde-corps filant MC + 1 lisse + plinthe", chapter: "serrurerie", unit: "ML", laborOnly: 85.85, materialOnly: 27.72, total: 113.57 },
  { ref: "36.4.14", label: "Garde-corps filant barreaudage vertical", chapter: "serrurerie", unit: "ML", laborOnly: 108.79, materialOnly: 42.40, total: 151.20 },
  { ref: "36.5.1", label: "Main courante fer plat 40×8 mm filant droit", chapter: "serrurerie", unit: "ML", laborOnly: 45.84, materialOnly: 11.98, total: 57.83 },
];

export const ARTIPRIX_CHAPTERS: Record<ArtiprixChapter, string> = {
  "demolition": "Démolition / Dépose",
  "gros-oeuvre": "Gros-œuvre / Maçonnerie",
  "couverture": "Couverture / Toiture",
  "isolation": "Isolation thermique",
  "cloisons-plafonds": "Cloisons / Plafonds",
  "menuiseries-ext": "Menuiseries extérieures",
  "menuiseries-int": "Menuiseries intérieures",
  "carrelage": "Carrelage / Revêtement",
  "peinture-int": "Peinture intérieure",
  "peinture-ext": "Peinture extérieure",
  "facades-ite": "Façades / ITE",
  "terrasses": "Terrasses / Dallage",
  "clotures-portails": "Clôtures / Portails",
  "piscine": "Piscine",
  "serrurerie": "Serrurerie / Métallerie",
  "enduits": "Enduits façades",
};

const METIER_TO_CHAPTERS: Record<string, ArtiprixChapter[]> = {
  renovation: ["demolition", "cloisons-plafonds", "isolation", "carrelage", "peinture-int", "menuiseries-int", "enduits"],
  piscine: ["piscine", "carrelage", "terrasses"],
  terrasse: ["terrasses", "clotures-portails", "gros-oeuvre"],
  plomberie: ["gros-oeuvre", "carrelage", "cloisons-plafonds"],
  electricite: ["cloisons-plafonds", "peinture-int"],
  peinture: ["peinture-int", "peinture-ext", "enduits"],
  maconnerie: ["gros-oeuvre", "enduits", "facades-ite"],
  menuiserie: ["menuiseries-ext", "menuiseries-int", "serrurerie"],
  chauffage: ["isolation", "cloisons-plafonds", "gros-oeuvre"],
  isolation: ["isolation", "facades-ite", "cloisons-plafonds", "couverture"],
  couverture: ["couverture", "isolation", "demolition"],
  paysage: ["terrasses", "clotures-portails", "gros-oeuvre"],
  extension: ["gros-oeuvre", "couverture", "isolation", "menuiseries-ext", "cloisons-plafonds"],
  salleDeBain: ["carrelage", "cloisons-plafonds", "peinture-int", "demolition"],
  cuisine: ["carrelage", "peinture-int", "menuiseries-int", "cloisons-plafonds"],
};

export function getChaptersForMetier(metier: string): ArtiprixChapter[] {
  return METIER_TO_CHAPTERS[metier] ?? Object.keys(ARTIPRIX_CHAPTERS) as ArtiprixChapter[];
}

export function getCatalogForMetier(metier: string): ArtiprixEntry[] {
  const chapters = getChaptersForMetier(metier);
  return CATALOG.filter(e => chapters.includes(e.chapter as ArtiprixChapter));
}

export function searchCatalog(query: string, chapter?: ArtiprixChapter): ArtiprixEntry[] {
  const q = query.trim().toLowerCase();
  return CATALOG.filter(e => {
    if (chapter && e.chapter !== chapter) return false;
    if (q && !e.label.toLowerCase().includes(q) && !e.ref.includes(q)) return false;
    return true;
  });
}

export function getAllCatalog(): ArtiprixEntry[] {
  return CATALOG;
}

export function formatCatalogForPrompt(entries: ArtiprixEntry[]): string {
  return entries
    .map(e => `${e.ref} ${e.label}: ${e.total.toFixed(2)}€/${e.unit} (MO ${e.laborOnly.toFixed(2)}€ + Fourn. ${e.materialOnly.toFixed(2)}€)`)
    .join("\n");
}
