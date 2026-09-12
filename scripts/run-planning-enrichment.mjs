import { readFile, writeFile, rm } from "node:fs/promises";

// Compatibility runner for the planner enrichment pipeline.
// The DTP 2018 heat MMB layer exposes MB_CODE16 + SA1_MAIN16, while the HVI MMB
// layer exposes SA1_MAIN16 (not MB_CODE16). Join HVI at SA1_MAIN16 so the build
// uses the actual published schemas instead of assuming a shared MB identifier.

const sourceFile = new URL("./enrich-planning-data.mjs", import.meta.url);
const runtimeFile = new URL("./.enrich-planning-data.runtime.mjs", import.meta.url);
let source = await readFile(sourceFile, "utf8");

source = source
  .replaceAll("function fetchArcgisHviByMb(mbCodes)", "function fetchArcgisHviByMb(mbCodes)")
  .replaceAll("MB_CODE16 IN (${quoted})", "SA1_MAIN16 IN (${quoted})")
  .replaceAll('outFields: "MB_CODE16,HVI_INDEX"', 'outFields: "SA1_MAIN16,HVI_INDEX"')
  .replaceAll('const code = String(attrs.MB_CODE16 ?? "");', 'const code = String(attrs.SA1_MAIN16 ?? "");')
  .replaceAll(
    'outFields: "MB_CODE16,SA2_NAME16,UHI18_M,PERANYTREE,LGA"',
    'outFields: "MB_CODE16,SA1_MAIN16,SA2_NAME16,UHI18_M,PERANYTREE,LGA"',
  )
  .replace(
    'const mbCodes = meshHeatFeatures.map((feature) => String(feature.properties?.MB_CODE16 ?? "")).filter(Boolean);\nconst hviByMb = await fetchArcgisHviByMb([...new Set(mbCodes)]);',
    'const mbCodes = meshHeatFeatures.map((feature) => String(feature.properties?.SA1_MAIN16 ?? "")).filter(Boolean);\nconst hviByMb = await fetchArcgisHviByMb([...new Set(mbCodes)]);',
  )
  .replace(
    'const mbCode = String(properties.MB_CODE16 ?? "");\n    const uhi = toNumber(properties.UHI18_M);',
    'const mbCode = String(properties.MB_CODE16 ?? "");\n    const sa1Code = String(properties.SA1_MAIN16 ?? "");\n    const uhi = toNumber(properties.UHI18_M);',
  )
  .replace(
    'const hvi = hviByMb.get(mbCode) ?? null;',
    'const hvi = hviByMb.get(sa1Code) ?? null;',
  );

if (!source.includes('outFields: "MB_CODE16,SA1_MAIN16,SA2_NAME16,UHI18_M,PERANYTREE,LGA"')) {
  throw new Error("Planner enrichment schema patch did not apply to heat MMB query.");
}
if (!source.includes("SA1_MAIN16 IN (${quoted})")) {
  throw new Error("Planner enrichment schema patch did not apply to HVI join.");
}

await writeFile(runtimeFile, source, "utf8");
try {
  await import(runtimeFile.href + `?run=${Date.now()}`);
} finally {
  await rm(runtimeFile, { force: true });
}
