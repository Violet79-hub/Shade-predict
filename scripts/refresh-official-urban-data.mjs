import { writeFile } from "node:fs/promises";

const TREE_2025_RESOURCE = "0f2a2180-2be0-5a58-a270-7538c35259e6";
const TREE_2011_RESOURCE = "87c0e94c-d7f9-4e92-ac4a-cf1905a3a903";
const BUILDING_2018_RESOURCE = "9413d4b7-3b07-48f2-a7cd-0112fe3c3d96";
const BUILDING_2023_RESOURCE = "5826dcef-6524-4099-bdf7-c33e1e372acd";
const CKAN_BASE = "https://discover.data.vic.gov.au/en_AU/api/3/action/datastore_search";
const ARCGIS_BASE = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/CoolingGreening/CoolingGreening/MapServer";
const POPULATION_API = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/city-of-melbourne-population-forecasts-by-small-area-2020-2040/records";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function normaliseName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Shade2050-data-refresh/2.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchAllCkan(resourceId) {
  const pageSize = 5000;
  let offset = 0;
  const all = [];
  while (true) {
    const url = new URL(CKAN_BASE);
    url.searchParams.set("resource_id", resourceId);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const payload = await fetchJson(url);
    const records = payload?.result?.records;
    if (!payload?.success || !Array.isArray(records)) {
      throw new Error(`Unexpected CKAN response for ${resourceId}`);
    }
    all.push(...records);
    offset += records.length;
    if (records.length === 0 || offset >= payload.result.total) break;
  }
  return all;
}

async function fetchArcgisLayer(layer, outFields = "*") {
  const params = new URLSearchParams({
    where: "1=1",
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  const payload = await fetchJson(`${ARCGIS_BASE}/${layer}/query?${params}`);
  if (!Array.isArray(payload?.features)) throw new Error(`Unexpected ArcGIS response for layer ${layer}`);
  return payload.features;
}

function extractPoint(record) {
  const lat = toNumber(record.latitude);
  const lon = toNumber(record.longitude);
  if (lat !== null && lon !== null) return [lon, lat];
  const raw = record.geo_point_2d ?? record.coordinatelocation ?? record.geolocation;
  if (!raw) return null;
  if (typeof raw === "object") {
    if (Array.isArray(raw) && raw.length >= 2) {
      const a = toNumber(raw[0]);
      const b = toNumber(raw[1]);
      if (a !== null && b !== null) return Math.abs(a) <= 90 ? [b, a] : [a, b];
    }
    const rLat = toNumber(raw.lat ?? raw.latitude);
    const rLon = toNumber(raw.lon ?? raw.lng ?? raw.longitude);
    if (rLat !== null && rLon !== null) return [rLon, rLat];
  }
  const matches = String(raw).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const rLat = matches.find((v) => v < -30 && v > -45);
  const rLon = matches.find((v) => v > 140 && v < 150);
  return rLat !== undefined && rLon !== undefined ? [rLon, rLat] : null;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (!geometry || !point) return false;
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    return pointInRing(point, outer) && !holes.some((ring) => pointInRing(point, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => {
      const [outer, ...holes] = polygon;
      return pointInRing(point, outer) && !holes.some((ring) => pointInRing(point, ring));
    });
  }
  return false;
}

function geometryAreaM2(geometry) {
  const ringArea = (ring) => {
    if (!ring?.length) return 0;
    const meanLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    const sx = 111320 * Math.cos((meanLat * Math.PI) / 180);
    const sy = 111320;
    let area = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      area += a[0] * sx * b[1] * sy - b[0] * sx * a[1] * sy;
    }
    return Math.abs(area) / 2;
  };
  const polygonArea = (polygon) => {
    const [outer, ...holes] = polygon;
    return Math.max(0, ringArea(outer) - holes.reduce((s, r) => s + ringArea(r), 0));
  };
  if (geometry?.type === "Polygon") return polygonArea(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.reduce((s, p) => s + polygonArea(p), 0);
  return 0;
}

function recordGeometry(record) {
  const raw = record.geo_shape;
  if (!raw) return null;
  if (typeof raw === "object") return raw.geometry ?? raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed.geometry ?? parsed;
  } catch {
    return null;
  }
}

function buildingHeight(record) {
  const extrusion = toNumber(record.structure_extrusion ?? record.footprint_extrusion);
  if (extrusion !== null && extrusion > 0 && extrusion < 400) return extrusion;
  const max = toNumber(record.structure_max_elevation ?? record.footprint_max_elevation);
  const min = toNumber(record.structure_min_elevation ?? record.footprint_min_elevation);
  if (max !== null && min !== null && max > min && max - min < 400) return max - min;
  return null;
}

function aggregateBuildings(records, polygon) {
  let area = 0;
  const heights = [];
  let count = 0;
  for (const record of records) {
    const point = extractPoint(record);
    if (!pointInGeometry(point, polygon)) continue;
    count += 1;
    area += geometryAreaM2(recordGeometry(record));
    const h = buildingHeight(record);
    if (h !== null) heights.push(h);
  }
  return {
    structureCount: count,
    footprintAreaM2: area,
    averageHeightM: heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null,
  };
}

function ageClass(record) {
  const text = normaliseName(record.age_description);
  if (text.includes("unestablished")) return "unestablished";
  if (text.includes("semi mature") || text.includes("semimature")) return "semiMature";
  if (text.includes("mature")) return "mature";
  const year = toNumber(record.year_planted);
  if (year !== null) {
    const age = 2025 - year;
    if (age < 4) return "unestablished";
    if (age < 15) return "semiMature";
  }
  return "mature";
}

function aggregateTrees(records, polygon) {
  const counts = { unestablished: 0, semiMature: 0, mature: 0 };
  let total = 0;
  let uleUnder10 = 0;
  const dbh = [];
  for (const record of records) {
    if (!pointInGeometry(extractPoint(record), polygon)) continue;
    total += 1;
    counts[ageClass(record)] += 1;
    const ule = toNumber(record.useful_life_expectency_value);
    if (ule !== null && ule <= 10) uleUnder10 += 1;
    const d = toNumber(record.diameter_breast_height);
    if (d !== null && d > 0 && d < 500) dbh.push(d);
  }
  return {
    count: total,
    unestablishedShare: total ? counts.unestablished / total : 0,
    semiMatureShare: total ? counts.semiMature / total : 0,
    matureShare: total ? counts.mature / total : 0,
    uleUnder10Share: total ? uleUnder10 / total : 0,
    averageDbhCm: dbh.length ? dbh.reduce((a, b) => a + b, 0) / dbh.length : null,
  };
}

function fitLogAgeCrown(records) {
  const rows = [];
  for (const record of records) {
    const diameter = toNumber(record.canopy_dia);
    if (diameter === null || diameter <= 0 || diameter > 80) continue;
    let age = toNumber(record.age);
    if (age === null) {
      const planted = toNumber(record.yearplant);
      if (planted !== null && planted > 1850 && planted <= 2011) age = 2011 - planted;
    }
    if (age === null || age < 1 || age > 200) continue;
    const common = String(record.common_nam ?? "").trim();
    const scientific = String(record.scientific ?? "").trim() || null;
    const crownArea = Math.PI * Math.pow(diameter / 2, 2);
    rows.push({
      x: Math.log(age + 1),
      y: Math.log(crownArea),
      age,
      crownArea,
      common,
      scientific,
    });
  }

  const fit = (sample) => {
    const n = sample.length;
    const mx = sample.reduce((s, r) => s + r.x, 0) / n;
    const my = sample.reduce((s, r) => s + r.y, 0) / n;
    const denom = sample.reduce((s, r) => s + Math.pow(r.x - mx, 2), 0);
    const slope = denom > 0 ? sample.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0) / denom : 0;
    const intercept = my - slope * mx;
    const rmse = Math.sqrt(sample.reduce((s, r) => s + Math.pow(r.y - (intercept + slope * r.x), 2), 0) / n);
    return { intercept, slope, rmse };
  };

  const citywide = fit(rows);
  const bySpecies = new Map();
  for (const row of rows) {
    const key = normaliseName(row.common);
    if (!key) continue;
    if (!bySpecies.has(key)) bySpecies.set(key, []);
    bySpecies.get(key).push(row);
  }

  const models = [];
  for (const [key, sample] of bySpecies) {
    if (sample.length < 15) continue;
    const f = fit(sample);
    models.push({
      id: key.replace(/\s+/g, "-"),
      name: sample[0].common,
      scientificName: sample[0].scientific,
      sampleCount: sample.length,
      fitLevel: "species",
      logIntercept: f.intercept,
      logSlope: f.slope,
      rmseLog: f.rmse,
      minObservedAge: Math.min(...sample.map((r) => r.age)),
      maxObservedAge: Math.max(...sample.map((r) => r.age)),
      observedCrownAreaMin: Math.min(...sample.map((r) => r.crownArea)),
      observedCrownAreaMax: Math.max(...sample.map((r) => r.crownArea)),
    });
  }
  models.push({
    id: "citywide",
    name: "Citywide empirical fallback",
    scientificName: null,
    sampleCount: rows.length,
    fitLevel: "citywide",
    logIntercept: citywide.intercept,
    logSlope: citywide.slope,
    rmseLog: citywide.rmse,
    minObservedAge: Math.min(...rows.map((r) => r.age)),
    maxObservedAge: Math.max(...rows.map((r) => r.age)),
    observedCrownAreaMin: Math.min(...rows.map((r) => r.crownArea)),
    observedCrownAreaMax: Math.max(...rows.map((r) => r.crownArea)),
  });
  return models;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (Math.abs(a[col][col]) < 1e-10) throw new Error("Empirical heat regression is singular");
    const d = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= d;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function fitHeatModel(rows) {
  const X = rows.map((r) => [1, r.treeCover, r.buildingCoverage, r.averageHeight]);
  const y = rows.map((r) => r.uhi);
  const p = X[0].length;
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    for (let a = 0; a < p; a += 1) {
      xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b += 1) xtx[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solveLinearSystem(xtx, xty);
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  const predicted = X.map((row) => row.reduce((s, value, j) => s + value * beta[j], 0));
  const sse = y.reduce((s, value, i) => s + Math.pow(value - predicted[i], 2), 0);
  const sst = y.reduce((s, value) => s + Math.pow(value - meanY, 2), 0);
  return {
    n: rows.length,
    r2: sst > 0 ? 1 - sse / sst : 0,
    intercept: beta[0],
    treeCoverCoefficient: beta[1],
    buildingCoverageCoefficient: beta[2],
    averageHeightCoefficient: beta[3],
    trainingYear: 2018,
    buildingYear: 2018,
    note: "OLS fitted across supported City of Melbourne localities using official 2018 UHI/tree-cover and 2018 building-footprint aggregates.",
  };
}

async function fetchPopulation2026() {
  try {
    const url = new URL(POPULATION_API);
    url.searchParams.set("limit", "100");
    const payload = await fetchJson(url);
    const records = payload?.results ?? [];
    const output = new Map();
    for (const record of records) {
      const year = toNumber(record.year ?? record.forecast_year ?? record.census_year);
      if (year !== 2026) continue;
      const geography = String(record.geography ?? record.clue_small_area ?? record.small_area ?? "").trim();
      const population = toNumber(record.population ?? record.total_population ?? record.total);
      if (geography && population !== null) output.set(normaliseName(geography), population);
    }
    return output;
  } catch (error) {
    console.warn(`Population forecast fetch skipped: ${error.message}`);
    return new Map();
  }
}

console.log("Fetching official datasets…");
const [trees2025, trees2011, buildings2018, buildings2023, uhi2018, treeChange2014to2018, hvi2018, population2026] = await Promise.all([
  fetchAllCkan(TREE_2025_RESOURCE),
  fetchAllCkan(TREE_2011_RESOURCE),
  fetchAllCkan(BUILDING_2018_RESOURCE),
  fetchAllCkan(BUILDING_2023_RESOURCE),
  fetchArcgisLayer(54, "LOCALITY,PERANYTREE,PERANYVEG,UHI18_M,Shape_Area"),
  fetchArcgisLayer(37, "LOCALITY,PP_ANYTREE,PP_ANYVEG"),
  fetchArcgisLayer(62, "LOCALITY,HVI_2018"),
  fetchPopulation2026(),
]);

const speciesModels = fitLogAgeCrown(trees2011);
const changeByLocality = new Map(treeChange2014to2018.map((f) => [normaliseName(f.properties.LOCALITY), f.properties]));
const hviByLocality = new Map(hvi2018.map((f) => [normaliseName(f.properties.LOCALITY), f.properties]));
const output = {};
const supportedAreas = [];
const heatRows = [];

for (const feature of uhi2018) {
  const localityRaw = String(feature.properties.LOCALITY ?? "").trim();
  if (!localityRaw) continue;
  const localityKey = normaliseName(localityRaw);
  const polygon = feature.geometry;
  const areaM2 = geometryAreaM2(polygon) || toNumber(feature.properties.Shape_Area) || 0;
  if (areaM2 <= 0) continue;

  const treeInventory = aggregateTrees(trees2025, polygon);
  const b18 = aggregateBuildings(buildings2018, polygon);
  const b23 = aggregateBuildings(buildings2023, polygon);
  if (treeInventory.count === 0 || b18.structureCount === 0 || b23.structureCount === 0) continue;

  const tree2018 = toNumber(feature.properties.PERANYTREE);
  const veg2018 = toNumber(feature.properties.PERANYVEG);
  const uhi = toNumber(feature.properties.UHI18_M);
  if (tree2018 === null || veg2018 === null || uhi === null) continue;

  const change = changeByLocality.get(localityKey) ?? {};
  const ppTree = toNumber(change.PP_ANYTREE) ?? 0;
  const ppVeg = toNumber(change.PP_ANYVEG) ?? 0;
  const tree2014 = tree2018 - ppTree;
  const veg2014 = veg2018 - ppVeg;
  const annualTreeTrend = ppTree / 4;
  const estimatedTree2026 = Math.max(0, Math.min(100, tree2018 + annualTreeTrend * 8));
  const hvi = toNumber(hviByLocality.get(localityKey)?.HVI_2018) ?? 0;
  const population = population2026.get(localityKey) ?? null;
  const buildingCoverage2018 = Math.max(0, Math.min(1, b18.footprintAreaM2 / areaM2));
  const buildingCoverage2023 = Math.max(0, Math.min(1, b23.footprintAreaM2 / areaM2));
  const avgHeight2018 = b18.averageHeightM ?? 0;
  const avgHeight2023 = b23.averageHeightM ?? 0;

  const displayName = localityRaw === "MELBOURNE" ? "Melbourne CBD" : localityRaw.replace(/\b\w/g, (m) => m.toUpperCase());
  supportedAreas.push(displayName);
  output[displayName] = {
    analysisAreaM2: Math.round(areaM2),
    observedTreeCanopy2014: Number(tree2014.toFixed(2)),
    observedTreeCanopy2018: Number(tree2018.toFixed(2)),
    observedVegetation2014: Number(veg2014.toFixed(2)),
    observedVegetation2018: Number(veg2018.toFixed(2)),
    observedUhi2014: 0,
    observedUhi2018: Number(uhi.toFixed(3)),
    hvi2018: Number(hvi.toFixed(2)),
    population2026: population,
    canopyTrendPctPointPerYear: Number(annualTreeTrend.toFixed(4)),
    estimatedTreeCanopy2026: Number(estimatedTree2026.toFixed(2)),
    treeInventory2025: {
      count: treeInventory.count,
      unestablishedShare: Number(treeInventory.unestablishedShare.toFixed(4)),
      semiMatureShare: Number(treeInventory.semiMatureShare.toFixed(4)),
      matureShare: Number(treeInventory.matureShare.toFixed(4)),
      uleUnder10Share: Number(treeInventory.uleUnder10Share.toFixed(4)),
      averageDbhCm: treeInventory.averageDbhCm === null ? null : Number(treeInventory.averageDbhCm.toFixed(1)),
    },
    buildings2018: {
      structureCount: b18.structureCount,
      buildingCoverage: Number(buildingCoverage2018.toFixed(4)),
      averageHeightM: b18.averageHeightM === null ? null : Number(b18.averageHeightM.toFixed(1)),
    },
    buildings2023: {
      structureCount: b23.structureCount,
      buildingCoverage: Number(buildingCoverage2023.toFixed(4)),
      averageHeightM: b23.averageHeightM === null ? null : Number(b23.averageHeightM.toFixed(1)),
    },
    coverageNote: "Official Victorian suburb polygon used for tree/building aggregation. 2026 canopy is a linear extrapolation of the official 2014–2018 tree-cover change; later years are projections.",
  };
  heatRows.push({
    uhi,
    treeCover: tree2018,
    buildingCoverage: buildingCoverage2018 * 100,
    averageHeight: avgHeight2018,
  });
}

if (supportedAreas.length < 6) throw new Error(`Only ${supportedAreas.length} localities have complete official data; refusing to build a misleading model.`);
if (speciesModels.length < 2) throw new Error("Insufficient empirical tree-canopy samples to fit species/citywide growth models.");
const heatModel = fitHeatModel(heatRows);
const generatedAt = new Date().toISOString();

const provenance = {
  generatedAt,
  treeInventory: { organisation: "City of Melbourne", dataset: "Trees, with species and dimensions (Urban Forest)", sourceYear: 2025, resourceId: TREE_2025_RESOURCE },
  treeAllometry: { organisation: "City of Melbourne", dataset: "Tree canopies 2011 (Urban Forest)", sourceYear: 2011, resourceId: TREE_2011_RESOURCE },
  buildings2018: { organisation: "City of Melbourne", dataset: "2018 Building Footprints", sourceYear: 2018, resourceId: BUILDING_2018_RESOURCE },
  buildings2023: { organisation: "City of Melbourne", dataset: "2023 Building Footprints", sourceYear: 2023, resourceId: BUILDING_2023_RESOURCE },
  urbanHeat2018: { organisation: "Victorian Department of Transport and Planning", dataset: "Cooling & Greening — Urban Heat (2018) (Suburb)", sourceYear: 2018, layer: 54 },
  treeCoverChange: { organisation: "Victorian Department of Transport and Planning", dataset: "All trees (% change 2014-2018) (Suburb)", sourceYears: "2014-2018", layer: 37 },
  heatVulnerability: { organisation: "Victorian Department of Transport and Planning", dataset: "Heat Vulnerability Index (2018) (Suburb)", sourceYear: 2018, layer: 62 },
  population: { organisation: "City of Melbourne", dataset: "Population Forecasts by Small Area 2023-2043", sourceYear: 2026 },
};

const source = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.\n\nexport type OfficialAreaUrbanData = ${JSON.stringify({}).replace("{}", "{ analysisAreaM2: number; observedTreeCanopy2014: number; observedTreeCanopy2018: number; observedVegetation2014: number; observedVegetation2018: number; observedUhi2014: number; observedUhi2018: number; hvi2018: number; population2026: number | null; canopyTrendPctPointPerYear: number; estimatedTreeCanopy2026: number; treeInventory2025: { count: number; unestablishedShare: number; semiMatureShare: number; matureShare: number; uleUnder10Share: number; averageDbhCm: number | null }; buildings2018: { structureCount: number; buildingCoverage: number; averageHeightM: number | null }; buildings2023: { structureCount: number; buildingCoverage: number; averageHeightM: number | null }; coverageNote: string }")};\n\nexport type EmpiricalSpeciesModel = { id: string; name: string; scientificName: string | null; sampleCount: number; fitLevel: \"species\" | \"citywide\"; logIntercept: number; logSlope: number; rmseLog: number; minObservedAge: number; maxObservedAge: number; observedCrownAreaMin: number; observedCrownAreaMax: number };\nexport type EmpiricalHeatModel = { n: number; r2: number; intercept: number; treeCoverCoefficient: number; buildingCoverageCoefficient: number; averageHeightCoefficient: number; trainingYear: 2018; buildingYear: 2018; note: string };\n\nexport const supportedAreas = ${JSON.stringify(supportedAreas, null, 2)};\nexport const officialUrbanData: Record<string, OfficialAreaUrbanData> = ${JSON.stringify(output, null, 2)};\nexport const empiricalSpeciesModels: EmpiricalSpeciesModel[] = ${JSON.stringify(speciesModels, null, 2)};\nexport const empiricalHeatModel: EmpiricalHeatModel = ${JSON.stringify(heatModel, null, 2)};\nexport const officialDataProvenance = ${JSON.stringify(provenance, null, 2)} as const;\n`;

await writeFile(new URL("../app/generated-official-data.ts", import.meta.url), source, "utf8");
console.log(`Generated official empirical snapshot for ${supportedAreas.length} areas; heat model R²=${heatModel.r2.toFixed(3)}; ${speciesModels.length - 1} species fits + citywide fallback.`);
