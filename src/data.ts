export type Family = 'succulentes' | 'aromatiques' | 'fougeres' | 'orchidees' | 'fleurs' | 'tropicales' | 'carnivores' | 'arbustes';
export type Rarity = 'commun' | 'rare' | 'exotique' | 'legendaire';
export type Shape = 'rosette' | 'aloe' | 'bush' | 'fern' | 'orchid' | 'paradise' | 'cactus' | 'grass' | 'bigleaf' | 'coin' | 'trap' | 'pitcher' | 'stem' | 'nest' | 'tree' | 'shrub' | 'rose';

export interface Species {
  id: string;
  name: string;
  latin: string;
  family: Family;
  rarity: Rarity;
  origin: string;
  /** Besoins sur une échelle 1..3 */
  light: number;
  temp: number;
  hum: number;
  /** Secondes pour atteindre la floraison dans des conditions idéales */
  grow: number;
  value: number;
  shape: Shape;
  leaf: number;
  flower: number;
  fact: string;
  tip: string;
  /** Taille adulte indicative. */
  height: string;
  /** Toxicité pour chats et chiens, quand elle est bien établie. */
  pets?: 'ok' | 'toxique';
  /** Taille de pot minimale : 1 petit (par défaut), 2 moyen, 3 grand. */
  size?: number;
}

export const FAMILIES: Record<Family, { name: string; icon: string; color: string; glaze: number }> = {
  succulentes: { name: 'Succulentes', icon: '🌵', color: '#6fbf8f', glaze: 0 },
  aromatiques: { name: 'Aromatiques', icon: '🌿', color: '#8fc45a', glaze: 1 },
  fougeres: { name: 'Fougères', icon: '🍃', color: '#3f9d6b', glaze: 3 },
  orchidees: { name: 'Orchidées', icon: '🌸', color: '#d78ad0', glaze: 6 },
  fleurs: { name: 'Fleurs', icon: '🌼', color: '#f2b441', glaze: 4 },
  tropicales: { name: 'Tropicales', icon: '🌴', color: '#2f9e7a', glaze: 5 },
  carnivores: { name: 'Carnivores', icon: '🪰', color: '#c0504d', glaze: 2 },
  arbustes: { name: 'Arbustes', icon: '🌳', color: '#7a9a4a', glaze: 7 },
};
export const FAMILY_IDS = Object.keys(FAMILIES) as Family[];

export const RARITIES: Record<Rarity, { name: string; color: string; weight: number }> = {
  commun: { name: 'Commun', color: '#8a9a86', weight: 72 },
  rare: { name: 'Rare', color: '#4a90d9', weight: 22 },
  exotique: { name: 'Exotique', color: '#b05fd6', weight: 5.5 },
  legendaire: { name: 'Légendaire', color: '#f0a020', weight: 0.5 },
};

export const SPECIES: Species[] = [
  { id: 'echeveria', name: 'Echeveria', latin: 'Echeveria elegans', family: 'succulentes', rarity: 'commun', origin: 'Mexique',
    light: 3, temp: 3, hum: 1, grow: 110, value: 12, shape: 'rosette', leaf: 0x8fcfb0, flower: 0xff8f7a,
    fact: 'Sa rosette serrée guide la moindre goutte de rosée vers ses racines.',
    tip: 'Arrose seulement quand la terre est sèche en profondeur : trop d\'eau la tue plus sûrement que l\'oubli.', height: '10 à 15 cm', pets: 'ok' },
  { id: 'aloe', name: 'Aloe vera', latin: 'Aloe vera', family: 'succulentes', rarity: 'commun', origin: 'Péninsule arabique',
    light: 3, temp: 3, hum: 1, grow: 140, value: 15, shape: 'aloe', leaf: 0x6fae7a, flower: 0xf6c343,
    fact: 'Ses feuilles stockent un gel utilisé depuis l\'Égypte antique.',
    tip: 'Un pot en terre cuite et un terreau très drainant : elle déteste avoir les racines mouillées.', height: '30 à 60 cm', pets: 'toxique' },
  { id: 'lithops', name: 'Plante caillou', latin: 'Lithops', family: 'succulentes', rarity: 'rare', origin: 'Afrique australe',
    light: 3, temp: 3, hum: 1, grow: 300, value: 55, shape: 'rosette', leaf: 0xb7a98c, flower: 0xfff2a8,
    fact: 'Elle imite un galet pour échapper aux herbivores du désert.',
    tip: 'Aucun arrosage en hiver : elle vit sur ses réserves.', height: '2 à 4 cm', pets: 'ok' },
  { id: 'basilic', name: 'Basilic', latin: 'Ocimum basilicum', family: 'aromatiques', rarity: 'commun', origin: 'Asie tropicale',
    light: 3, temp: 3, hum: 2, grow: 100, value: 10, shape: 'bush', leaf: 0x59b947, flower: 0xffffff,
    fact: 'Son nom vient du grec « basilikon », la plante royale.',
    tip: 'Pince les tiges au-dessus d\'une paire de feuilles : il se ramifie au lieu de monter en graines.', height: '30 à 50 cm', pets: 'ok' },
  { id: 'menthe', name: 'Menthe verte', latin: 'Mentha spicata', family: 'aromatiques', rarity: 'commun', origin: 'Europe',
    light: 2, temp: 1, hum: 2, grow: 100, value: 10, shape: 'bush', leaf: 0x3fa35c, flower: 0xc9a6e8,
    fact: 'Ses tiges souterraines peuvent coloniser un jardin entier en une saison.',
    tip: 'Cultive-la toujours en pot, même au jardin, sinon elle envahit tout.', height: '30 à 60 cm' },
  { id: 'lavande', name: 'Lavande', latin: 'Lavandula angustifolia', family: 'aromatiques', rarity: 'rare', origin: 'Bassin méditerranéen',
    light: 3, temp: 2, hum: 1, grow: 260, value: 42, shape: 'bush', leaf: 0x8fa58b, flower: 0x8b6fd6,
    fact: 'Les Romains en parfumaient leurs bains : son nom vient de « lavare », laver.',
    tip: 'Taille-la juste après la floraison, sans jamais couper dans le vieux bois.', height: '40 à 60 cm' },
  { id: 'boston', name: 'Fougère de Boston', latin: 'Nephrolepis exaltata', family: 'fougeres', rarity: 'commun', origin: 'Régions tropicales',
    light: 1, temp: 2, hum: 3, grow: 130, value: 14, shape: 'fern', leaf: 0x4fa85a, flower: 0x4fa85a,
    fact: 'Les fougères existaient déjà 100 millions d\'années avant les dinosaures.',
    tip: 'Brumise son feuillage : l\'air sec fait brunir le bout des frondes.', height: '40 à 90 cm', pets: 'ok' },
  { id: 'capillaire', name: 'Capillaire', latin: 'Adiantum raddianum', family: 'fougeres', rarity: 'rare', origin: 'Amérique du Sud',
    light: 1, temp: 2, hum: 3, grow: 280, value: 48, shape: 'fern', leaf: 0x7fcf7a, flower: 0x7fcf7a,
    fact: 'Ses frondes repoussent l\'eau : les gouttes y perlent sans les mouiller.',
    tip: 'Ne laisse jamais sécher sa motte, même une seule journée.', height: '30 à 40 cm', pets: 'ok' },
  { id: 'pensee', name: 'Pensée', latin: 'Viola × wittrockiana', family: 'fleurs', rarity: 'commun', origin: 'Europe (hybride horticole)',
    light: 2, temp: 1, hum: 2, grow: 120, value: 13, shape: 'bush', leaf: 0x4f9d4a, flower: 0x7a4fd0,
    fact: 'Ses fleurs sont comestibles et décorent les salades.',
    tip: 'Retire les fleurs fanées : elle refleurit pendant des mois.', height: '15 à 20 cm' },
  { id: 'pelargonium', name: 'Géranium des balcons', latin: 'Pelargonium × hortorum', family: 'fleurs', rarity: 'commun', origin: 'Afrique du Sud',
    light: 3, temp: 2, hum: 1, grow: 130, value: 14, shape: 'bush', leaf: 0x5aa64f, flower: 0xe8433f,
    fact: 'Ce n\'est pas un vrai géranium : les botanistes l\'ont séparé du genre Geranium dès 1789.',
    tip: 'Rentre-le au frais et au sec en hiver, il repartira au printemps.', height: '30 à 50 cm', pets: 'toxique' },
  { id: 'strelitzia', name: 'Oiseau de paradis', latin: 'Strelitzia reginae', family: 'fleurs', rarity: 'exotique', origin: 'Afrique du Sud',
    light: 3, temp: 3, hum: 2, grow: 460, value: 140, shape: 'paradise', leaf: 0x3f8f5f, flower: 0xff8a1f,
    fact: 'Sa fleur s\'ouvre sous le poids des oiseaux qui viennent la polliniser.',
    tip: 'Elle ne fleurit qu\'à l\'étroit : ne la rempote pas trop souvent.', height: '1 à 1,5 m', pets: 'toxique' },
  { id: 'phalaenopsis', name: 'Orchidée papillon', latin: 'Phalaenopsis amabilis', family: 'orchidees', rarity: 'rare', origin: 'Asie du Sud-Est',
    light: 2, temp: 3, hum: 3, grow: 320, value: 60, shape: 'orchid', leaf: 0x3f8f55, flower: 0xf5e9f7,
    fact: 'Dans la nature elle vit accrochée aux arbres, les racines à l\'air libre.',
    tip: 'Trempe le pot dix minutes une fois par semaine, puis laisse bien égoutter.', height: '30 à 60 cm', pets: 'ok' },
  { id: 'paphiopedilum', name: 'Sabot de Vénus', latin: 'Paphiopedilum', family: 'orchidees', rarity: 'exotique', origin: 'Asie du Sud-Est',
    light: 1, temp: 2, hum: 3, grow: 480, value: 150, shape: 'orchid', leaf: 0x4a8a4a, flower: 0xc9d85a,
    fact: 'Son labelle en forme de sabot piège les insectes pour les forcer à la polliniser.',
    tip: 'Contrairement aux autres orchidées, garde son substrat toujours légèrement frais.', height: '20 à 40 cm' },
  { id: 'fantome', name: 'Orchidée fantôme', latin: 'Dendrophylax lindenii', family: 'orchidees', rarity: 'legendaire', origin: 'Floride et Cuba',
    light: 1, temp: 3, hum: 3, grow: 720, value: 420, shape: 'orchid', leaf: 0x7fae8a, flower: 0xffffff,
    fact: 'Elle n\'a pas de feuilles : ce sont ses racines vertes qui font la photosynthèse.',
    tip: 'Presque impossible à cultiver chez soi : elle se contemple en serre botanique.', height: 'racines de 50 cm' },
  { id: 'haworthia', name: 'Haworthia zébrée', latin: 'Haworthiopsis attenuata', family: 'succulentes', rarity: 'commun', origin: 'Afrique du Sud',
    light: 2, temp: 2, hum: 1, grow: 150, value: 16, shape: 'aloe', leaf: 0x3f7f5a, flower: 0xffffff,
    fact: 'Ses bandes blanches sont de petites verrues qui réfléchissent le soleil.',
    tip: 'Une des rares succulentes heureuses loin de la fenêtre : parfaite pour un bureau.', height: '10 à 15 cm', pets: 'ok' },
  { id: 'echinocactus', name: 'Coussin de belle-mère', latin: 'Echinocactus grusonii', family: 'succulentes', rarity: 'rare', origin: 'Mexique',
    light: 3, temp: 3, hum: 1, grow: 340, value: 62, shape: 'cactus', leaf: 0x5f9f5a, flower: 0xf6d04a,
    fact: 'Très commun en jardinerie, il est pourtant menacé d\'extinction dans la nature.',
    tip: 'Tourne le pot d\'un quart de tour chaque mois pour qu\'il pousse bien rond.', height: '30 à 80 cm' },
  { id: 'opuntia', name: 'Figuier de Barbarie', latin: 'Opuntia ficus-indica', family: 'succulentes', rarity: 'rare', origin: 'Mexique',
    light: 3, temp: 3, hum: 1, grow: 300, value: 50, shape: 'cactus', leaf: 0x6fae6a, flower: 0xf08a3a,
    fact: 'Ses raquettes sont des tiges aplaties, pas des feuilles, et ses fruits se mangent.',
    tip: 'Une raquette posée sur du sable sec s\'enracine toute seule en quelques semaines.', height: '1 à 3 m' },
  { id: 'thym', name: 'Thym', latin: 'Thymus vulgaris', family: 'aromatiques', rarity: 'commun', origin: 'Bassin méditerranéen',
    light: 3, temp: 2, hum: 1, grow: 110, value: 11, shape: 'bush', leaf: 0x7f9f6f, flower: 0xe6b8e8,
    fact: 'Les Égyptiens l\'utilisaient pour embaumer leurs morts.',
    tip: 'Plus le sol est pauvre et sec, plus son parfum est puissant.', height: '15 à 30 cm', pets: 'ok' },
  { id: 'romarin', name: 'Romarin', latin: 'Salvia rosmarinus', family: 'aromatiques', rarity: 'commun', origin: 'Bassin méditerranéen',
    light: 3, temp: 2, hum: 1, grow: 140, value: 14, shape: 'bush', leaf: 0x5f8f6f, flower: 0x9fb4f0,
    fact: 'Les botanistes l\'ont reclassé parmi les sauges en 2017.',
    tip: 'Il se bouture dans un simple verre d\'eau.', height: '0,5 à 1,5 m', pets: 'ok' },
  { id: 'ciboulette', name: 'Ciboulette', latin: 'Allium schoenoprasum', family: 'aromatiques', rarity: 'commun', origin: 'Europe et Asie',
    light: 2, temp: 1, hum: 2, grow: 100, value: 10, shape: 'grass', leaf: 0x5fae5a, flower: 0xc58ae0,
    fact: 'Ses pompons mauves sont comestibles et ont un goût d\'oignon doux.',
    tip: 'Coupe-la à deux centimètres du sol : elle repousse en quelques jours.', height: '20 à 30 cm', pets: 'toxique' },
  { id: 'platycerium', name: 'Corne de cerf', latin: 'Platycerium bifurcatum', family: 'fougeres', rarity: 'exotique', origin: 'Australie et Nouvelle-Guinée',
    light: 2, temp: 2, hum: 3, grow: 450, value: 135, shape: 'fern', leaf: 0x7faf8a, flower: 0x7faf8a,
    fact: 'Elle pousse accrochée aux troncs et se nourrit des feuilles mortes qui tombent dans son bouclier.',
    tip: 'Accroche-la à une planche et baigne le tout une fois par semaine.', height: '60 à 90 cm', pets: 'ok' },
  { id: 'asplenium', name: 'Fougère nid d\'oiseau', latin: 'Asplenium nidus', family: 'fougeres', rarity: 'rare', origin: 'Asie tropicale',
    light: 1, temp: 3, hum: 3, grow: 300, value: 52, shape: 'nest', leaf: 0x6fc05a, flower: 0x6fc05a,
    fact: 'Sa rosette en entonnoir recueille l\'eau de pluie et les débris dont elle se nourrit.',
    tip: 'Arrose autour du cœur, jamais dedans : il pourrit facilement.', height: '40 à 100 cm', pets: 'ok' },
  { id: 'cattleya', name: 'Cattleya', latin: 'Cattleya labiata', family: 'orchidees', rarity: 'exotique', origin: 'Brésil',
    light: 2, temp: 3, hum: 2, grow: 470, value: 145, shape: 'orchid', leaf: 0x4f9050, flower: 0xd070d8,
    fact: 'Découverte par hasard en 1818 : ses feuilles servaient à emballer d\'autres plantes expédiées en Angleterre.',
    tip: 'Laisse sécher complètement entre deux arrosages, ses pseudobulbes font réserve.', height: '30 à 60 cm' },
  { id: 'dendrobium', name: 'Dendrobium', latin: 'Dendrobium nobile', family: 'orchidees', rarity: 'rare', origin: 'Himalaya et Asie du Sud-Est',
    light: 2, temp: 2, hum: 2, grow: 330, value: 58, shape: 'orchid', leaf: 0x5f9a55, flower: 0xf0b0e0,
    fact: 'Son nom signifie « qui vit sur les arbres ».',
    tip: 'Quelques semaines au frais et au sec en hiver déclenchent sa floraison.', height: '30 à 60 cm' },
  { id: 'tournesol', name: 'Tournesol', latin: 'Helianthus annuus', family: 'fleurs', rarity: 'commun', origin: 'Amérique du Nord',
    light: 3, temp: 2, hum: 2, grow: 150, value: 16, shape: 'stem', leaf: 0x5aa64f, flower: 0xf6c343,
    fact: 'Seuls les jeunes boutons suivent le soleil : la fleur ouverte reste tournée vers l\'est.',
    tip: 'Sème directement en place, il déteste être repiqué.', height: '1 à 3 m', pets: 'ok' },
  { id: 'tulipe', name: 'Tulipe', latin: 'Tulipa gesneriana', family: 'fleurs', rarity: 'commun', origin: 'Asie centrale',
    light: 3, temp: 1, hum: 2, grow: 140, value: 15, shape: 'stem', leaf: 0x6fae6a, flower: 0xe8433f,
    fact: 'Elle vient des montagnes d\'Asie centrale, pas des Pays-Bas.',
    tip: 'Le bulbe a besoin du froid de l\'hiver pour fleurir : plante-le à l\'automne.', height: '30 à 60 cm', pets: 'toxique' },
  { id: 'hibiscus', name: 'Hibiscus', latin: 'Hibiscus rosa-sinensis', family: 'fleurs', rarity: 'rare', origin: 'Asie',
    light: 3, temp: 3, hum: 2, grow: 310, value: 56, shape: 'bush', leaf: 0x3f8f4a, flower: 0xf04a6a,
    fact: 'Chacune de ses fleurs ne vit qu\'une seule journée.',
    tip: 'Ne le déplace pas quand il est en boutons, il les laisserait tomber.', height: '1 à 2 m', pets: 'ok' },
  { id: 'semper', name: 'Tulipe Semper Augustus', latin: 'Tulipa « Semper Augustus »', family: 'fleurs', rarity: 'legendaire', origin: 'Hollande, XVIIe siècle',
    light: 3, temp: 1, hum: 2, grow: 700, value: 400, shape: 'stem', leaf: 0x6fae6a, flower: 0xfff4f0,
    fact: 'En 1637, un seul de ses bulbes valait le prix d\'une maison à Amsterdam. Ses flammes rouges venaient d\'un virus.',
    tip: 'La variété a disparu : les tulipes flammées d\'aujourd\'hui sont saines et stables.', height: '40 à 50 cm', pets: 'toxique' },
  { id: 'monstera', name: 'Monstera', latin: 'Monstera deliciosa', family: 'tropicales', rarity: 'rare', origin: 'Amérique centrale',
    light: 2, temp: 3, hum: 3, grow: 320, value: 60, shape: 'bigleaf', leaf: 0x2f8f5a, flower: 0xfff6d8,
    fact: 'Ses feuilles se percent pour laisser passer la pluie et la lumière vers celles du dessous.',
    tip: 'Donne-lui un tuteur en mousse : ses racines aériennes s\'y accrochent et les feuilles grandissent.', height: '2 à 3 m', pets: 'toxique' },
  { id: 'calathea', name: 'Calathéa', latin: 'Goeppertia orbifolia', family: 'tropicales', rarity: 'rare', origin: 'Bolivie',
    light: 1, temp: 3, hum: 3, grow: 300, value: 54, shape: 'bigleaf', leaf: 0x5fae7a, flower: 0xffffff,
    fact: 'Elle replie ses feuilles le soir comme des mains en prière.',
    tip: 'Arrose à l\'eau de pluie : le calcaire brunit le bord des feuilles.', height: '60 à 90 cm', pets: 'ok' },
  { id: 'pilea', name: 'Plante à monnaie chinoise', latin: 'Pilea peperomioides', family: 'tropicales', rarity: 'commun', origin: 'Chine',
    light: 2, temp: 2, hum: 2, grow: 130, value: 14, shape: 'coin', leaf: 0x4fae6a, flower: 0xffffff,
    fact: 'Elle s\'est répandue en Europe de bouture en bouture, entre amis, avant même d\'être décrite par les botanistes.',
    tip: 'Détache les rejets qui sortent de terre et offre-les : c\'est sa tradition.', height: '20 à 30 cm', pets: 'ok' },
  { id: 'chlorophytum', name: 'Plante araignée', latin: 'Chlorophytum comosum', family: 'tropicales', rarity: 'commun', origin: 'Afrique du Sud',
    light: 2, temp: 2, hum: 2, grow: 110, value: 12, shape: 'grass', leaf: 0x7fc56a, flower: 0xffffff,
    fact: 'Elle fabrique des bébés tout prêts au bout de longues tiges.',
    tip: 'Presque increvable : idéale pour un premier essai.', height: '30 à 40 cm', pets: 'ok' },
  { id: 'anthurium', name: 'Anthurium', latin: 'Anthurium andraeanum', family: 'tropicales', rarity: 'exotique', origin: 'Colombie et Équateur',
    light: 2, temp: 3, hum: 3, grow: 440, value: 130, shape: 'bigleaf', leaf: 0x2f7f4a, flower: 0xe8303a,
    fact: 'Son cœur rouge ciré n\'est pas un pétale mais une feuille transformée.',
    tip: 'Essuie ses feuilles à l\'éponge humide, il respire mieux et brille.', height: '40 à 60 cm', pets: 'toxique' },
  { id: 'dionee', name: 'Dionée attrape-mouche', latin: 'Dionaea muscipula', family: 'carnivores', rarity: 'rare', origin: 'Caroline du Nord et du Sud',
    light: 3, temp: 2, hum: 3, grow: 300, value: 58, shape: 'trap', leaf: 0x6fbf4a, flower: 0xffffff,
    fact: 'Son piège ne se ferme que si deux poils sont touchés en moins de vingt secondes : elle sait compter.',
    tip: 'Uniquement de l\'eau de pluie, et ne la nourris jamais de viande.', height: '10 à 15 cm', pets: 'ok' },
  { id: 'drosera', name: 'Rossolis du Cap', latin: 'Drosera capensis', family: 'carnivores', rarity: 'rare', origin: 'Afrique du Sud',
    light: 3, temp: 2, hum: 3, grow: 280, value: 50, shape: 'grass', leaf: 0xb0c84a, flower: 0xe060a0,
    fact: 'Ses feuilles couvertes de gouttes de glu s\'enroulent autour des moucherons.',
    tip: 'Garde toujours un fond d\'eau de pluie dans la soucoupe.', height: '10 à 20 cm' },
  { id: 'sarracenia', name: 'Sarracénie pourpre', latin: 'Sarracenia purpurea', family: 'carnivores', rarity: 'exotique', origin: 'Amérique du Nord',
    light: 3, temp: 1, hum: 3, grow: 460, value: 140, shape: 'pitcher', leaf: 0x8fae4a, flower: 0x9a2f4a,
    fact: 'Ses urnes remplies d\'eau de pluie abritent tout un petit monde de larves qui digèrent ses proies.',
    tip: 'Elle a besoin d\'un vrai hiver froid, dehors, pour repartir au printemps.', height: '20 à 30 cm' },
  // ---- Arbustes : il leur faut un pot moyen ou grand, façonné à l'atelier.
  { id: 'figuier', name: 'Figuier', latin: 'Ficus carica', family: 'arbustes', rarity: 'commun', origin: 'Asie occidentale', size: 3,
    light: 3, temp: 3, hum: 1, grow: 420, value: 70, shape: 'tree', leaf: 0x5f9a4a, flower: 0x7a4a8a,
    fact: 'La figue n\'est pas un fruit mais une fleur retournée sur elle-même.',
    tip: 'En pot, rentre-le hors gel l\'hiver et taille court en fin d\'hiver pour le garder compact.', height: '1 à 3 m en pot', pets: 'toxique' },
  { id: 'hortensia', name: 'Hortensia', latin: 'Hydrangea macrophylla', family: 'arbustes', rarity: 'commun', origin: 'Japon', size: 2,
    light: 2, temp: 1, hum: 2, grow: 320, value: 48, shape: 'shrub', leaf: 0x4f9a55, flower: 0x7fa6e8,
    fact: 'Ses fleurs virent au bleu en sol acide et au rose en sol calcaire.',
    tip: 'Ne coupe pas les fleurs fanées avant la fin de l\'hiver : elles protègent les bourgeons du gel.', height: '1 à 1,5 m', pets: 'toxique' },
  { id: 'olivier', name: 'Olivier', latin: 'Olea europaea', family: 'arbustes', rarity: 'rare', origin: 'Bassin méditerranéen', size: 3,
    light: 3, temp: 3, hum: 1, grow: 600, value: 170, shape: 'tree', leaf: 0x93a98a, flower: 0x3f4a2a,
    fact: 'Certains oliviers de Méditerranée ont plus de deux mille ans et donnent encore des fruits.',
    tip: 'Il supporte la sécheresse mais pas l\'eau stagnante : un pot percé et un terreau caillouteux.', height: '1,5 à 2 m en pot', pets: 'ok' },
  { id: 'citronnier', name: 'Citronnier', latin: 'Citrus limon', family: 'arbustes', rarity: 'rare', origin: 'Asie', size: 3,
    light: 3, temp: 2, hum: 1, grow: 620, value: 180, shape: 'tree', leaf: 0x3f8f4a, flower: 0xf6d83a,
    fact: 'Il porte en même temps des fleurs, des fruits verts et des fruits mûrs.',
    tip: 'Sors-le au soleil dès mai et rentre-le dans une pièce fraîche et lumineuse avant les gelées.', height: '1 à 2 m en pot', pets: 'toxique' },
  { id: 'camelia', name: 'Camélia', latin: 'Camellia japonica', family: 'arbustes', rarity: 'rare', origin: 'Japon', size: 2,
    light: 2, temp: 1, hum: 2, grow: 540, value: 150, shape: 'shrub', leaf: 0x2f6f3f, flower: 0xe8607a,
    fact: 'Il fleurit en plein hiver, quand presque rien d\'autre n\'ose le faire.',
    tip: 'Terre de bruyère obligatoire, et jamais de soleil du matin sur des boutons gelés.', height: '1,5 à 3 m', pets: 'ok' },
  { id: 'erable', name: 'Érable du Japon', latin: 'Acer palmatum', family: 'arbustes', rarity: 'exotique', origin: 'Japon', size: 3,
    light: 1, temp: 2, hum: 2, grow: 900, value: 520, shape: 'tree', leaf: 0xc9483a, flower: 0xe86a3a,
    fact: 'Son feuillage change de couleur trois fois dans l\'année.',
    tip: 'À l\'abri du vent et du soleil brûlant : ses feuilles fines grillent en quelques heures.', height: '1 à 2 m en pot', pets: 'ok' },
  { id: 'bonsai', name: 'Bonsaï de genévrier', latin: 'Juniperus chinensis', family: 'arbustes', rarity: 'legendaire', origin: 'Chine', size: 2,
    light: 3, temp: 2, hum: 1, grow: 1500, value: 2600, shape: 'tree', leaf: 0x3f7f5f, flower: 0x8fcf9a,
    fact: 'Certains bonsaïs se transmettent de génération en génération depuis plus de cinq siècles.',
    tip: 'C\'est un arbre d\'extérieur : dedans, il dépérit en quelques semaines.', height: '30 à 60 cm', pets: 'toxique' },
  // ---- Nouvelles fleurs
  { id: 'dahlia', name: 'Dahlia', latin: 'Dahlia pinnata', family: 'fleurs', rarity: 'commun', origin: 'Mexique',
    light: 3, temp: 3, hum: 1, grow: 150, value: 16, shape: 'rose', leaf: 0x4f9a4a, flower: 0xe8563a,
    fact: 'Les Aztèques mangeaient ses tubercules bien avant qu\'on l\'admire pour ses fleurs.',
    tip: 'Déterre les tubercules après les premières gelées et garde-les au sec jusqu\'au printemps.', height: '40 cm à 1,2 m', pets: 'toxique' },
  { id: 'muguet', name: 'Muguet', latin: 'Convallaria majalis', family: 'fleurs', rarity: 'commun', origin: 'Europe',
    light: 1, temp: 2, hum: 2, grow: 130, value: 14, shape: 'grass', leaf: 0x4fa85a, flower: 0xffffff,
    fact: 'On l\'offre le premier mai depuis la Renaissance. Toute la plante est toxique.',
    tip: 'Il aime l\'ombre des arbres et se propage tout seul par ses rhizomes.', height: '15 à 25 cm', pets: 'toxique' },
  { id: 'rose', name: 'Rosier ancien', latin: 'Rosa gallica', family: 'fleurs', rarity: 'rare', origin: 'Europe', size: 2,
    light: 3, temp: 2, hum: 1, grow: 380, value: 95, shape: 'rose', leaf: 0x3f8a4a, flower: 0xd8365a,
    fact: 'Les croisés auraient rapporté ce rosier d\'Orient ; il a servi à parfumer l\'Europe pendant des siècles.',
    tip: 'Taille-le en fin d\'hiver au-dessus d\'un œil tourné vers l\'extérieur.', height: '80 cm à 1,2 m', pets: 'ok' },
  { id: 'pivoine', name: 'Pivoine', latin: 'Paeonia lactiflora', family: 'fleurs', rarity: 'exotique', origin: 'Chine', size: 2,
    light: 2, temp: 1, hum: 2, grow: 700, value: 420, shape: 'rose', leaf: 0x3f7f4a, flower: 0xf2a6c4,
    fact: 'Une pivoine peut vivre plus de cinquante ans au même endroit.',
    tip: 'Ne l\'enterre pas trop profond et ne la déplace jamais : elle bouderait plusieurs années.', height: '70 cm à 1 m', pets: 'toxique' },
];
const MEDIUM = ['monstera', 'strelitzia', 'tournesol', 'hibiscus', 'opuntia'];
for (const sp of SPECIES) if (MEDIUM.includes(sp.id)) sp.size = 2;
export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export interface Zone { id: string; name: string; icon: string; light: number; temp: number; hum: number; desc: string }
export const ZONES: Zone[] = [
  { id: 'ombre', name: 'Sous l\'étagère', icon: '🌑', light: 1, temp: 2, hum: 2, desc: 'Ombre fraîche du fond de la serre' },
  { id: 'bassin', name: 'Près du bassin', icon: '💦', light: 2, temp: 3, hum: 3, desc: 'Air chaud et humide' },
  { id: 'porte', name: 'Près de la porte', icon: '🚪', light: 2, temp: 1, hum: 2, desc: 'Courant d\'air frais' },
  { id: 'sud', name: 'Table plein sud', icon: '☀️', light: 3, temp: 3, hum: 1, desc: 'Baignée de soleil, air sec' },
];
export const SLOTS_PER_ZONE = 3;
/** Emplacements au sol : trois par zone. */
export const BASE_SLOTS = ZONES.length * SLOTS_PER_ZONE;
/** S'y ajoute une suspension par zone (emplacements 12 à 15), à acheter. */
export const HANG_SLOTS = ZONES.length;
/** Le jardin, derrière la porte : trois emplacements en plein air (16 à 18). Son climat suit les saisons. */
export const GARDEN: Zone = { id: 'jardin', name: 'Le jardin', icon: '🌳', light: 3, temp: 2, hum: 2, desc: 'En plein air : le climat change à chaque saison' };
export const GARDEN_INDEX = ZONES.length;
export const GARDEN_SLOTS = 3;
export const GARDEN_FIRST = BASE_SLOTS + HANG_SLOTS;
/** Climat du jardin au printemps, en été, en automne, en hiver. */
export const GARDEN_CLIMATE = [{ light: 3, temp: 2, hum: 2 }, { light: 3, temp: 3, hum: 1 }, { light: 2, temp: 2, hum: 3 }, { light: 2, temp: 1, hum: 2 }];
export const SLOT_COUNT = GARDEN_FIRST + GARDEN_SLOTS;

export const STAGES = ['Graine', 'Pousse', 'Végétatif', 'Boutons', 'Floraison'];
export const LEVEL_WORDS = {
  light: ['', 'Ombre', 'Mi-ombre', 'Plein soleil'],
  temp: ['', 'Frais', 'Tempéré', 'Chaud'],
  hum: ['', 'Air sec', 'Air moyen', 'Air humide'],
};

export interface NewsTemplate { family: Family; dir: 1 | -1; text: string }
export const NEWS: NewsTemplate[] = [
  { family: 'succulentes', dir: 1, text: 'Un magazine déco consacre sa une aux mini-jardins de succulentes.' },
  { family: 'succulentes', dir: -1, text: 'Les jardineries bradent leurs stocks de succulentes après un arrivage massif.' },
  { family: 'aromatiques', dir: 1, text: 'Une émission de cuisine fait exploser la demande d\'herbes fraîches.' },
  { family: 'aromatiques', dir: -1, text: 'Récolte record chez les maraîchers : les aromatiques inondent les étals.' },
  { family: 'fougeres', dir: 1, text: 'Un grand hôtelier végétalise ses halls : les fougères sont recherchées.' },
  { family: 'fougeres', dir: -1, text: 'La mode du « tout minéral » détourne les décorateurs des fougères.' },
  { family: 'orchidees', dir: 1, text: 'Salon international de l\'orchidée : les collectionneurs s\'arrachent les beaux spécimens.' },
  { family: 'orchidees', dir: -1, text: 'Un producteur néerlandais casse les prix des orchidées en grande surface.' },
  { family: 'fleurs', dir: 1, text: 'Saison des mariages : les fleuristes cherchent des fleurs en pot.' },
  { family: 'fleurs', dir: -1, text: 'Semaine pluvieuse annoncée : les balcons attendront, les fleurs se vendent mal.' },
  { family: 'tropicales', dir: 1, text: 'Une série à succès se passe dans un appartement jungle : tout le monde veut sa plante tropicale.' },
  { family: 'tropicales', dir: -1, text: 'Vague de froid annoncée : les acheteurs boudent les tropicales frileuses.' },
  { family: 'carnivores', dir: 1, text: 'Été à moucherons : les plantes carnivores s\'arrachent.' },
  { family: 'carnivores', dir: -1, text: 'Un documentaire rappelle qu\'elles sont difficiles à garder : les débutants hésitent.' },
  { family: 'succulentes', dir: 1, text: 'Les succulentes font le buzz sur les réseaux : tout le monde en veut sur son bureau.' },
  { family: 'orchidees', dir: 1, text: 'Fête des mères en approche : l\'orchidée reste le cadeau préféré.' },
];

/** Poterie : tailles de pots, émaux et motifs. */
export const POT_SIZES = [
  { name: 'Petit pot', short: 'petit', clay: 2, fire: 40, scale: 1 },
  { name: 'Pot moyen', short: 'moyen', clay: 5, fire: 120, scale: 1.2 },
  { name: 'Grand pot', short: 'grand', clay: 9, fire: 300, scale: 1.42 },
];
/** `stars` : étoiles d'almanach nécessaires pour débloquer l'émail. */
export const GLAZES = [
  { name: 'Terre cuite', color: 0xc9714a, rim: 0xd9825a, stars: 0 },
  { name: 'Crème', color: 0xf1e8da, rim: 0xffffff, stars: 0 },
  { name: 'Ardoise', color: 0x4f5d6b, rim: 0x6f7f8f, stars: 0 },
  { name: 'Céladon', color: 0x9fcdb4, rim: 0xc4e6d4, stars: 5 },
  { name: 'Bleu de Delft', color: 0x3f6fb5, rim: 0xf4f4f0, stars: 12 },
  { name: 'Ocre', color: 0xd9a441, rim: 0xedc46a, stars: 20 },
  { name: 'Rose poudré', color: 0xe8a8b4, rim: 0xf6cdd5, stars: 30 },
  { name: 'Bleu nuit', color: 0x2a2f55, rim: 0xe8c26a, stars: 45 },
  { name: 'Or', color: 0xe2b33c, rim: 0xfff0b0, stars: 70 },
];
export const PATTERNS = ['Uni', 'Bandes', 'Pois'];
export const CLIENTS = ['Mme Rosier', 'M. Dubois', 'Léa la fleuriste', 'Le café du coin', 'Mamie Jeanne', 'L\'école du quartier', 'Dr Lambert', 'La mairie'];

/** Saisons : chacune dure SEASON_LENGTH secondes de jeu et favorise deux familles. */
export const SEASON_LENGTH = 20 * 60;
export const SEASONS: { name: string; icon: string; fams: Family[]; text: string }[] = [
  { name: 'Printemps', icon: '🌸', fams: ['fleurs', 'aromatiques'], text: 'Tout bourgeonne : les fleurs et les aromatiques poussent plus vite.' },
  { name: 'Été', icon: '☀️', fams: ['succulentes', 'tropicales'], text: 'Chaleur et lumière : les succulentes et les tropicales sont à la fête.' },
  { name: 'Automne', icon: '🍂', fams: ['arbustes', 'fougeres'], text: 'Air doux et humide : les arbustes et les fougères en profitent.' },
  { name: 'Hiver', icon: '❄️', fams: ['orchidees', 'carnivores'], text: 'Au chaud dans la serre, les orchidées et les carnivores s\'épanouissent.' },
];

/** Couleurs du pinceau : les émaux (débloqués par les étoiles) puis quelques couleurs libres. */
export const PAINTS: { name: string; color: number; stars: number }[] = [
  ...GLAZES.map((g) => ({ name: g.name, color: g.color, stars: g.stars })),
  { name: 'Blanc', color: 0xffffff, stars: 0 },
  { name: 'Noir', color: 0x2b2b33, stars: 0 },
  { name: 'Rouge', color: 0xd8453a, stars: 0 },
  { name: 'Vert', color: 0x4fae6a, stars: 0 },
  { name: 'Jaune', color: 0xf6d04a, stars: 0 },
];
/** Forme d'un pot : rayons de bas en haut, modelés au tour. */
export const POT_RINGS = 7;
export const DEFAULT_PROF = [0.26, 0.277, 0.293, 0.31, 0.327, 0.343, 0.36];
export const PROF_MIN = 0.15;
export const PROF_MAX = 0.48;
/** Grille de peinture d'un pot : PAINT_W cases autour, PAINT_H en hauteur. */
export const PAINT_W = 144;
export const PAINT_H = 48;
