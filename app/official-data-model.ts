import {
  formatArea,
  species,
  streetCorridorsByArea,
  type Species,
} from "./data";
import {
  empiricalHeatModel,
  empiricalSpeciesModels,
  officialDataProvenance,
  officialUrbanData,
  supportedAreas,
  type EmpiricalSpeciesModel,
  type OfficialAreaUrbanData,
} from "./generated-official-data.runtime";

export const areas = supportedAreas;
export { formatArea, species, streetCorridorsByArea, officialDataProvenance, empiricalHeatModel };
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

function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function requireCitywideSpeciesModel() {
  const model = empiricalSpeciesModels.find((item) => item.id === "citywide");
  if (!model) throw new Error("Empirical citywide tree allometry model is missing.");
  return model;
}

function speciesModel(tree: Species): EmpiricalSpeciesModel {
  const target = normaliseName(tree.name);
  const exact = empiricalSpeciesModels.find(
    (item) => item.fitLevel === "species" && normaliseName(item.name) === target,
  );
  if (exact) return exact;

  const partial = empiricalSpeciesModels.find((item) => {
    if (item.fitLevel !== "species") return false;
    const candidate = normaliseName(item.name);
    return candidate.includes(target) || target.includes(candidate);
  });
  return partial ?? requireCitywideSpeciesModel();
}

function predictCrownArea(model: EmpiricalSpeciesModel, ageYears: number) {
  const safeAge = Math.max(1, ageYears);
  return Math.exp(model.logIntercept + model.logSlope * Math.log(safeAge + 1));
}

function predictUhi(treeCoverPct: number, buildingCoverageFraction: number, averageHeightM: number) {
  return (
    empiricalHeatModel.intercept +
    empiricalHeatModel.treeCoverCoefficient * treeCoverPct +
    empiricalHeatModel.buildingCoverageCoefficient * (buildingCoverageFraction * 100) +
    empiricalHeatModel.averageHeightCoefficient * averageHeightM
  );
}

export const baseByArea: Record<
  string,
  { current: number; area: number; heat: number; population: string }
> = Object.fromEntries(
  areas.map((name) => {
    const official = requireOfficial(name);
    const currentCanopy = official.estimatedTreeCanopy2026;
    const currentUhi = predictUhi(
      currentCanopy,
      official.buildings2023.buildingCoverage,
      official.buildings2023.averageHeightM ?? 0,
    );
    return [
      name,
      {
        current: Number(currentCanopy.toFixed(1)),
        area: official.analysisAreaM2,
        heat: Number(currentUhi.toFixed(2)),
        population: official.population2026 === null
          ? "—"
          : new Intl.NumberFormat("en-AU").format(official.population2026),
      },
    ];
  }),
);

export function makeGrowthData(tree: Species, count: number) {
  const model = speciesModel(tree);
  const years = [2026, 2030, 2035, 2040, 2045, 2050];
  return years.map((year) => {
    const age = Math.max(1, year - 2026 + 1);
    const crown = predictCrownArea(model, age);
    const lower = Math.exp(Math.log(crown) - model.rmseLog);
    const upper = Math.exp(Math.log(crown) + model.rmseLog);
    return {
      year,
      crown: Number(crown.toFixed(1)),
      lower: Number(lower.toFixed(1)),
      upper: Number(upper.toFixed(1)),
      total: Math.round(crown * count),
      reference: Number(predictCrownArea(requireCitywideSpeciesModel(), age).toFixed(1)),
      sampleCount: model.sampleCount,
      fitLevel: model.fitLevel,
      modelName: model.name,
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
  const model = speciesModel(tree);
  const current = base.current;
  const analysisArea = Math.round(
    official.analysisAreaM2 * Math.min(1, Math.max(0.06, areaScale)),
  );

  const yearsFrom2026 = year - 2026;
  const baseline = Math.max(
    0,
    Math.min(100, current + official.canopyTrendPctPointPerYear * yearsFrom2026),
  );

  const plantedTreeAge = Math.max(1, yearsFrom2026 + 1);
  const perTree = predictCrownArea(model, plantedTreeAge);
  const addedArea = Math.round(perTree * count);
  const plantingGain = Math.max(0, Math.min(100 - baseline, (addedArea / analysisArea) * 100));
  const withPlanting = baseline + plantingGain;

  const buildingCoverage = official.buildings2023.buildingCoverage;
  const averageHeight = official.buildings2023.averageHeightM ?? 0;
  const currentHeat = predictUhi(current, buildingCoverage, averageHeight);
  const baselineHeat = predictUhi(baseline, buildingCoverage, averageHeight);
  const plantingHeat = predictUhi(withPlanting, buildingCoverage, averageHeight);
  const heatReduction = baselineHeat - plantingHeat;

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
    canopyGain: Number(plantingGain.toFixed(2)),
    totalCanopyChange: Number((withPlanting - current).toFixed(2)),
    existingCanopyChange: Number((baseline - current).toFixed(2)),
    survivalRate: null,
    survivalPercent: null,
    effectiveTreeCount: count,
    existingTreeSurvivalRate: null,
    existingTreeSurvivalPercent: null,
    urbanFormIndex: null,
    urbanContext: {
      buildingDensity: buildingCoverage,
      averageBuildingHeight: averageHeight,
      imperviousSurface: null,
      existingTrees: {
        unestablished: official.treeInventory2025.unestablishedShare,
        semiMature: official.treeInventory2025.semiMatureShare,
        mature: official.treeInventory2025.matureShare,
        uleUnder10: official.treeInventory2025.uleUnder10Share,
      },
    },
    empiricalTreeModel: model,
    empiricalHeatModel,
    officialData: official,
    officialDataProvenance,
  };
}

function percentile(values: number[], value: number) {
  if (values.length <= 1) return 50;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return ((below + Math.max(0, equal - 1) / 2) / (values.length - 1)) * 100;
}

const uhiValues = areas.map((name) => requireOfficial(name).observedUhi2018);
const canopyValues = areas.map((name) => requireOfficial(name).observedTreeCanopy2018);
const hviValues = areas.map((name) => requireOfficial(name).hvi2018);

export const priorityAreas = areas
  .map((name) => {
    const official = requireOfficial(name);
    const heatSeverity = Math.round(percentile(uhiValues, official.observedUhi2018));
    const canopyDeficit = Math.round(100 - percentile(canopyValues, official.observedTreeCanopy2018));
    const vulnerability = Math.round(percentile(hviValues, official.hvi2018));
    const score = Math.round((heatSeverity + canopyDeficit + vulnerability) / 3);
    return {
      name,
      score,
      heatSeverity,
      canopyDeficit,
      vulnerability,
      heat: Number(official.observedUhi2018.toFixed(2)),
      current: Number(official.observedTreeCanopy2018.toFixed(1)),
      area: official.analysisAreaM2,
      population: official.population2026 === null
        ? "—"
        : new Intl.NumberFormat("en-AU").format(official.population2026),
      hvi: official.hvi2018,
    };
  })
  .sort((a, b) => b.score - a.score)
  .map((item, index) => ({ ...item, rank: index + 1 }));
