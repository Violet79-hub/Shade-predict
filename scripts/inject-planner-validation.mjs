import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../app/scenario/page.tsx", import.meta.url);
let source = await readFile(file, "utf8");

if (!source.includes('from "../components/planner-validation-panel"')) {
  source = source.replace(
    'import { PlannerDecisionPanel } from "../components/planner-decision-panel";',
    'import { PlannerDecisionPanel } from "../components/planner-decision-panel";\nimport { PlannerValidationPanel } from "../components/planner-validation-panel";',
  );
}

if (!source.includes("<PlannerValidationPanel")) {
  source = source.replace(
    "          <PlannerDecisionPanel\n            area={lastRun.area}\n            count={lastRun.count}\n            year={lastRun.year}\n            result={result}\n          />",
    "          <PlannerDecisionPanel\n            area={lastRun.area}\n            count={lastRun.count}\n            year={lastRun.year}\n            result={result}\n          />\n          <PlannerValidationPanel\n            area={lastRun.area}\n            result={result}\n          />",
  );
}

await writeFile(file, source, "utf8");
console.log("Empirical validation + ranked 10 m planting candidates injected into scenario results.");
