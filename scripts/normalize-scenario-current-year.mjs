import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../app/scenario/page.tsx", import.meta.url);
const source = await readFile(file, "utf8");
let updated = source.replaceAll("2024", "2026");

// Route the scenario planner through the lifecycle-aware canopy model and
// urban-form-aware heat model while keeping the rest of the prototype intact.
updated = updated.replace('from "../data";', 'from "../enhanced-data";');

// Keep visible model explanations aligned with the upgraded calculations.
updated = updated.replace(
  "Recursive simulation estimates how each planted tree grows, then\n            aggregates its contribution to the area-level canopy scenario.",
  "Lifecycle-aware simulation estimates how planted trees establish, survive and mature, then\n            aggregates their surviving crown contribution to the area-level canopy scenario.",
);
updated = updated.replace(
  "Each yearly crown estimate becomes the starting state for the next\n            time step. Species-specific growth rates are constrained to observed\n            crown ranges; scenario totals are aggregated after per-tree\n            inference. Demo values are precomputed for portfolio presentation.",
  "Each yearly crown estimate becomes the starting state for the next time step.\n            Growth slows as trees mature and scenario totals are survival-adjusted,\n            so the model does not assume every planted tree survives or grows\n            exponentially forever. Existing canopy is projected separately using\n            young, mature and old tree cohorts with age-dependent mortality.",
);
updated = updated.replace(
  "Translates projected canopy change into area-level surface\n            temperature outcomes for {area}.",
  "Combines projected canopy change with building density, average building height\n            and impervious surface to estimate area-level heat outcomes for {area}.",
);
updated = updated.replace(
  "<small>MODEL INPUT</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>From the planting scenario</span>",
  "<small>MODEL INPUTS</small>\n          <strong>+{result.canopyGain}% canopy</strong>\n          <span>Canopy + buildings + impervious surface</span>",
);
updated = updated.replace(
  "<span>Climate-adjusted change by {year}</span>",
  "<span>Existing-tree lifecycle + urban context by {year}</span>",
);
updated = updated.replace(
  "<span>Additional cooling from canopy</span>",
  "<span>Context-adjusted cooling from added canopy</span>",
);
updated = updated.replace(
  "<strong>How it works:</strong> the heat model receives the baseline\n          temperature, target year and projected canopy coverage from Model B.\n          It compares the no-intervention baseline with the planting scenario;\n          values shown here are calibrated prototype outputs.",
  "<strong>How it works:</strong> the heat model combines current temperature and\n          projected canopy with prototype urban-form context: building density,\n          average building height and impervious surface. It compares the lifecycle-aware\n          no-intervention baseline with the planting scenario. These contextual values\n          are transparent demo assumptions and should be replaced by GIS features in production.",
);
updated = updated.replace(
  "<small>Annual growth</small>",
  "<small>Initial annual growth</small>",
);
updated = updated.replace(
  "<small>recursive median</small>",
  "<small>slows with maturity</small>",
);

if (updated !== source) {
  await writeFile(file, updated, "utf8");
  console.log("Scenario source normalized to 2026 and enhanced lifecycle/urban-form models.");
} else {
  console.log("Scenario source is already normalized and enhanced.");
}
