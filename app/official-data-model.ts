import {
  areas,
  baseByArea as legacyBaseByArea,
  formatArea,
  species,
  streetCorridorsByArea,
  type Species,
} from "./data";
import {
  officialDataProvenance,
  officialUrbanData,
  type OfficialAreaUrbanData,
} from "./generated-official-data";

export { areas, formatArea, species, streetCorridorsByArea, officialDataProvenance };
export type { Species };

function requireOfficial(areaName: string): OfficialAreaUrbanData {
  const data = officialUrbanData[areaName];
  if (!data) {
    throw new Error(
      `Official data missing for ${areaName}. Run npm run refresh:data before starting or building Shade 2050.`,
    );
  }
  return data;
}

function lifecycleProfile(data: OfficialAreaUrbanData) {
  const inventory = data.treeInventory2025;
  const total = inventory.youngShare + inventory.matureShare + inventory.oldShare;
  if (total <= 0) return { young: 0.25, mature: 0.55, old: 0.2 };
  return {
    young: inventory.youngShare / total,
    mature: inventory.matureShare / total,
    old: inventory.oldShare / total,
  };
}

function projectExistingCanopyFactor(
  data: OfficialAreaUrbanData,
  years: number,
) {
  const profile = lifecycleProfile(data);
  const risk = data.treeInventory2025.atRiskShare;
  const cohorts = [
    { share: profile.young, growth: 0.016, mortality: 0.004 + risk * 0.003 },
    { share: profile.mature, growth: 0.0035, mortality: 0.006 + risk * 0.004 },
    { share: profile.old, growth: -0.0045, mortality: 0.011 + risk * 0.008 },
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
  data: OfficialAreaUrbanData,
  years: number,
) {
  const profile = lifecycleProfile(data);
  const risk = data.treeInventory2025.atRiskShare;
  return (
    profile.young * Math.pow(1 - (0.004 + risk * 0.003), years) +
    profile.mature * Math.pow(1 - (0.006 + risk * 0.004), years) +
    profile.old * Math.pow(1 - (0.011 + risk * 0.008), years)
  );
}

function lifecycleMultiplier(age: number) {
  if (age < 8) return 1;
  if (age < 18) return 0.55;
  return 0.22;
}

function projectNewTreeCrown(tree: Species, years: number) {
  let crown = tree.startArea;
  for (let age = 0; age < years; age += 1) {
    crown *= 1 + tree.growthRate * lifecycleMultiplier(age);
  }
  return crown;
}

function newTreeSurvivalRate(years: number) {
  return Math.pow(1 - 0.0085, years);
}

export const baseByArea: Record<
  string,
  {
    current: number;
    area: number;
    heat: number;
    population: string;
  }
> = Object.fromEntries(
  areas.map((name) => {
    const official = requireOfficial(name);
    const legacy = legacyBaseByArea[name];
    const eightYearFactor = projectExistingCanopyFactor(official, 8);
    const canopy2026 = official.observedTreeCanopy2018 * eightYearFactor;
    const canopyChangeSince2018 = canopy2026 - official.observedTreeCanopy2018;
    const contextPenalty =
      0.35 * official.buildings2023.buildingCoverage +
      0.25 * official.nonVegetatedSurfaceProxy +
      0.1 * Math.min(1, (official.buildings2023.averageHeightM ?? 0) / 35);
    const uhi2026 =
      official.observedUhi2018 - canopyChangeSince2018 * (0.055 / (1 + contextPenalty));
    return [
      name,
      {
        current: Number(canopy2026.toFixed(1)),
        area: official.analysisAreaM2,
        heat: Number(uhi2026.toFixed(2)),
        population: legacy?.population ?? "—",
      },
    ];
  }),
);

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
  _baselineOverride?: { current: number; heat: number },
) {
  const official = requireOfficial(areaName);
  const base = baseByArea[areaName];
  const current = base.current;
  const currentHeat = base.heat;
  const analysisArea = Math.round(
    official.analysisAreaM2 * Math.min(1.5, Math.max(0.06, areaScale)),
  );
  const years = year - 2026;

  const existingFactor = projectExistingCanopyFactor(official, years);
  const baseline = Math.max(0, current * existingFactor);
  const existingSurvival = existingTreeSurvivalRate(official, years);

  const perTree = projectNewTreeCrown(tree, years);
  const survivalRate = newTreeSurvivalRate(years);
  const effectiveTreeCount = Math.round(count * survivalRate);
  const addedArea = Math.round(perTree * count * survivalRate);
  const plantingGain = Math.min(13.8, (addedArea / analysisArea) * 100 * 4.9);
  const withPlanting = baseline + plantingGain;

  const buildingCoverage = official.buildings2023.buildingCoverage;
  const averageHeight = official.buildings2023.averageHeightM ?? 0;
  const nonVegetated = official.nonVegetatedSurfaceProxy;
  const urbanFormIndex =
    0.45 * buildingCoverage +
    0.4 * nonVegetated +
    0.15 * Math.min(1, averageHeight / 35);

  const existingCanopyChange = baseline - current;
  const baselineCoolingEfficiency = 0.085 / (0.9 + urbanFormIndex * 0.55);
  const baselineHeat = currentHeat - existingCanopyChange * baselineCoolingEfficiency;
  const plantingCoolingEfficiency =
    (0.12 + nonVegetated * 0.055) / (0.92 + buildingCoverage * 0.22);
  const heatReduction = Math.min(
    3.5,
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
    currentHeat: Number(currentHeat.toFixed(2)),
    baselineHeat: Number(baselineHeat.toFixed(2)),
    plantingHeat: Number(plantingHeat.toFixed(2)),
    heatReduction: Number(heatReduction.toFixed(2)),
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
    urbanContext: {
      buildingDensity: buildingCoverage,
      averageBuildingHeight: averageHeight,
      imperviousSurface: nonVegetated,
      existingTrees: lifecycleProfile(official),
    },
    officialData: official,
    officialDataProvenance,
  };
}
