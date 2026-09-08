import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../app/scenario/page.tsx", import.meta.url);
const source = await readFile(file, "utf8");
const updated = source.replaceAll("2024", "2026");

if (updated !== source) {
  await writeFile(file, updated, "utf8");
  console.log("Scenario current-year baseline normalized from 2024 to 2026.");
} else {
  console.log("Scenario current-year baseline is already 2026.");
}
