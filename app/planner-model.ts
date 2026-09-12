import {
  areas,
  baseByArea as officialBaseByArea,
  empiricalHeatModel,
  formatArea,
  officialDataProvenance,
  priorityAreas,
  species,
  streetCorridorsByArea,
  type Species,
} from "./official-data-model";
import {
  empiricalSpeciesModels,
  officialUrbanData,
  empiricalMatureCrownByModelId,
  canopyDynamicsByArea,
  modelValidation,
  planningGridByArea,
  planningEnrichmentProvenance,
  type EmpiricalSpeciesModel,
} from "./generated-official-data.runtime";

export { areas, formatArea, priorityAreas, species, streetCorridorsByArea, officialDataProvenance, empiricalHeatModel };
export type { Species };

export type PlanningHorizon = 2030 | 2035 | 2040 | 2045 | 2050;

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

function powerCrown(model: EmpiricalSpeciesModel, ageYears: number) {
  return Math.exp(model.logIntercept + model.logSlope * Math.log(Math.max(1, ageYears) + 1));
}

function empiricalMatureCrown(model: EmpiricalSpeciesModel, ageYears: number) {
  const age = Math.max(1, ageYears);
  const observedMaxAge = Math.max(1, model.maxObservedAge);
  if (age <= observedMaxAge) return powerCrown(model, age);

  const base = powerCrown(model, observedMaxAge);
  const plateauRecord = empiricalMatureCrownByModelId[model.id] ?? empiricalMatureCrownByModelId.citywide;
  const observedPlateau = plateauRecord?.p80CrownAreaM2 ?? model.observedCrownAreaMax;
  const plateau = Math.max(base, observedPlateau);
  if (plateau <= base * 1.001) return base;

  // Smooth asymptote derived from the fitted power-curve slope at the observed
  // boundary. No arbitrary annual mature-tree growth constant is introduced.
  const derivative = Math.max(
    0,
    base * model.logSlope / Math.max(1, observedMaxAge + 1),
  );
  if (derivative <= 1e-9) return base;
  const k = derivative / Math.max(1e-9, plateau - base);
  return plateau - (plateau - base) * Math.exp(-k * (age - observedMaxAge));
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
    const official = officialUrbanData[name];
    if (!official) throw new Error(`Official data missing for ${name}.`);
    const dynamics = canopyDynamicsByArea[name];
    const currentCanopy = dynamics?.estimatedTreeCanopy2026 ?? official.estimatedTreeCanopy2026;
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
        population: officialBaseByArea[name]?.population ?? "—",
      },
    ];
  }),
);

export function makeGrowthData(tree: Species, count: number) {
  const model = speciesModel(tree);
  const years: PlanningHorizon[] | number[] = [2026, 2030, 2035, 2040, 2045, 2050];
  const citywide = requireCitywideSpeciesModel();
  return years.map((year) => {
    const age = Math.max(1, year - 2026 + 1);
    const crown = empiricalMatureCrown(model, age);
    const lower = Math.exp(Math.log(crown) - model.rmseLog);
    const upper = Math.exp(Math.log(crown) + model.rmseLog);
    return {
      year,
      crown: Number(crown.toFixed(1)),
      lower: Number(lower.toFixed(1)),
      upper: Number(upper.toFixed(1)),
      total: Math.round(crown * count),
      reference: Number(empiricalMatureCrown(citywide, age).toFixed(1)),
      sampleCount: model.sampleCount,
      fitLevel: model.fitLevel,
      modelName: model.name,
      maturePlateauM2:
        empiricalMatureCrownByModelId[model.id]?.p80CrownAreaM2 ??
        empiricalMatureCrownByModelId.citywide?.p80CrownAreaM2 ??
        null,
      extrapolated: age > model.maxObservedAge,
    };
  });
}

export function calculateScenario(
  areaName: string,
  tree: Species,
  count: number,
  year: PlanningHorizon,
  areaScale = 1,
  _baselineOverride?: { current: number; heat: number },
) {
  const official = officialUrbanData[areaName];
  if (!official) throw new Error(`Official data missing for ${areaName}.`);
  const dynamics = canopyDynamicsByArea[areaName];
  const model = speciesModel(tree);
  const current = dynamics?.estimatedTreeCanopy2026 ?? official.estimatedTreeCanopy2026;
  const analysisArea = Math.round(
    official.analysisAreaM2 * Math.min(1, Math.max(0.06, areaScale)),
  );

  const yearsFrom2026 = year - 2026;
  const observedTrend =
    dynamics?.totalTrendPctPointPerYear ?? official.canopyTrendPctPointPerYear;
  const baseline = Math.max(0, Math.min(100, current + observedTrend * yearsFrom2026));

  const plantedTreeAge = Math.max(1, yearsFrom2026 + 1);
  const perTree = empiricalMatureCrown(model, plantedTreeAge);
  const addedArea = Math.round(perTree * count);
  const plantingGain = Math.max(
    0,
    Math.min(100 - baseline, (addedArea / Math.max(1, analysisArea)) * 100),
  );
  const withPlanting = baseline + plantingGain;

  const buildingCoverage = official.buildings2023.buildingCoverage;
  const averageHeight = official.buildings2023.averageHeightM ?? 0;
  const currentHeat = predictUhi(current, buildingCoverage, averageHeight);
  const baselineHeat = predictUhi(baseline, buildingCoverage, averageHeight);
  const plantingHeat = predictUhi(withPlanting, buildingCoverage, averageHeight);
  const heatReduction = baselineHeat - plantingHeat;

  const matureEvidence =
    empiricalMatureCrownByModelId[model.id] ?? empiricalMatureCrownByModelId.citywide ?? null;
  const areaValidation = modelValidation.byArea?.[areaName] ?? null;

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
    existingTreeSurvivalRate:
      dynamics?.publicCanopyPersistence2018to2021 ?? null,
    existingTreeSurvivalPercent:
      dynamics?.publicCanopyPersistence2018to2021 == null
        ? null
        : Number((dynamics.publicCanopyPersistence2018to2021 * 100).toFixed(1)),
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
    matureCrownEvidence: matureEvidence,
    canopyDynamics: dynamics ?? null,
    modelValidation: {
      overall: modelValidation.overall,
      area: areaValidation,
      kpiMapePct: modelValidation.kpiMapePct,
      method: modelValidation.method,
    },
    planningGrid: planningGridByArea[areaName] ?? [],
    planningEnrichmentProvenance,
  };
}
