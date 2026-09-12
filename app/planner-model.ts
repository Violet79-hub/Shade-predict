import {
  calculateScenario as calculateOfficialScenario,
} from "./official-data-model";

export * from "./official-data-model";

export type PlanningHorizon = 2030 | 2035 | 2040 | 2045 | 2050;

// The underlying empirical equations are continuous in year; the original
// UI exposed only 2035/2050. This typed wrapper exposes the full planning
// horizon requested by the model review without changing the fitted model.
export function calculateScenario(
  areaName: string,
  tree: Parameters<typeof calculateOfficialScenario>[1],
  count: number,
  year: PlanningHorizon,
  areaScale = 1,
  baselineOverride?: { current: number; heat: number },
) {
  return calculateOfficialScenario(
    areaName,
    tree,
    count,
    year as 2035 | 2050,
    areaScale,
    baselineOverride,
  );
}
