import {
  areas,
  baseByArea,
  formatArea,
  species,
  streetCorridorsByArea,
  type Species,
} from "./data";

export { areas, baseByArea, formatArea, species, streetCorridorsByArea };
export type { Species };

type ExistingTreeProfile = {
  young: number;
  mature: number;
  old: number;
};

export type UrbanContext = {
  buildingDensity: number;
  averageBuildingHeight: number;
  imperviousSurface: number;
  existingTrees: ExistingTreeProfile;
};

// Prototype contextual assumptions used to demonstrate how urban form and
// tree lifecycle can enter the scenario pipeline. These are not claimed as
// surveyed parcel-level measurements and should be replaced by GIS inputs in
// a production implementation.
export const urbanContextByArea: Record<string, UrbanContext> = {
  Carlton: {
    buildingDensity: 0.44,
    averageBuildingHeight: 11,
    imperviousSurface: 0.69,
    existingTrees: { young: 0.24, mature: 0.56, old: 0.2 },
  },
  "Carlton North": {
    buildingDensity: 0.3,
    averageBuildingHeight: 8,
    imperviousSurface: 0.55,
    existingTrees: { young: 0.18, mature: 0.57, old: 0.25 },
  },
  Docklands: {
    buildingDensity: 0.58,
    averageBuildingHeight: 28,
    imperviousSurface: 0.82,
    existingTrees: { young: 0.4, mature: 0.5, old: 0.1 },
  },
  "East Melbourne": {
    buildingDensity: 0.35,
    averageBuildingHeight: 14,
    imperviousSurface: 0.58,
    existingTrees: { young: 0.15, mature: 0.52, old: 0.33 },
  },
  Kensington: {
    buildingDensity: 0.38,
    averageBuildingHeight: 9,
    imperviousSurface: 0.68,
    existingTrees: { young: 0.28, mature: 0.54, old: 0.18 },
  },
  "Melbourne CBD": {
    buildingDensity: 0.74,
    averageBuildingHeight: 34,
    imperviousSurface: 0.91,
    existingTrees: { young: 0.32, mature: 0.54, old: 0.14 },
  },
  "North Melbourne": {
    buildingDensity: 0.48,
    averageBuildingHeight: 13,
    imperviousSurface: 0.76,
    existingTrees: { young: 0.27, mature: 0.55, old: 0.18 },
  },
  Parkville: {
    buildingDensity: 0.22,
    averageBuildingHeight: 12,
    imperviousSurface: 0.43,
    existingTrees: { young: 0.14, mature: 0.53, old: 0.33 },
  },
  Southbank: {
    buildingDensity: 0.68,
    averageBuildingHeight: 31,
    imperviousSurface: 0.88,
    existingTrees: { young: 0.34, mature: 0.53, old: 0.13 },
  },
  "South Wharf": {
    buildingDensity: 0.56,
    averageBuildingHeight: 24,
    imperviousSurface: 0.86,
    existingTrees: { young: 0.36, mature: 0.51, old: 0.13 },
  },
  "West Melbourne": {
    buildingDensity: 0.46,
    averageBuildingHeight: 12,
    imperviousSurface: 0.78,
    existingTrees: { young: 0.3, mature: 0.53, old: 0.17 },
  },
  Fitzroy: {
    buildingDensity: 0.5,
    averageBuildingHeight: 10,
    imperviousSurface: 0.7,
    existingTrees: { young: 0.22, mature: 0.56, old: 0.22 },
  },
  "Princes Hill": {
    buildingDensity: 0.25,
    averageBuildingHeight: 7,
    imperviousSurface: 0.49,
    existingTrees: { young: 0.15, mature: 0.54, old: 0.31 },
  },
};

const DEFAULT_CONTEXT: UrbanContext = {
  buildingDensity: 0.45,
  averageBuildingHeight: 12,
  imperviousSurface: 0.7,
  existingTrees: { young: 0.25, mature: 0.55, old: 0.2 },
};

function projectNewTreeCrown(tree: Species, years: number) {
  let crown = tree.startArea;

  for (let age = 0; age < years; age += 1) {
    // Newly planted trees establish quickly, then crown expansion slows as the
    // tree approaches maturity instead of growing exponentially forever.
    const lifecycleMultiplier = age < 8 ? 1 : age < 18 ? 0.55 : 0.22;
    crown *= 1 + tree.growthRate * lifecycleMultiplier;
  }

  return crown;
}

function newTreeSurvivalRate(years: number) {
  // Establishment and long-term mortality assumption for the prototype.
  // Roughly 92% remain by 2035 and ~81% by 2050.
  return Math.pow(1 - 0.0085, years);
}

function projectExistingCanopyFactor(
  profile: ExistingTreeProfile,
  years: number,
) {
  const cohorts = [
    { share: profile.young, growth: 0.018, mortality: 0.004 },
    { share: profile.mature, growth: 0.004, mortality: 0.006 },
    { share: profile.old, growth: -0.004, mortality: 0.01 },
  ];

  return cohorts.reduce(
    (total, cohort) =>
      total +
      cohort.share *
        Math.pow(1 + cohort.growth, years) *
        Math.pow(1 - cohort.mortality, years),
    0,
  );
}

function existingTreeSurvivalRate(
  profile: ExistingTreeProfile,
  years: number,
) {
  return (
    profile.young * Math.pow(1 - 0.004, years) +
    profile.mature * Math.pow(1 - 0.006, years) +
    profile.old * Math.pow(1 - 0.01, years)
  );
}

export function makeGrowthData(tree: Species, count: number) {
  const years = [2026, 2030, 2035, 2040, 2045, 2050];

  return years.map((year) => {
    const age = year - 2026;
    const crown = projectNewTreeCrown(tree, age);
    const survivalRate = newTreeSurvivalRate(age);
    const reference = projectNewTreeCrown(
      { ...tree, startArea: 3.4, growthRate: 0.087 },
      age,
    );

    return {
      year,
      crown: Number(crown.toFixed(1)),
      lower: Number((crown * 0.84).toFixed(1)),
      upper: Number((crown * 1.16).toFixed(1)),
      total: Math.round(crown * count * survivalRate),
      reference: Number(reference.toFixed(1)),
      survivalRate: Number(survivalRate.toFixed(3)),
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
  const urbanContext = urbanContextByArea[areaName] ?? DEFAULT_CONTEXT;
  const current = baselineOverride?.current ?? base.current;
  const currentHeat = baselineOverride?.heat ?? base.heat;
  const analysisArea = Math.round(
    base.area * Math.min(1.5, Math.max(0.06, areaScale)),
  );
  const years = year - 2026;

  // 1) No-intervention future: existing canopy is projected by age cohort.
  // Young trees keep expanding, mature trees slow down and old trees can lose
  // canopy or die. This replaces the previous fixed +1.7/+4.5 percentage rule.
  const existingFactor = projectExistingCanopyFactor(
    urbanContext.existingTrees,
    years,
  );
  const baseline = Math.max(0, current * existingFactor);
  const existingSurvival = existingTreeSurvivalRate(
    urbanContext.existingTrees,
    years,
  );

  // 2) Planting intervention: new trees use lifecycle-adjusted crown growth and
  // an establishment survival probability, so the model no longer assumes that
  // every planted tree survives and grows at the same rate forever.
  const perTree = projectNewTreeCrown(tree, years);
  const survivalRate = newTreeSurvivalRate(years);
  const effectiveTreeCount = Math.round(count * survivalRate);
  const addedArea = Math.round(perTree * count * survivalRate);
  const plantingGain = Math.min(13.8, (addedArea / analysisArea) * 100 * 4.9);
  const withPlanting = baseline + plantingGain;

  // 3) Heat response: current heat already reflects today's urban fabric. The
  // contextual variables below modify how future canopy change translates into
  // cooling/heat retention rather than pretending canopy is the only driver.
  const urbanFormIndex =
    0.45 * urbanContext.buildingDensity +
    0.4 * urbanContext.imperviousSurface +
    0.15 * Math.min(1, urbanContext.averageBuildingHeight / 35);
  const existingCanopyChange = baseline - current;
  const baselineCoolingEfficiency = 0.1 / (0.9 + urbanFormIndex * 0.45);
  const baselineHeat =
    currentHeat - existingCanopyChange * baselineCoolingEfficiency;
  const plantingCoolingEfficiency =
    (0.17 + urbanContext.imperviousSurface * 0.055) /
    (0.92 + urbanContext.buildingDensity * 0.18);
  const heatReduction = Math.min(
    4.8,
    Math.max(0, plantingGain * plantingCoolingEfficiency),
  );
  const plantingHeat = baselineHeat - heatReduction;

  return {
    current: Number(current.toFixed(1)),
    baseline: Number(baseline.toFixed(1)),
    withPlanting: Number(withPlanting.toFixed(1)),
    analysisArea,
    currentArea: Math.round((current / 100) * analysisArea),
    baselineArea: Math.round((baseline / 100) * analysisArea),
    plantingArea: Math.round((withPlanting / 100) * analysisArea),
    currentHeat: Number(currentHeat.toFixed(1)),
    baselineHeat: Number(baselineHeat.toFixed(1)),
    plantingHeat: Number(plantingHeat.toFixed(1)),
    heatReduction: Number(heatReduction.toFixed(1)),
    addedArea,
    perTree: Number(perTree.toFixed(1)),
    radius: Number(Math.sqrt(perTree / Math.PI).toFixed(1)),
    canopyGain: Number(plantingGain.toFixed(1)),
    totalCanopyChange: Number((withPlanting - current).toFixed(1)),
    existingCanopyChange: Number(existingCanopyChange.toFixed(1)),
    survivalRate: Number(survivalRate.toFixed(3)),
    survivalPercent: Math.round(survivalRate * 100),
    effectiveTreeCount,
    existingTreeSurvivalRate: Number(existingSurvival.toFixed(3)),
    existingTreeSurvivalPercent: Math.round(existingSurvival * 100),
    urbanFormIndex: Number(urbanFormIndex.toFixed(3)),
    urbanContext,
  };
}
