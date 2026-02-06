/**
 * Configuration du questionnaire conditionnel pour l'estimation automatique.
 * Les questions et options dépendent du type de projet sélectionné.
 */

export interface QuestionOption {
  value: string;
  label: string;
}

export interface QuestionnaireQuestion {
  id: string;
  label: string;
  type: 'choice' | 'yesno' | 'text';
  options?: QuestionOption[];
  required?: boolean;
}

const QUESTIONS_BY_TYPE: Record<string, QuestionnaireQuestion[]> = {
  piscine: [
    { id: 'piscine_materiau', label: 'Matériau de la cuvette ?', type: 'choice', required: true, options: [
      { value: 'coque', label: 'Coque (rigide, prête à poser)' },
      { value: 'liner', label: 'Liner (membrane souple)' },
      { value: 'beton', label: 'Béton (coulé sur place)' },
      { value: 'acier', label: 'Acier (panneaux à assembler)' },
    ]},
    { id: 'piscine_forme', label: 'Forme ?', type: 'choice', options: [
      { value: 'rectangulaire', label: 'Rectangulaire' },
      { value: 'ronde', label: 'Ronde' },
      { value: 'ovale', label: 'Ovale' },
      { value: 'libre', label: 'Libre' },
    ]},
    { id: 'piscine_profondeur', label: 'Profondeur moyenne ?', type: 'choice', options: [
      { value: 'familliale', label: '< 1,2 m (familiale)' },
      { value: 'standard', label: '1,2–1,5 m (standard)' },
      { value: 'profonde', label: '> 1,5 m (profonde)' },
    ]},
    { id: 'piscine_equipements', label: 'Équipements souhaités ?', type: 'choice', options: [
      { value: 'skimmers_seul', label: 'Skimmers uniquement' },
      { value: 'skimmers_led', label: 'Skimmers + Éclairage LED' },
      { value: 'skimmers_led_chauffage', label: 'Skimmers + LED + Chauffage' },
      { value: 'complet', label: 'Complet (skimmers, LED, chauffage, couverture, traitement eau)' },
      { value: 'jacuzzi', label: 'Avec jacuzzi / spa' },
    ]},
    { id: 'piscine_terrasse', label: 'Terrasse / Tour de bassin ?', type: 'choice', options: [
      { value: 'non', label: 'Non' },
      { value: 'parquet', label: 'Parquet' },
      { value: 'carrelage', label: 'Carrelage' },
      { value: 'beton', label: 'Béton lissé' },
      { value: 'paves', label: 'Pavés' },
    ]},
    { id: 'piscine_terrain', label: "État actuel du terrain ?", type: 'choice', options: [
      { value: 'plat_sec', label: 'Plat et sec' },
      { value: 'pente_legere', label: 'Pente légère' },
      { value: 'pente_importante', label: 'Très pentu' },
      { value: 'humide', label: 'Terrain humide' },
    ]},
  ],
  renovation: [
    { id: 'renovation_pieces', label: 'Pièces à rénover ?', type: 'choice', required: true, options: [
      { value: 'sdb', label: 'Salle de bain' },
      { value: 'cuisine', label: 'Cuisine' },
      { value: 'chambres', label: 'Chambre(s)' },
      { value: 'salon', label: 'Salon' },
      { value: 'couloirs', label: 'Couloirs' },
      { value: 'exterieur', label: 'Extérieur' },
      { value: 'tout', label: 'Tout' },
    ]},
    { id: 'renovation_type_travaux', label: 'Type de travaux principaux ?', type: 'choice', options: [
      { value: 'peinture', label: 'Peinture seule' },
      { value: 'revetements', label: 'Revêtements seuls (carrelage, parquet)' },
      { value: 'plomberie_electricite', label: 'Plomberie / Électricité' },
      { value: 'menuiserie', label: 'Menuiserie / Portes' },
      { value: 'mixte', label: 'Mixte (plusieurs)' },
      { value: 'complete', label: 'Complète (murs, sols, plafonds, installations)' },
    ]},
    { id: 'renovation_niveau', label: 'Niveau de rénovation ?', type: 'choice', options: [
      { value: 'cosmetique', label: 'Cosmétique (peinture, décoration)' },
      { value: 'partielle', label: 'Partielle (revêtements + installations)' },
      { value: 'complete', label: 'Complète (structure, installations, finitions)' },
    ]},
    { id: 'renovation_etat_murs', label: 'État initial des murs / plafonds ?', type: 'choice', options: [
      { value: 'bon', label: 'Bon (léger lustrage)' },
      { value: 'moyen', label: 'Moyen (travaux de préparation)' },
      { value: 'mauvais', label: 'Mauvais (humidité, craquages, moisissures)' },
    ]},
    { id: 'renovation_cloisons', label: 'Cloisons / Ouvertures ?', type: 'choice', options: [
      { value: 'aucun', label: 'Aucun changement' },
      { value: 'abattage', label: 'Abattage cloison(s)' },
      { value: 'ouverture', label: 'Création ouverture(s)' },
      { value: 'creation_cloison', label: 'Création cloison(s)' },
    ]},
    { id: 'renovation_acces', label: 'Accès au chantier ?', type: 'choice', options: [
      { value: 'facile', label: 'Facile (rez-de-chaussée, portes larges)' },
      { value: 'moyen', label: 'Moyen (étage, escalier standard)' },
      { value: 'difficile', label: 'Difficile (escalier étroit, accès limité)' },
    ]},
    { id: 'renovation_finitions', label: 'Niveau de finition souhaité ?', type: 'choice', options: [
      { value: 'entree_gamme', label: 'Entrée de gamme' },
      { value: 'moyen', label: 'Moyen' },
      { value: 'haut_gamme', label: 'Haut de gamme' },
    ]},
    { id: 'renovation_chauffage', label: 'Installation / Chauffage ?', type: 'choice', options: [
      { value: 'conserve', label: 'Conserve existant' },
      { value: 'renovation', label: 'Rénovation (dépannage)' },
      { value: 'remplacement', label: 'Remplacement complet' },
    ]},
  ],
  terrasse: [
    { id: 'terrasse_materiau', label: 'Matériau principal ?', type: 'choice', required: true, options: [
      { value: 'bois', label: 'Bois (naturel, composite)' },
      { value: 'beton', label: 'Béton (coulé, dalles)' },
      { value: 'carrelage_paves', label: 'Carrelage / Pavés' },
      { value: 'gravier', label: 'Gravier / Minéral' },
    ]},
    { id: 'terrasse_dimensions', label: 'Dimensions ?', type: 'choice', options: [
      { value: 'petit', label: '< 20 m²' },
      { value: 'moyen', label: '20–50 m²' },
      { value: 'grand', label: '> 50 m²' },
    ]},
    { id: 'terrasse_terrain', label: 'Terrain de base ?', type: 'choice', options: [
      { value: 'plat_sec', label: 'Plat et sec' },
      { value: 'pente_legere', label: 'Pente légère (< 5 %)' },
      { value: 'pente_importante', label: 'Pente importante' },
      { value: 'humide', label: 'Terrain humide (drainage nécessaire)' },
    ]},
    { id: 'terrasse_fondations', label: 'Fondations / Base ?', type: 'choice', options: [
      { value: 'terre', label: 'Simplement poser sur terre' },
      { value: 'sable_gravier', label: 'Lit sable / gravier' },
      { value: 'dalle', label: 'Dalle béton' },
      { value: 'piliers', label: 'Piliers / Fondations profondes' },
    ]},
    { id: 'terrasse_elements', label: 'Éléments additionnels ?', type: 'choice', options: [
      { value: 'aucun', label: 'Aucun' },
      { value: 'pergola', label: 'Pergola / Abri' },
      { value: 'cloture', label: 'Clôture' },
      { value: 'escaliers', label: 'Escaliers' },
      { value: 'paysager', label: 'Aménagement paysager' },
    ]},
    { id: 'terrasse_etat', label: "État initial ?", type: 'choice', options: [
      { value: 'vierge', label: 'Zone vierge (herbe)' },
      { value: 'retirer', label: 'Terrasse existante à retirer' },
      { value: 'preparation', label: 'Légère préparation' },
    ]},
  ],
  plomberie: [
    { id: 'plomberie_nature', label: 'Nature des travaux ?', type: 'choice', required: true, options: [
      { value: 'reparation', label: 'Réparation / Dépannage (fuite, joint)' },
      { value: 'remplacement_partiel', label: 'Remplacement tuyauterie partielle' },
      { value: 'remplacement_complet', label: 'Remplacement complète (toute la maison)' },
      { value: 'installation_neuve', label: 'Installation neuve' },
    ]},
    { id: 'plomberie_materiau', label: 'Matériau tuyauterie actuelle ?', type: 'choice', options: [
      { value: 'cuivre', label: 'Cuivre' },
      { value: 'pvc', label: 'PVC' },
      { value: 'per', label: 'PER' },
      { value: 'ancienne', label: 'Ancienne (plomb, fonte)' },
    ]},
    { id: 'plomberie_acces', label: 'Accès aux tuyauteries ?', type: 'choice', options: [
      { value: 'surface', label: 'En surface (visible)' },
      { value: 'gaine', label: 'En gaine / dans les murs (accessible)' },
      { value: 'enrobes', label: 'Enrobées dans béton (destruction nécessaire)' },
    ]},
    { id: 'plomberie_etendue', label: "Étendue ?", type: 'choice', options: [
      { value: '1_piece', label: '1 pièce' },
      { value: '2_3_pieces', label: '2–3 pièces' },
      { value: 'maison_complete', label: 'Maison complète' },
    ]},
    { id: 'plomberie_ecs', label: 'Eau chaude sanitaire ?', type: 'choice', options: [
      { value: 'gaz', label: 'Gaz' },
      { value: 'electrique', label: 'Électrique' },
      { value: 'pac', label: 'Pompe à chaleur' },
      { value: 'pas_modification', label: 'Pas de modification' },
    ]},
    { id: 'plomberie_debouchage', label: 'Débouchage / Nettoyage ?', type: 'choice', options: [
      { value: 'non', label: 'Non' },
      { value: 'simple', label: 'Débouchage simple' },
      { value: 'curage', label: 'Curage complet' },
    ]},
  ],
  electricite: [
    { id: 'electricite_nature', label: 'Nature des travaux ?', type: 'choice', required: true, options: [
      { value: 'reparation_ajout', label: 'Réparation / Ajout prises-interrupteurs' },
      { value: 'tableau_partiel', label: 'Remplacement tableau partiel' },
      { value: 'tableau_complet', label: 'Remplacement complet tableau + distribution' },
      { value: 'normes', label: 'Installation aux normes (mise à la terre, différentiel)' },
    ]},
    { id: 'electricite_acces', label: 'Accès aux câbles ?', type: 'choice', options: [
      { value: 'surface', label: 'Surface (goulottes)' },
      { value: 'gaine', label: 'En gaine (accessible)' },
      { value: 'murs', label: 'Dans les murs (tranchées nécessaires)' },
    ]},
    { id: 'electricite_circuits', label: 'Nombre de nouveaux circuits ?', type: 'choice', options: [
      { value: '1_2', label: '1–2' },
      { value: '3_5', label: '3–5' },
      { value: 'plus_5', label: '> 5 (refonte complète)' },
    ]},
    { id: 'electricite_puissance', label: 'Puissance actuelle / demandée ?', type: 'choice', options: [
      { value: '6kva', label: '6 kVA (ancien)' },
      { value: '9kva', label: '9 kVA (standard)' },
      { value: '12kva', label: '12 kVA (consommation élevée)' },
      { value: 'augmentation', label: 'Augmentation puissance nécessaire' },
    ]},
    { id: 'electricite_speciaux', label: 'Travaux spéciaux ?', type: 'choice', options: [
      { value: 'standard', label: 'Standard' },
      { value: 'terre_differenciel', label: 'Mise à la terre + différentiels' },
      { value: 'led_chauffage', label: 'Éclairage LED / Chauffage électrique' },
      { value: 'domotique', label: 'Domotique / PAC' },
    ]},
    { id: 'electricite_acces_chantier', label: 'Accès au chantier ?', type: 'choice', options: [
      { value: 'facile', label: 'Facile' },
      { value: 'moyen', label: 'Moyen' },
      { value: 'difficile', label: 'Difficile (étroit, étage élevé)' },
    ]},
  ],
  peinture: [
    { id: 'peinture_surface', label: 'Surface totale à peindre (m² murs) ?', type: 'choice', options: [
      { value: 'moins_50', label: '< 50' },
      { value: '50_150', label: '50–150' },
      { value: '150_300', label: '150–300' },
      { value: 'plus_300', label: '> 300' },
    ]},
    { id: 'peinture_type', label: 'Type de peinture ?', type: 'choice', options: [
      { value: 'mur_interieur', label: 'Mur intérieur (classique)' },
      { value: 'speciale', label: 'Spéciale (humidité, moisissure, écologique)' },
      { value: 'exterieur', label: 'Extérieur (façade, portail)' },
      { value: 'bois', label: 'Bois (menuiserie, portes)' },
    ]},
    { id: 'peinture_preparation', label: 'Préparation requise ?', type: 'choice', options: [
      { value: 'decapage', label: 'Décapage complet (peinture écaillée)' },
      { value: 'poncage', label: 'Ponçage / Nettoyage normal' },
      { value: 'simple', label: 'Simple (bon état, raviver)' },
    ]},
    { id: 'peinture_couches', label: 'Nombre de couches ?', type: 'choice', options: [
      { value: '1', label: '1 couche (déjà peinte)' },
      { value: '2', label: '2 couches (standard)' },
      { value: '3_plus', label: '3+ couches (changement radical)' },
    ]},
    { id: 'peinture_finition', label: 'Finition ?', type: 'choice', options: [
      { value: 'mat', label: 'Mat' },
      { value: 'satin', label: 'Satin' },
      { value: 'brillant', label: 'Brillant' },
    ]},
    { id: 'peinture_mobilier', label: 'Dégagements / Mobilier ?', type: 'choice', options: [
      { value: 'vide', label: 'Pièces vides' },
      { value: 'leger', label: 'Mobilier léger (déplaçable)' },
      { value: 'lourd', label: 'Mobilier lourd (à protéger sur place)' },
    ]},
  ],
  maconnerie: [
    { id: 'maconnerie_nature', label: 'Nature des travaux ?', type: 'choice', required: true, options: [
      { value: 'petite_reparation', label: 'Petite réparation (joints, crépi)' },
      { value: 'muret_cloison', label: 'Création muret / cloison' },
      { value: 'demolition', label: 'Démolition partielle' },
      { value: 'enduit_facade', label: 'Enduit / Crépissage façade' },
      { value: 'structure', label: 'Structure (murs porteurs, renforcement)' },
    ]},
    { id: 'maconnerie_materiau', label: 'Matériau ?', type: 'choice', options: [
      { value: 'brique', label: 'Brique' },
      { value: 'parpaing', label: 'Parpaing' },
      { value: 'pierre', label: 'Pierre' },
      { value: 'beton_arme', label: 'Béton armé' },
    ]},
    { id: 'maconnerie_lineaire', label: 'Linéaire / Surface ?', type: 'choice', options: [
      { value: 'moins_10', label: '< 10 m linéaires' },
      { value: '10_30', label: '10–30 m' },
      { value: 'plus_30', label: '> 30 m' },
    ]},
    { id: 'maconnerie_finition', label: 'Type de finition ?', type: 'choice', options: [
      { value: 'enduit_ciment', label: 'Enduit ciment' },
      { value: 'crepi', label: 'Crépi' },
      { value: 'pierre_vue', label: 'Pierre visible' },
      { value: 'enduit_fin', label: 'Enduit fin' },
    ]},
    { id: 'maconnerie_acces', label: 'Accès / Équipements spéciaux ?', type: 'choice', options: [
      { value: 'aucun', label: 'Pas d\'équipement spécial' },
      { value: 'echafaudage', label: 'Échafaudage léger' },
      { value: 'plateforme', label: 'Plateformes élévatrices' },
      { value: 'grues', label: 'Grues' },
    ]},
  ],
  menuiserie: [
    { id: 'menuiserie_type', label: 'Type de menuiserie ?', type: 'choice', required: true, options: [
      { value: 'portes', label: 'Portes (pose, changement)' },
      { value: 'fenetres', label: 'Fenêtres (simple → double vitrage)' },
      { value: 'volets', label: 'Volets' },
      { value: 'escalier', label: 'Escalier' },
      { value: 'placards', label: 'Placards / Armoires' },
      { value: 'mixte', label: 'Mixte' },
    ]},
    { id: 'menuiserie_nb', label: "Nombre d'éléments ?", type: 'choice', options: [
      { value: '1_3', label: '1–3' },
      { value: '4_8', label: '4–8' },
      { value: 'plus_8', label: '> 8' },
    ]},
    { id: 'menuiserie_materiau', label: 'Matériau ?', type: 'choice', options: [
      { value: 'bois', label: 'Bois (pin, chêne, exotique)' },
      { value: 'aluminium', label: 'Aluminium' },
      { value: 'pvc', label: 'PVC' },
      { value: 'mixte', label: 'Mixte' },
    ]},
    { id: 'menuiserie_pose', label: 'Pose / Remplacement ?', type: 'choice', options: [
      { value: 'neuve', label: 'Pose neuve (construction)' },
      { value: 'remplacement', label: 'Remplacement (retrait ancien + pose)' },
    ]},
    { id: 'menuiserie_connexes', label: 'Travaux connexes ?', type: 'choice', options: [
      { value: 'seul', label: 'Fenêtres / portes seules' },
      { value: 'finitions_int', label: 'Finitions intérieures (appuis, joints)' },
      { value: 'finitions_ext', label: 'Finitions extérieures (appuis de fenêtre)' },
      { value: 'peinture', label: 'Peinture / Vernissage' },
    ]},
    { id: 'menuiserie_acces', label: 'Accès ?', type: 'choice', options: [
      { value: 'rdc', label: 'Rez-de-chaussée' },
      { value: 'etage', label: 'Étage (échelle / échafaudage léger)' },
      { value: 'hauteur', label: 'En hauteur (équipements spéciaux)' },
    ]},
  ],
  chauffage: [
    { id: 'chauffage_type', label: "Type d'installation ?", type: 'choice', options: [
      { value: 'chaudiere', label: 'Chaudière' },
      { value: 'pac', label: 'Pompe à chaleur' },
      { value: 'electrique', label: 'Électrique (radiateurs)' },
      { value: 'sol', label: 'Plancher chauffant' },
    ]},
    { id: 'chauffage_neuf', label: 'Installation neuve ou remplacement ?', type: 'yesno' },
  ],
  isolation: [
    { id: 'isolation_zone', label: 'Zone à isoler ?', type: 'choice', options: [
      { value: 'combles', label: 'Combles' },
      { value: 'murs', label: 'Murs' },
      { value: 'sol', label: 'Sol' },
      { value: 'global', label: 'Global (combles + murs)' },
    ]},
  ],
  paysage: [
    { id: 'paysage_type', label: "Type d'aménagement ?", type: 'choice', options: [
      { value: 'terrasse_allees', label: 'Terrasse / Allées' },
      { value: 'plantation', label: 'Plantation / Gazon' },
      { value: 'cloture', label: 'Clôture / Portail' },
      { value: 'eclairage', label: 'Éclairage extérieur' },
    ]},
  ],
  autre: [
    { id: 'autre_description', label: 'Décrivez précisément votre projet (min. 20 caractères)', type: 'text', required: true },
    { id: 'autre_materiaux', label: 'Matériaux ou éléments spécifiques ?', type: 'text' },
    { id: 'autre_complexite', label: 'Niveau de complexité perçu ?', type: 'choice', options: [
      { value: 'simple', label: 'Simple' },
      { value: 'moyen', label: 'Moyen' },
      { value: 'complexe', label: 'Complexe' },
    ]},
  ],
};

const YESNO_OPTIONS: QuestionOption[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
];

/**
 * Retourne la liste des questions pour un type de chantier donné.
 */
export function getQuestionsForType(metier: string): QuestionnaireQuestion[] {
  const questions = QUESTIONS_BY_TYPE[metier];
  if (!questions) return [];
  return questions.map((q) =>
    q.type === 'yesno' ? { ...q, options: YESNO_OPTIONS } : q
  );
}

/**
 * Vérifie si le type a des questions conditionnelles (pour afficher le bloc ou non).
 */
export function hasQuestionsForType(metier: string): boolean {
  const list = QUESTIONS_BY_TYPE[metier];
  return Array.isArray(list) && list.length > 0;
}

/**
 * Valide les réponses du questionnaire pour un type donné.
 * Retourne la liste des messages d'erreur (champs requis manquants ou trop courts).
 */
export function validateAnswers(type: string, answers: Record<string, string>): string[] {
  const errors: string[] = [];
  const questions = getQuestionsForType(type);
  for (const q of questions) {
    if (!q.required) continue;
    const value = answers[q.id];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      errors.push(`${q.label} est obligatoire.`);
      continue;
    }
    if (q.type === 'text' && q.id === 'autre_description' && trimmed.length < 20) {
      errors.push('La description du projet doit contenir au moins 20 caractères.');
    }
  }
  return errors;
}
