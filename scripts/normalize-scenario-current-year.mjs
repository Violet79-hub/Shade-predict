import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../app/scenario/page.tsx", import.meta.url);
const source = await readFile(file, "utf8");
let updated = source.replaceAll("2024", "2026");

// Route scenario calculations through the empirical official-data planner model.
updated = updated.replace('from "../data";', 'from "../planner-model";');
updated = updated.replace('from "../enhanced-data";', 'from "../planner-model";');
updated = updated.replace('from "../official-data-model";', 'from "../planner-model";');

if (!updated.includes('from "../components/planner-decision-panel"')) {
  updated = updated.replace(
    'import { LiveMap, SelectionMode } from "@/app/components/live-map";',
    'import { LiveMap, SelectionMode } from "@/app/components/live-map";\nimport { PlannerDecisionPanel } from "../components/planner-decision-panel";',
  );
}

// Expose all planning horizons requested by the model review.
updated = updated.replaceAll(
  "2035 | 2050",
  "2030 | 2035 | 2040 | 2045 | 2050",
);
updated = updated.replaceAll("[2035, 2050]", "[2030, 2035, 2040, 2045, 2050]");

// Preserve planning scales. The UI labels unverified street/CLUE assumptions.

// Keep model descriptions aligned with the actual empirical training pipeline.
updated = updated.replace(
  "Recursive simulation estimates how each planted tree grows, then\n            aggregates its contribution to the area-level canopy scenario.",
  "Empirical crown-age modelling uses 2025 City of Melbourne tree inventory records spatially joined to official 2018 public-realm canopy polygons.\n            Single-tree matches with reliable planting years form species-level fits; otherwise a citywide empirical fallback is used.",
);
updated = updated.replace(
  "Lifecycle-aware simulation estimates how planted trees establish, survive and mature, then\n            aggregates their surviving crown contribution to the area-level canopy scenario.",
  "Empirical crown-age modelling uses 2025 City of Melbourne tree inventory records spatially joined to official 2018 public-realm canopy polygons.\n            Single-tree matches with reliable planting years form species-level fits; otherwise a citywide empirical fallback is used.",
);
updated = updated.replace(
  "Empirical crown-age modelling uses City of Melbourne 2011 tree-canopy records.\n            Species-level fits are used where sample size is sufficient; otherwise a citywide empirical fallback is used.",
  "Empirical crown-age modelling uses 2025 City of Melbourne tree inventory records spatially joined to official 2018 public-realm canopy polygons.\n            Single-tree matches with reliable planting years form species-level fits; otherwise a citywide empirical fallback is used.",
);

updated = updated.replace(
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted.\n            Existing-tree lifecycle shares are derived from the City of Melbourne\n            2025 tree inventory; future transitions remain model estimates.",
  "Crown area is predicted from the empirical 2018 canopy / 2025 inventory spatial join.\n            The displayed band comes from the crown-model log residual error.\n            No unverified survival-rate constant is applied; the requested planting count is treated as established.\n            Existing canopy follows the observed official 2014–2018 suburb tree-cover trend.",
);
updated = updated.replace(
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted,\n            so the model does not assume every planted tree survives or grows\n            exponentially forever. Existing canopy is projected separately using\n            young, mature and old tree cohorts with age-dependent mortality.",
  "Crown area is predicted from the empirical 2018 canopy / 2025 inventory spatial join.\n            The displayed band comes from the crown-model log residual error.\n            No unverified survival-rate constant is applied; the requested planting count is treated as established.\n            Existing canopy follows the observed official 2014–2018 suburb tree-cover trend.",
);
updated = updated.replace(
  "Crown area is predicted from observed tree age and canopy diameter in the 2011 Urban Forest dataset.\n            The uncertainty band comes from the empirical log-scale residual error.\n            No unverified survival-rate constant is applied; results assume the requested planting is established.\n            Existing canopy follows the observed official 2014–2018 suburb tree-cover trend.",
  "Crown area is predicted from the empirical 2018 canopy / 2025 inventory spatial join.\n            The displayed band comes from the crown-model log residual error.\n            No unverified survival-rate constant is applied; the requested planting count is treated as established.\n            Existing canopy follows the observed official 2014–2018 suburb tree-cover trend.",
);

updated = updated.replace(
  "Translates projected canopy change into area-level surface\n            temperature outcomes for {area}.",
  "Predicts UHI intensity from tree cover and official building-form variables using an OLS model fitted on 2018 observations.",
);
updated = updated.replace(
  "Combines projected canopy change with official building coverage, building height\n            and non-vegetated-surface context to estimate future UHI intensity for {area}.",
  "Predicts UHI intensity from tree cover, building coverage and average building height using an OLS model fitted on official 2018 observations.",
);

updated = updated.replace(
  "<small>MODEL INPUT</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>From the planting scenario</span>",
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Empirical tree cover + official building form</span>",
);
updated = updated.replace(
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Official canopy + buildings + vegetation context</span>",
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Empirical tree cover + official building form</span>",
);

updated = updated.replaceAll("Average surface temperature", "Urban heat-island intensity");
updated = updated.replaceAll("Surface temperature comparison", "Urban heat-island comparison");
updated = updated.replaceAll("surface temp.", "UHI intensity");
updated = updated.replaceAll("surface temperature", "UHI intensity");
updated = updated.replaceAll("Observed summer peak", "2026 model baseline · official-data fit");
updated = updated.replaceAll("Climate-adjusted", "Empirical no-intervention projection");
updated = updated.replaceAll("25°C · cooler", "Lower UHI");
updated = updated.replaceAll("45°C · hotter", "Higher UHI");
updated = updated.replaceAll("Natural canopy growth", "Observed-trend canopy change");
updated = updated.replaceAll("without new planting", "2014–2018 official trend extrapolated");
updated = updated.replaceAll(
  "Annual recursive crown growth from 2026 to {lastRun.year}.",
  "Direct empirical crown-age projection from 2026 to {lastRun.year}; no 24-step autoregressive loop is used in the planner.",
);

updated = updated.replace(
  "<strong>How it works:</strong> the heat model receives the baseline\n          temperature, target year and projected canopy coverage from Model B.\n          It compares the no-intervention baseline with the planting scenario;\n          values shown here are calibrated prototype outputs.",
  "<strong>Data basis:</strong> UHI coefficients are fitted from official 2018 suburb UHI/tree-cover plus City of Melbourne 2018 building footprints.\n          Scenario predictions use the latest verified 2023 building form held constant and vary projected tree cover.\n          Future horizons are model predictions, not observations.",
);
updated = updated.replace(
  "<strong>Data basis:</strong> the baseline is anchored to Victorian Planning's\n          official Urban Heat 2018 suburb layer and vegetation/tree-cover metrics.\n          Building coverage and height are aggregated from City of Melbourne 2023\n          Building Footprints, while lifecycle shares come from the 2025 tree inventory.\n          Values after 2026 are modelled projections, not future observations.",
  "<strong>Data basis:</strong> UHI coefficients are fitted from official 2018 suburb UHI/tree-cover plus City of Melbourne 2018 building footprints.\n          Scenario predictions use the latest verified 2023 building form held constant and vary projected tree cover.\n          Future horizons are model predictions, not observations.",
);

updated = updated.replace(
  "const climateCooling = (result.currentHeat - result.baselineHeat).toFixed(1);",
  "const baselineHeatDelta = Number((result.baselineHeat - result.currentHeat).toFixed(2));\n  const baselineHeatDeltaLabel = `${baselineHeatDelta >= 0 ? \"+\" : \"−\"}${Math.abs(baselineHeatDelta).toFixed(2)}°C`;",
);
updated = updated.replace(
  "sub={`−${climateCooling}°C from current`}",
  "sub={`${baselineHeatDeltaLabel} from 2026 baseline`}",
);
updated = updated.replace(
  "<strong>−{climateCooling}°C</strong>",
  "<strong>{baselineHeatDeltaLabel}</strong>",
);

// Add the planner-facing scenario/cost/evidence panel once, immediately after result tabs.
if (!updated.includes("<PlannerDecisionPanel")) {
  updated = updated.replace(
    "          </Tabs>\n        </section>\n      </div>\n      <VisualComparison",
    "          </Tabs>\n          <PlannerDecisionPanel\n            area={lastRun.area}\n            count={lastRun.count}\n            year={lastRun.year}\n            result={result}\n          />\n        </section>\n      </div>\n      <VisualComparison",
  );
}

if (updated !== source) {
  await writeFile(file, updated, "utf8");
  console.log("Scenario UI upgraded: five horizons, empirical evidence and urban-planner cost view enabled.");
} else {
  console.log("Scenario source is already upgraded for planner decision support.");
}
