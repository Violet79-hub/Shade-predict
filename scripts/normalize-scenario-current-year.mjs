import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../app/scenario/page.tsx", import.meta.url);
const source = await readFile(file, "utf8");
let updated = source.replaceAll("2024", "2026");

// Route the scenario planner through the official-data model. The refresh step
// runs before this script and generates the current official data snapshot.
updated = updated.replace('from "../data";', 'from "../official-data-model";');
updated = updated.replace('from "../enhanced-data";', 'from "../official-data-model";');

// Keep visible model explanations aligned with the lifecycle-aware calculations.
updated = updated.replace(
  "Recursive simulation estimates how each planted tree grows, then\n            aggregates its contribution to the area-level canopy scenario.",
  "Lifecycle-aware simulation estimates how planted trees establish, survive and mature, then\n            aggregates their surviving crown contribution to the area-level canopy scenario.",
);
updated = updated.replace(
  "Each yearly crown estimate becomes the starting state for the next\n            time step. Species-specific growth rates are constrained to observed\n            crown ranges; scenario totals are aggregated after per-tree\n            inference. Demo values are precomputed for portfolio presentation.",
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted.\n            Existing-tree lifecycle shares are derived from the City of Melbourne\n            2025 tree inventory; future transitions remain model estimates.",
);
updated = updated.replace(
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted,\n            so the model does not assume every planted tree survives or grows\n            exponentially forever. Existing canopy is projected separately using\n            young, mature and old tree cohorts with age-dependent mortality.",
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted.\n            Existing-tree lifecycle shares are derived from the City of Melbourne\n            2025 tree inventory; future transitions remain model estimates.",
);

updated = updated.replace(
  "Translates projected canopy change into area-level surface\n            temperature outcomes for {area}.",
  "Combines projected canopy change with official building coverage, building height\n            and non-vegetated-surface context to estimate future UHI intensity for {area}.",
);
updated = updated.replace(
  "Combines projected canopy change with building density, average building height\n            and impervious surface to estimate area-level heat outcomes for {area}.",
  "Combines projected canopy change with official building coverage, building height\n            and non-vegetated-surface context to estimate future UHI intensity for {area}.",
);
updated = updated.replace(
  "<small>MODEL INPUT</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>From the planting scenario</span>",
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Official canopy + buildings + vegetation context</span>",
);
updated = updated.replace(
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Canopy + buildings + impervious surface</span>",
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Official canopy + buildings + vegetation context</span>",
);
updated = updated.replace(
  "<span>Climate-adjusted change by {year}</span>",
  "<span>Existing-tree lifecycle + official urban context by {year}</span>",
);
updated = updated.replace(
  "<span>Existing-tree lifecycle + urban context by {year}</span>",
  "<span>Existing-tree lifecycle + official urban context by {year}</span>",
);
updated = updated.replace(
  "<span>Additional cooling from canopy</span>",
  "<span>Context-adjusted UHI reduction from added canopy</span>",
);
updated = updated.replace(
  "<span>Context-adjusted cooling from added canopy</span>",
  "<span>Context-adjusted UHI reduction from added canopy</span>",
);

updated = updated.replaceAll("Average surface temperature", "Urban heat-island intensity");
updated = updated.replaceAll("Surface temperature comparison", "Urban heat-island comparison");
updated = updated.replaceAll("surface temp.", "UHI intensity");
updated = updated.replaceAll("surface temperature", "UHI intensity");
updated = updated.replaceAll("Observed summer peak", "2026 model baseline · anchored to official UHI 2018");
updated = updated.replaceAll("Climate-adjusted", "Lifecycle + urban-form adjusted");
updated = updated.replaceAll("25°C · cooler", "Lower UHI");
updated = updated.replaceAll("45°C · hotter", "Higher UHI");

updated = updated.replace(
  "<strong>How it works:</strong> the heat model receives the baseline\n          temperature, target year and projected canopy coverage from Model B.\n          It compares the no-intervention baseline with the planting scenario;\n          values shown here are calibrated prototype outputs.",
  "<strong>Data basis:</strong> the baseline is anchored to Victorian Planning's\n          official Urban Heat 2018 suburb layer and vegetation/tree-cover metrics.\n          Building coverage and height are aggregated from City of Melbourne 2023\n          Building Footprints, while lifecycle shares come from the 2025 tree inventory.\n          Values after 2026 are modelled projections, not future observations.",
);
updated = updated.replace(
  "<strong>How it works:</strong> the heat model combines current temperature and\n          projected canopy with prototype urban-form context: building density,\n          average building height and impervious surface. It compares the lifecycle-aware\n          no-intervention baseline with the planting scenario. These contextual values\n          are transparent demo assumptions and should be replaced by GIS features in production.",
  "<strong>Data basis:</strong> the baseline is anchored to Victorian Planning's\n          official Urban Heat 2018 suburb layer and vegetation/tree-cover metrics.\n          Building coverage and height are aggregated from City of Melbourne 2023\n          Building Footprints, while lifecycle shares come from the 2025 tree inventory.\n          Values after 2026 are modelled projections, not future observations.",
);
updated = updated.replace(
  "<small>Annual growth</small>",
  "<small>Initial annual growth</small>",
);
updated = updated.replace(
  "<small>recursive median</small>",
  "<small>slows with maturity</small>",
);

// Allow no-intervention UHI to become higher when existing canopy declines,
// without malformed labels such as “−-0.2°C”.
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

if (updated !== source) {
  await writeFile(file, updated, "utf8");
  console.log("Scenario source normalized to 2026 and routed to official urban-data inputs.");
} else {
  console.log("Scenario source is already normalized and routed to official data.");
}
