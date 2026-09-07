export type Species = {
  id: string;
  name: string;
  note: string;
  startArea: number;
  growthRate: number;
  range: string;
  status: "Supported" | "Limited evidence";
};

export const areas = [
  "Carlton",
  "Carlton North",
  "Docklands",
  "East Melbourne",
  "Kensington",
  "Melbourne CBD",
  "North Melbourne",
  "Parkville",
  "Southbank",
  "South Wharf",
  "West Melbourne",
  "Fitzroy",
  "Princes Hill",
];

export const species: Species[] = [
  {
    id: "river-red-gum",
    name: "River Red Gum",
    note: "Fast growing, high shade coverage",
    startArea: 3.8,
    growthRate: 0.102,
    range: "28–104 m²",
    status: "Supported",
  },
  {
    id: "london-plane",
    name: "London Plane",
    note: "Large mature canopy",
    startArea: 3.2,
    growthRate: 0.094,
    range: "24–92 m²",
    status: "Supported",
  },
  {
    id: "spotted-gum",
    name: "Spotted Gum",
    note: "Tolerant urban street tree",
    startArea: 2.9,
    growthRate: 0.088,
    range: "21–79 m²",
    status: "Supported",
  },
  {
    id: "elm",
    name: "Elm",
    note: "Broad canopy for boulevards",
    startArea: 3.5,
    growthRate: 0.091,
    range: "25–88 m²",
    status: "Supported",
  },
  {
    id: "willow-oak",
    name: "Willow Oak",
    note: "Reliable seasonal shade",
    startArea: 2.7,
    growthRate: 0.085,
    range: "20–73 m²",
    status: "Limited evidence",
  },
  {
    id: "golden-ash",
    name: "Golden Ash",
    note: "Suitable for streetscapes",
    startArea: 2.5,
    growthRate: 0.081,
    range: "18–68 m²",
    status: "Limited evidence",
  },
  {
    id: "lemon-scented-gum",
    name: "Lemon-scented Gum",
    note: "Tall native with a light spreading crown",
    startArea: 3.1,
    growthRate: 0.096,
    range: "23–91 m²",
    status: "Supported",
  },
  {
    id: "yellow-box",
    name: "Yellow Box",
    note: "Habitat-rich native shade tree",
    startArea: 3.4,
    growthRate: 0.089,
    range: "26–86 m²",
    status: "Supported",
  },
  {
    id: "brush-box",
    name: "Queensland Brush Box",
    note: "Resilient tree for busy urban streets",
    startArea: 2.8,
    growthRate: 0.087,
    range: "20–76 m²",
    status: "Supported",
  },
  {
    id: "chinese-elm",
    name: "Chinese Elm",
    note: "Compact broad crown for streetscapes",
    startArea: 3.0,
    growthRate: 0.093,
    range: "22–84 m²",
    status: "Supported",
  },
  {
    id: "jacaranda",
    name: "Jacaranda",
    note: "Medium canopy with seasonal colour",
    startArea: 2.6,
    growthRate: 0.084,
    range: "18–70 m²",
    status: "Limited evidence",
  },
  {
    id: "pin-oak",
    name: "Pin Oak",
    note: "Strong shade performance in open verges",
    startArea: 3.3,
    growthRate: 0.092,
    range: "25–90 m²",
    status: "Supported",
  },
  {
    id: "water-gum",
    name: "Water Gum",
    note: "Evergreen option for constrained streets",
    startArea: 2.4,
    growthRate: 0.079,
    range: "16–61 m²",
    status: "Supported",
  },
  {
    id: "trident-maple",
    name: "Trident Maple",
    note: "Smaller canopy for narrow corridors",
    startArea: 2.1,
    growthRate: 0.078,
    range: "14–56 m²",
    status: "Limited evidence",
  },
  {
    id: "moreton-bay-fig",
    name: "Moreton Bay Fig",
    note: "Very large mature canopy for open sites",
    startArea: 4.5,
    growthRate: 0.099,
    range: "35–132 m²",
    status: "Limited evidence",
  },
  {
    id: "silver-banksia",
    name: "Silver Banksia",
    note: "Native biodiversity and moderate shade",
    startArea: 2.2,
    growthRate: 0.076,
    range: "15–58 m²",
    status: "Limited evidence",
  },
  {
    id: "turkey-oak",
    name: "Turkey Oak",
    note: "Broad drought-tolerant future canopy",
    startArea: 3.2,
    growthRate: 0.086,
    range: "23–82 m²",
    status: "Limited evidence",
  },
  {
    id: "green-ash",
    name: "Green Ash",
    note: "Fast-establishing avenue tree",
    startArea: 2.9,
    growthRate: 0.09,
    range: "21–80 m²",
    status: "Supported",
  },
];

export type AreaMapProfile = {
  center: [number, number];
  bounds: [[number, number], [number, number]];
};

export type StreetCorridor = {
  id: string;
  name: string;
  length: number;
  capacity: number;
  areaScale: number;
  currentCanopy: number;
  heat: number;
  route: 0 | 1 | 2;
};

export const mapByArea: Record<string, AreaMapProfile> = {
  Carlton: {
    center: [-37.8005, 144.9671],
    bounds: [
      [-37.8085, 144.956],
      [-37.792, 144.979],
    ],
  },
  "Carlton North": {
    center: [-37.7847, 144.972],
    bounds: [
      [-37.7915, 144.961],
      [-37.7775, 144.983],
    ],
  },
  Docklands: {
    center: [-37.8147, 144.946],
    bounds: [
      [-37.824, 144.931],
      [-37.805, 144.958],
    ],
  },
  "East Melbourne": {
    center: [-37.8136, 144.9877],
    bounds: [
      [-37.8215, 144.976],
      [-37.805, 145.0],
    ],
  },
  Kensington: {
    center: [-37.793, 144.9305],
    bounds: [
      [-37.805, 144.9155],
      [-37.781, 144.944],
    ],
  },
  "Melbourne CBD": {
    center: [-37.8136, 144.9631],
    bounds: [
      [-37.8225, 144.95],
      [-37.804, 144.976],
    ],
  },
  "North Melbourne": {
    center: [-37.7998, 144.945],
    bounds: [
      [-37.81, 144.9325],
      [-37.789, 144.958],
    ],
  },
  Parkville: {
    center: [-37.7861, 144.9516],
    bounds: [
      [-37.801, 144.935],
      [-37.771, 144.967],
    ],
  },
  Southbank: {
    center: [-37.8231, 144.9647],
    bounds: [
      [-37.834, 144.95],
      [-37.814, 144.979],
    ],
  },
  "South Wharf": {
    center: [-37.8246, 144.9527],
    bounds: [
      [-37.831, 144.944],
      [-37.818, 144.961],
    ],
  },
  "West Melbourne": {
    center: [-37.806, 144.937],
    bounds: [
      [-37.82, 144.916],
      [-37.792, 144.952],
    ],
  },
  Fitzroy: {
    center: [-37.7984, 144.9785],
    bounds: [
      [-37.807, 144.968],
      [-37.789, 144.99],
    ],
  },
  "Princes Hill": {
    center: [-37.781, 144.965],
    bounds: [
      [-37.787, 144.957],
      [-37.775, 144.974],
    ],
  },
};

export const streetCorridorsByArea: Record<string, StreetCorridor[]> = {
  Carlton: [
    {
      id: "lygon-elgin-grattan",
      name: "Lygon Street · Elgin to Grattan",
      length: 760,
      capacity: 46,
      areaScale: 0.075,
      currentCanopy: 11.2,
      heat: 39.1,
      route: 0,
    },
    {
      id: "rathdowne-queensberry-pelham",
      name: "Rathdowne Street · Queensberry to Pelham",
      length: 610,
      capacity: 34,
      areaScale: 0.064,
      currentCanopy: 15.6,
      heat: 37.8,
      route: 1,
    },
    {
      id: "cardigan-faraday-keppel",
      name: "Cardigan Street · Faraday to Keppel",
      length: 540,
      capacity: 28,
      areaScale: 0.058,
      currentCanopy: 9.4,
      heat: 39.5,
      route: 2,
    },
  ],
  "Carlton North": [
    {
      id: "rathdowne-village",
      name: "Rathdowne Street · Village corridor",
      length: 820,
      capacity: 52,
      areaScale: 0.09,
      currentCanopy: 21.1,
      heat: 35.9,
      route: 0,
    },
    {
      id: "nicholson-princes-park",
      name: "Nicholson Street · Princes to Park",
      length: 690,
      capacity: 39,
      areaScale: 0.078,
      currentCanopy: 16.7,
      heat: 37.2,
      route: 1,
    },
  ],
  Docklands: [
    {
      id: "harbour-esplanade",
      name: "Harbour Esplanade · Central corridor",
      length: 940,
      capacity: 68,
      areaScale: 0.082,
      currentCanopy: 3.9,
      heat: 41.2,
      route: 0,
    },
    {
      id: "collins-docklands",
      name: "Collins Street · Docklands section",
      length: 780,
      capacity: 44,
      areaScale: 0.07,
      currentCanopy: 5.2,
      heat: 40.5,
      route: 2,
    },
  ],
  "East Melbourne": [
    {
      id: "albert-street",
      name: "Albert Street · Treasury to Fitzroy Gardens",
      length: 720,
      capacity: 41,
      areaScale: 0.076,
      currentCanopy: 24.3,
      heat: 35.1,
      route: 1,
    },
    {
      id: "victoria-parade-east",
      name: "Victoria Parade · Eastern corridor",
      length: 860,
      capacity: 55,
      areaScale: 0.084,
      currentCanopy: 19.8,
      heat: 36.4,
      route: 2,
    },
  ],
  Kensington: [
    {
      id: "macaulay-road",
      name: "Macaulay Road · Village corridor",
      length: 880,
      capacity: 57,
      areaScale: 0.068,
      currentCanopy: 8.7,
      heat: 39.6,
      route: 2,
    },
    {
      id: "racecourse-road",
      name: "Racecourse Road · Kensington section",
      length: 1010,
      capacity: 63,
      areaScale: 0.08,
      currentCanopy: 11.4,
      heat: 38.7,
      route: 1,
    },
  ],
  "Melbourne CBD": [
    {
      id: "swanston-north",
      name: "Swanston Street · La Trobe to Victoria",
      length: 640,
      capacity: 36,
      areaScale: 0.062,
      currentCanopy: 7.8,
      heat: 39.7,
      route: 0,
    },
    {
      id: "elizabeth-central",
      name: "Elizabeth Street · Central corridor",
      length: 830,
      capacity: 48,
      areaScale: 0.071,
      currentCanopy: 5.6,
      heat: 41.0,
      route: 1,
    },
    {
      id: "latrobe-street",
      name: "La Trobe Street · Queen to Spring",
      length: 1180,
      capacity: 72,
      areaScale: 0.092,
      currentCanopy: 6.2,
      heat: 40.4,
      route: 2,
    },
  ],
  "North Melbourne": [
    {
      id: "errol-street",
      name: "Errol Street · Village corridor",
      length: 590,
      capacity: 31,
      areaScale: 0.058,
      currentCanopy: 13.1,
      heat: 38.2,
      route: 0,
    },
    {
      id: "arden-street",
      name: "Arden Street · Renewal corridor",
      length: 1050,
      capacity: 66,
      areaScale: 0.088,
      currentCanopy: 6.8,
      heat: 40.0,
      route: 2,
    },
  ],
  Parkville: [
    {
      id: "royal-parade",
      name: "Royal Parade · University corridor",
      length: 1120,
      capacity: 74,
      areaScale: 0.094,
      currentCanopy: 24.9,
      heat: 34.9,
      route: 0,
    },
    {
      id: "grattan-west",
      name: "Grattan Street · Western section",
      length: 760,
      capacity: 43,
      areaScale: 0.069,
      currentCanopy: 18.5,
      heat: 36.2,
      route: 1,
    },
  ],
  Southbank: [
    {
      id: "southbank-boulevard",
      name: "Southbank Boulevard · Arts precinct",
      length: 830,
      capacity: 51,
      areaScale: 0.073,
      currentCanopy: 9.8,
      heat: 38.8,
      route: 1,
    },
    {
      id: "city-road",
      name: "City Road · Eastern corridor",
      length: 980,
      capacity: 61,
      areaScale: 0.081,
      currentCanopy: 4.7,
      heat: 41.0,
      route: 2,
    },
  ],
  "South Wharf": [
    {
      id: "convention-place",
      name: "Convention Place · River corridor",
      length: 510,
      capacity: 27,
      areaScale: 0.061,
      currentCanopy: 8.1,
      heat: 39.2,
      route: 1,
    },
    {
      id: "lorimer-east",
      name: "Lorimer Street · Eastern section",
      length: 870,
      capacity: 49,
      areaScale: 0.079,
      currentCanopy: 6.5,
      heat: 40.0,
      route: 2,
    },
  ],
  "West Melbourne": [
    {
      id: "spencer-north",
      name: "Spencer Street · Northern corridor",
      length: 910,
      capacity: 58,
      areaScale: 0.072,
      currentCanopy: 7.2,
      heat: 40.3,
      route: 0,
    },
    {
      id: "dudley-street",
      name: "Dudley Street · Flagstaff edge",
      length: 770,
      capacity: 42,
      areaScale: 0.066,
      currentCanopy: 10.1,
      heat: 39.1,
      route: 2,
    },
  ],
  Fitzroy: [
    {
      id: "brunswick-street",
      name: "Brunswick Street · Gertrude to Johnston",
      length: 960,
      capacity: 59,
      areaScale: 0.085,
      currentCanopy: 13.7,
      heat: 37.9,
      route: 0,
    },
    {
      id: "gertrude-street",
      name: "Gertrude Street · Smith to Nicholson",
      length: 740,
      capacity: 38,
      areaScale: 0.071,
      currentCanopy: 17.2,
      heat: 36.8,
      route: 2,
    },
  ],
  "Princes Hill": [
    {
      id: "pigdon-street",
      name: "Pigdon Street · Park edge",
      length: 620,
      capacity: 37,
      areaScale: 0.082,
      currentCanopy: 22.4,
      heat: 35.4,
      route: 2,
    },
    {
      id: "arnold-street",
      name: "Arnold Street · Neighbourhood corridor",
      length: 470,
      capacity: 24,
      areaScale: 0.063,
      currentCanopy: 18.9,
      heat: 36.5,
      route: 1,
    },
  ],
};

export const baseByArea: Record<
  string,
  { current: number; area: number; heat: number; population: string }
> = {
  Carlton: { current: 12.3, area: 2100000, heat: 38.2, population: "25,700" },
  "Carlton North": {
    current: 18.7,
    area: 1200000,
    heat: 36.8,
    population: "8,100",
  },
  Docklands: { current: 4.8, area: 3000000, heat: 40.7, population: "17,900" },
  "East Melbourne": {
    current: 22.9,
    area: 1900000,
    heat: 35.6,
    population: "5,300",
  },
  Kensington: {
    current: 10.8,
    area: 3700000,
    heat: 38.9,
    population: "10,700",
  },
  "Melbourne CBD": {
    current: 6.4,
    area: 1800000,
    heat: 40.3,
    population: "54,900",
  },
  "North Melbourne": {
    current: 9.7,
    area: 2400000,
    heat: 39.1,
    population: "17,500",
  },
  Parkville: { current: 21.8, area: 4050000, heat: 35.4, population: "9,300" },
  Southbank: { current: 5.9, area: 1700000, heat: 40.1, population: "22,600" },
  "South Wharf": {
    current: 7.6,
    area: 900000,
    heat: 39.5,
    population: "1,100",
  },
  "West Melbourne": {
    current: 8.9,
    area: 6400000,
    heat: 39.7,
    population: "8,700",
  },
  Fitzroy: { current: 14.6, area: 1400000, heat: 37.4, population: "10,900" },
  "Princes Hill": {
    current: 19.5,
    area: 870000,
    heat: 36.1,
    population: "2,100",
  },
};

const vulnerabilityByArea: Record<string, number> = {
  Carlton: 72,
  "Carlton North": 41,
  Docklands: 68,
  "East Melbourne": 38,
  Kensington: 76,
  "Melbourne CBD": 81,
  "North Melbourne": 84,
  Parkville: 44,
  Southbank: 79,
  "South Wharf": 57,
  "West Melbourne": 73,
  Fitzroy: 62,
  "Princes Hill": 35,
};

export const priorityAreas = areas
  .map((name) => {
    const item = baseByArea[name];
    const heatSeverity = Math.round(((item.heat - 34) / 7) * 100);
    const canopyDeficit = Math.round(
      Math.max(0, (30 - item.current) / 30) * 100,
    );
    const vulnerability = vulnerabilityByArea[name];
    const score = Math.round(
      heatSeverity * 0.4 + canopyDeficit * 0.35 + vulnerability * 0.25,
    );
    return { name, score, heatSeverity, canopyDeficit, vulnerability, ...item };
  })
  .sort((a, b) => b.score - a.score)
  .map((item, index) => ({ ...item, rank: index + 1 }));

export function makeGrowthData(tree: Species, count: number) {
  const years = [2026, 2030, 2035, 2040, 2045, 2050];
  return years.map((year) => {
    const age = year - 2026;
    const crown = tree.startArea * Math.pow(1 + tree.growthRate, age);
    return {
      year,
      crown: Number(crown.toFixed(1)),
      lower: Number((crown * 0.86).toFixed(1)),
      upper: Number((crown * 1.14).toFixed(1)),
      total: Math.round(crown * count),
      reference: Number((3.4 * Math.pow(1.087, age)).toFixed(1)),
    };
  });
}

export function calculateScenario(
  areaName: string,
  tree: Species,
  count: number,
  year: 2035 | 2050,
  areaScale = 1,
  baselineOverride?: { current: number; heat: number },
) {
  const base = baseByArea[areaName];
  const current = baselineOverride?.current ?? base.current;
  const currentHeat = baselineOverride?.heat ?? base.heat;
  const analysisArea = Math.round(
    base.area * Math.min(1.5, Math.max(0.06, areaScale)),
  );
  const years = year - 2026;
  const perTree = tree.startArea * Math.pow(1 + tree.growthRate, years);
  const addedArea = Math.round(perTree * count);
  const baselineGain = year === 2050 ? 4.5 : 1.7;
  const baseline = current + baselineGain;
  const plantingGain = Math.min(13.8, (addedArea / analysisArea) * 100 * 4.9);
  const withPlanting = baseline + plantingGain;
  const baselineHeat = currentHeat - (year === 2050 ? 1.3 : 0.5);
  const heatReduction = Math.min(4.8, 0.65 + plantingGain * 0.29);
  return {
    current,
    baseline: Number(baseline.toFixed(1)),
    withPlanting: Number(withPlanting.toFixed(1)),
    analysisArea,
    currentArea: Math.round((current / 100) * analysisArea),
    baselineArea: Math.round((baseline / 100) * analysisArea),
    plantingArea: Math.round((withPlanting / 100) * analysisArea),
    currentHeat,
    baselineHeat: Number(baselineHeat.toFixed(1)),
    plantingHeat: Number((baselineHeat - heatReduction).toFixed(1)),
    heatReduction: Number(heatReduction.toFixed(1)),
    addedArea,
    perTree: Number(perTree.toFixed(1)),
    radius: Number(Math.sqrt(perTree / Math.PI).toFixed(1)),
    canopyGain: Number((withPlanting - current).toFixed(1)),
  };
}

export function formatArea(value: number) {
  return (
    new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(value) +
    " m²"
  );
}
