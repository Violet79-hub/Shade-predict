import { readFile, writeFile } from "node:fs/promises";

// Empirical planner enrichment.
//
// This script runs after the core official-data refresh. It adds four pieces that
// urban planners need but that should not be fabricated:
//   1) a mature-crown plateau derived from real mature-tree canopy observations,
//   2) an out-of-time 2021 crown backtest,
//   3) 2018->2021 managed/non-inventory canopy dynamics and persistence proxies,
//   4) 10 m planting-candidate points along the City's official planting schedule,
//      ranked with official 2018 Modified Mesh Block UHI/tree-cover/HVI data.
//
// All source observations are public City of Melbourne / Victorian Government
// datasets. Derived scores and proxy definitions are explicitly labelled below.

const DATA_API = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets";
const ARCGIS_BASE = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/CoolingGreening/CoolingGreening/MapServer";
const TREE_DATASET = "trees-with-species-and-dimensions-urban-forest";
const CANOPY_2021_DATASET = "tree-canopies-2021-urban-forest";
const PUBLIC_CANOPY_2018_DATASET = "tree-canopies-public-realm-2018-urban-forest";
const PLANTING_SCHEDULE_DATASET = "tree-planting-zone-schedules-with-years-urban-forest";

const generatedFile = new URL("../app/generated-official-data.ts", import.meta.url);
const runtimeFile = new URL("../app/generated-official-data.runtime.ts", import.meta.url);

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normaliseName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Shade2050-planning-enrichment/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchOfficialDataset(datasetId) {
  const urls = [
    `${DATA_API}/${datasetId}/exports/json`,
    `https://data.melbourne.vic.gov.au/api/v2/catalog/datasets/${datasetId}/exports/json`,
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      console.log(`Planner enrichment: fetching ${datasetId}...`);
      const payload = await fetchJson(url);
      const records = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.records)
            ? payload.records
            : null;
      if (!records) throw new Error(`Unexpected export payload for ${datasetId}`);
      console.log(`Planner enrichment: ${datasetId} -> ${records.length.toLocaleString()} records.`);
      return records;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Could not fetch ${datasetId}`);
}

async function fetchArcgisPaged(layer, { where = "1=1", outFields = "*", returnGeometry = true } = {}) {
  const pageSize = 1000;
  let offset = 0;
  const features = [];
  while (true) {
    const params = new URLSearchParams({
      where,
      outFields,
      returnGeometry: returnGeometry ? "true" : "false",
      outSR: "4326",
      f: "geojson",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const payload = await fetchJson(`${ARCGIS_BASE}/${layer}/query?${params}`);
    const page = payload?.features;
    if (!Array.isArray(page)) throw new Error(`Unexpected ArcGIS response for layer ${layer}`);
    features.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return features;
}

async function fetchArcgisHviByMb(mbCodes) {
  const output = new Map();
  const batchSize = 180;
  for (let i = 0; i < mbCodes.length; i += batchSize) {
    const batch = mbCodes.slice(i, i + batchSize);
    const quoted = batch.map((code) => `'${String(code).replaceAll("'", "''")}'`).join(",");
    const params = new URLSearchParams({
      where: `MB_CODE16 IN (${quoted})`,
      outFields: "MB_CODE16,HVI_INDEX",
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${ARCGIS_BASE}/63/query?${params}`);
    for (const feature of payload?.features ?? []) {
      const attrs = feature.attributes ?? feature.properties ?? {};
      const code = String(attrs.MB_CODE16 ?? "");
      const value = toNumber(attrs.HVI_INDEX);
      if (code && value !== null) output.set(code, value);
    }
  }
  return output;
}

function geometryFromRecord(record) {
  const raw = record.geo_shape ?? record.geometry ?? record.geom;
  if (!raw) return null;
  if (typeof raw === "object") {
    if (raw.type === "Feature") return raw.geometry ?? null;
    if (raw.geometry?.type) return raw.geometry;
    if (raw.type && raw.coordinates) return raw;
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed.type === "Feature") return parsed.geometry ?? null;
    return parsed.geometry ?? parsed;
  } catch {
    return null;
  }
}

function extractPoint(record) {
  const lat = toNumber(record.latitude ?? record.lat);
  const lon = toNumber(record.longitude ?? record.lon ?? record.lng);
  if (lat !== null && lon !== null) return [lon, lat];
  const raw = record.geo_point_2d ?? record.coordinatelocation ?? record.coordinate_location ?? record.geolocation ?? record.location;
  if (raw && typeof raw === "object") {
    if (raw.type === "Point" && Array.isArray(raw.coordinates)) {
      const x = toNumber(raw.coordinates[0]);
      const y = toNumber(raw.coordinates[1]);
      return x !== null && y !== null ? [x, y] : null;
    }
    if (raw.geometry?.type === "Point" && Array.isArray(raw.geometry.coordinates)) {
      const x = toNumber(raw.geometry.coordinates[0]);
      const y = toNumber(raw.geometry.coordinates[1]);
      return x !== null && y !== null ? [x, y] : null;
    }
    if (Array.isArray(raw) && raw.length >= 2) {
      const a = toNumber(raw[0]);
      const b = toNumber(raw[1]);
      if (a !== null && b !== null) return Math.abs(a) <= 90 ? [b, a] : [a, b];
    }
    const rLat = toNumber(raw.lat ?? raw.latitude);
    const rLon = toNumber(raw.lon ?? raw.lng ?? raw.longitude);
    if (rLat !== null && rLon !== null) return [rLon, rLat];
  }
  const numbers = String(raw ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const rLat = numbers.find((v) => v < -30 && v > -45);
  const rLon = numbers.find((v) => v > 140 && v < 150);
  return rLat !== undefined && rLon !== undefined ? [rLon, rLat] : null;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (!point || !geometry) return false;
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates ?? [];
    return Boolean(outer) && pointInRing(point, outer) && !holes.some((ring) => pointInRing(point, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates ?? []).some((polygon) => {
      const [outer, ...holes] = polygon;
      return Boolean(outer) && pointInRing(point, outer) && !holes.some((ring) => pointInRing(point, ring));
    });
  }
  return false;
}

function geometryBounds(geometry) {
  const pts = [];
  const collect = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      pts.push(value);
      return;
    }
    for (const child of value) collect(child);
  };
  collect(geometry?.coordinates);
  if (!pts.length) return null;
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

function geometryAreaM2(geometry) {
  const ringArea = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const meanLat = ring.reduce((sum, p) => sum + Number(p[1] ?? 0), 0) / ring.length;
    const sx = 111_320 * Math.cos((meanLat * Math.PI) / 180);
    const sy = 111_320;
    let area = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      area += Number(a[0]) * sx * Number(b[1]) * sy - Number(b[0]) * sx * Number(a[1]) * sy;
    }
    return Math.abs(area) / 2;
  };
  const polygonArea = (polygon) => {
    const [outer, ...holes] = polygon;
    return Math.max(0, ringArea(outer) - holes.reduce((sum, ring) => sum + ringArea(ring), 0));
  };
  if (geometry?.type === "Polygon") return polygonArea(geometry.coordinates ?? []);
  if (geometry?.type === "MultiPolygon") return (geometry.coordinates ?? []).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  return 0;
}

function centroidApprox(geometry, bounds = geometryBounds(geometry)) {
  if (!bounds) return null;
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

function buildPolygonIndex(polygons, cellSize = 0.002) {
  const grid = new Map();
  polygons.forEach((polygon, index) => {
    const b = polygon.bounds;
    if (!b) return;
    const minX = Math.floor(b.minX / cellSize);
    const maxX = Math.floor(b.maxX / cellSize);
    const minY = Math.floor(b.minY / cellSize);
    const maxY = Math.floor(b.maxY / cellSize);
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gy = minY; gy <= maxY; gy += 1) {
        const key = `${gx}:${gy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    }
  });
  return { grid, cellSize };
}

function findContainingPolygon(point, polygons, index) {
  if (!point) return null;
  const key = `${Math.floor(point[0] / index.cellSize)}:${Math.floor(point[1] / index.cellSize)}`;
  const candidates = index.grid.get(key) ?? [];
  let selected = null;
  for (const id of candidates) {
    const polygon = polygons[id];
    const b = polygon.bounds;
    if (!b || point[0] < b.minX || point[0] > b.maxX || point[1] < b.minY || point[1] > b.maxY) continue;
    if (!pointInGeometry(point, polygon.geometry)) continue;
    if (selected === null || polygon.areaM2 < polygons[selected].areaM2) selected = id;
  }
  return selected;
}

function parseGeneratedJson(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Missing generated-data token: ${startToken}`);
  const from = start + startToken.length;
  const end = source.indexOf(endToken, from);
  if (end < 0) throw new Error(`Missing generated-data end token: ${endToken}`);
  return JSON.parse(source.slice(from, end).trim());
}

function percentile(values, value) {
  if (!values.length) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  while (below < sorted.length && sorted[below] < value) below += 1;
  return sorted.length <= 1 ? 50 : (below / (sorted.length - 1)) * 100;
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function yearPlanted(record) {
  const raw = record.year_planted ?? record.date_planted;
  const direct = toNumber(raw);
  if (direct !== null && direct >= 1800 && direct <= 2100) return Math.trunc(direct);
  const match = String(raw ?? "").match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function treeName(record) {
  return String(record.common_name ?? record.common_nam ?? record.commonname ?? "").trim();
}

function treeAgeDescription(record) {
  return normaliseName(record.age_description);
}

function distanceMeters(a, b) {
  const meanLat = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const dx = (a[0] - b[0]) * 111_320 * Math.cos(meanLat);
  const dy = (a[1] - b[1]) * 110_540;
  return Math.sqrt(dx * dx + dy * dy);
}

function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates ?? []];
  if (geometry.type === "MultiLineString") return geometry.coordinates ?? [];
  if (geometry.type === "Polygon") return (geometry.coordinates ?? []).slice(0, 1);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates ?? []).flatMap((polygon) => polygon.slice(0, 1));
  return [];
}

function sampleLineEveryMeters(line, spacing = 10) {
  const out = [];
  if (!Array.isArray(line) || line.length < 2) return out;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const length = distanceMeters(a, b);
    const steps = Math.max(1, Math.floor(length / spacing));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

function modelForTree(models, commonName) {
  const target = normaliseName(commonName);
  const exact = models.find((model) => model.fitLevel === "species" && normaliseName(model.name) === target);
  if (exact) return exact;
  const partial = models.find((model) => {
    if (model.fitLevel !== "species") return false;
    const candidate = normaliseName(model.name);
    return candidate.includes(target) || target.includes(candidate);
  });
  return partial ?? models.find((model) => model.id === "citywide") ?? null;
}

function predictPower(model, age) {
  return Math.exp(model.logIntercept + model.logSlope * Math.log(Math.max(1, age) + 1));
}

console.log("Planner enrichment: loading generated empirical model...");
let generated = await readFile(generatedFile, "utf8");
const markerStart = "\n// SHADE2050_PLANNER_ENRICHMENT_START\n";
const markerEnd = "\n// SHADE2050_PLANNER_ENRICHMENT_END\n";
if (generated.includes(markerStart)) {
  generated = generated.slice(0, generated.indexOf(markerStart)) + generated.slice(generated.indexOf(markerEnd) + markerEnd.length);
}

const supportedAreas = parseGeneratedJson(
  generated,
  "export const supportedAreas = ",
  ";\nexport const officialUrbanData",
);
const officialUrbanData = parseGeneratedJson(
  generated,
  "export const officialUrbanData: Record<string, OfficialAreaUrbanData> = ",
  ";\nexport const empiricalSpeciesModels",
);
const empiricalSpeciesModels = parseGeneratedJson(
  generated,
  "export const empiricalSpeciesModels: EmpiricalSpeciesModel[] = ",
  ";\nexport const empiricalHeatModel",
);

const [trees, canopy2021Raw, public2018Raw, plantingScheduleRaw, suburbFeatures, meshHeatFeatures] = await Promise.all([
  fetchOfficialDataset(TREE_DATASET),
  fetchOfficialDataset(CANOPY_2021_DATASET),
  fetchOfficialDataset(PUBLIC_CANOPY_2018_DATASET),
  fetchOfficialDataset(PLANTING_SCHEDULE_DATASET),
  fetchArcgisPaged(54, { outFields: "LOCALITY,UHI18_M,PERANYTREE" }),
  fetchArcgisPaged(55, {
    where: "LGA LIKE '%Melbourne%'",
    outFields: "MB_CODE16,SA2_NAME16,UHI18_M,PERANYTREE,LGA",
  }),
]);

const canonicalByNormalised = new Map(supportedAreas.map((name) => [normaliseName(name === "Melbourne CBD" ? "Melbourne" : name), name]));
const suburbPolygons = suburbFeatures
  .map((feature) => {
    const rawName = String(feature.properties?.LOCALITY ?? "").trim();
    const canonical = canonicalByNormalised.get(normaliseName(rawName));
    const geometry = feature.geometry;
    const bounds = geometryBounds(geometry);
    return canonical && geometry && bounds ? { name: canonical, geometry, bounds, areaM2: geometryAreaM2(geometry) } : null;
  })
  .filter(Boolean);

function findArea(point) {
  if (!point) return null;
  for (const area of suburbPolygons) {
    const b = area.bounds;
    if (point[0] < b.minX || point[0] > b.maxX || point[1] < b.minY || point[1] > b.maxY) continue;
    if (pointInGeometry(point, area.geometry)) return area.name;
  }
  return null;
}

const canopy2021 = canopy2021Raw
  .map((record) => {
    const geometry = geometryFromRecord(record);
    const bounds = geometryBounds(geometry);
    const areaM2 = geometryAreaM2(geometry);
    const point = extractPoint(record) ?? centroidApprox(geometry, bounds);
    return geometry && bounds && areaM2 > 0 && point ? { geometry, bounds, areaM2, point, area: findArea(point) } : null;
  })
  .filter(Boolean);
const public2018 = public2018Raw
  .map((record) => {
    const geometry = geometryFromRecord(record);
    const bounds = geometryBounds(geometry);
    const areaM2 = geometryAreaM2(geometry);
    const point = extractPoint(record) ?? centroidApprox(geometry, bounds);
    return geometry && bounds && areaM2 > 0 && point ? { geometry, bounds, areaM2, point, area: findArea(point) } : null;
  })
  .filter(Boolean);

const canopy2021Index = buildPolygonIndex(canopy2021);
const polygonTrees2021 = new Map();
const treePoints = [];

for (const tree of trees) {
  const point = extractPoint(tree);
  if (!point) continue;
  const area = findArea(point);
  treePoints.push({ point, area, tree });
  const polygonId = findContainingPolygon(point, canopy2021, canopy2021Index);
  if (polygonId === null) continue;
  if (!polygonTrees2021.has(polygonId)) polygonTrees2021.set(polygonId, []);
  polygonTrees2021.get(polygonId).push({ tree, point, area });
}

console.log(`Planner enrichment: matched inventory trees to ${polygonTrees2021.size.toLocaleString()} observed 2021 canopy polygons.`);

// Mature-crown plateaus from single-tree mature canopy observations.
const matureByName = new Map();
const matureAll = [];
for (const [polygonId, matches] of polygonTrees2021) {
  if (matches.length !== 1) continue;
  const match = matches[0];
  if (!treeAgeDescription(match.tree).includes("mature")) continue;
  const name = treeName(match.tree);
  if (!name) continue;
  const crown = canopy2021[polygonId].areaM2;
  if (!(crown > 1 && crown < 5000)) continue;
  const key = normaliseName(name);
  if (!matureByName.has(key)) matureByName.set(key, []);
  matureByName.get(key).push(crown);
  matureAll.push(crown);
}
const citywideMatureP80 = quantile(matureAll, 0.8);
const empiricalMatureCrownByModelId = {};
for (const model of empiricalSpeciesModels) {
  const sample = model.id === "citywide" ? matureAll : (matureByName.get(normaliseName(model.name)) ?? []);
  const useSpecies = sample.length >= 10;
  const plateau = useSpecies ? quantile(sample, 0.8) : citywideMatureP80;
  empiricalMatureCrownByModelId[model.id] = {
    p80CrownAreaM2: plateau === null ? model.observedCrownAreaMax : Number(plateau.toFixed(2)),
    sampleCount: useSpecies ? sample.length : matureAll.length,
    fitLevel: useSpecies ? "species-mature" : "citywide-mature-fallback",
    observationYear: 2021,
  };
}

// Out-of-time crown backtest: fit was built from 2018 observations; validate on
// independent 2021 canopy polygons. Only single-inventory-tree polygons with a
// reliable 2003+ planting year are used.
const backtestRows = [];
for (const [polygonId, matches] of polygonTrees2021) {
  if (matches.length !== 1) continue;
  const { tree, area } = matches[0];
  const planted = yearPlanted(tree);
  if (planted === null || planted < 2003 || planted > 2018) continue;
  const model = modelForTree(empiricalSpeciesModels, treeName(tree));
  if (!model) continue;
  const age = 2021 - planted;
  const actual = canopy2021[polygonId].areaM2;
  if (!(age >= 3 && age <= 30 && actual >= 2 && actual <= 3000)) continue;
  const predicted = predictPower(model, age);
  if (!Number.isFinite(predicted) || predicted <= 0) continue;
  const ape = Math.abs(predicted - actual) / actual * 100;
  backtestRows.push({ area, actual, predicted, ape });
}

function validationSummary(rows) {
  if (!rows.length) return { n: 0, mape: null, medianApe: null, meanObservedCrownM2: null, meanPredictedCrownM2: null };
  return {
    n: rows.length,
    mape: Number((rows.reduce((sum, row) => sum + row.ape, 0) / rows.length).toFixed(2)),
    medianApe: Number(quantile(rows.map((row) => row.ape), 0.5).toFixed(2)),
    meanObservedCrownM2: Number((rows.reduce((sum, row) => sum + row.actual, 0) / rows.length).toFixed(2)),
    meanPredictedCrownM2: Number((rows.reduce((sum, row) => sum + row.predicted, 0) / rows.length).toFixed(2)),
  };
}

const modelValidation = {
  method: "2018 empirical crown fit -> independent 2021 canopy observation",
  kpiMapePct: 15,
  overall: validationSummary(backtestRows),
  byArea: Object.fromEntries(supportedAreas.map((area) => [area, validationSummary(backtestRows.filter((row) => row.area === area))])),
};

// Canopy dynamics: total observed 2021 canopy, official 2018 public-realm canopy,
// and a 2021 inventory-associated canopy proxy. The remaining canopy is labelled
// non-inventory, not legally/private-owned, because ownership cannot be inferred
// from the 2021 canopy polygons alone.
const total2021Area = Object.fromEntries(supportedAreas.map((area) => [area, 0]));
for (const polygon of canopy2021) if (polygon.area && total2021Area[polygon.area] !== undefined) total2021Area[polygon.area] += polygon.areaM2;
const public2018Area = Object.fromEntries(supportedAreas.map((area) => [area, 0]));
for (const polygon of public2018) if (polygon.area && public2018Area[polygon.area] !== undefined) public2018Area[polygon.area] += polygon.areaM2;
const inventory2021Area = Object.fromEntries(supportedAreas.map((area) => [area, 0]));
for (const [polygonId, matches] of polygonTrees2021) {
  const area = canopy2021[polygonId].area;
  if (!area || inventory2021Area[area] === undefined || matches.length === 0) continue;
  inventory2021Area[area] += canopy2021[polygonId].areaM2;
}

const persistenceArea = Object.fromEntries(supportedAreas.map((area) => [area, { retained: 0, total: 0 }]));
for (const polygon of public2018) {
  if (!polygon.area || !persistenceArea[polygon.area]) continue;
  persistenceArea[polygon.area].total += polygon.areaM2;
  if (findContainingPolygon(polygon.point, canopy2021, canopy2021Index) !== null) {
    persistenceArea[polygon.area].retained += polygon.areaM2;
  }
}

const canopyDynamicsByArea = {};
for (const area of supportedAreas) {
  const official = officialUrbanData[area];
  if (!official) continue;
  const areaM2 = Math.max(1, official.analysisAreaM2);
  const total2018 = official.observedTreeCanopy2018;
  const total2021 = clamp(total2021Area[area] / areaM2 * 100, 0, 100);
  const managed2018 = clamp(public2018Area[area] / areaM2 * 100, 0, total2018);
  const managed2021 = clamp(inventory2021Area[area] / areaM2 * 100, 0, total2021);
  const nonInventory2018 = Math.max(0, total2018 - managed2018);
  const nonInventory2021 = Math.max(0, total2021 - managed2021);
  const managedTrend = (managed2021 - managed2018) / 3;
  const nonInventoryTrend = (nonInventory2021 - nonInventory2018) / 3;
  const totalTrend = (total2021 - total2018) / 3;
  const persistence = persistenceArea[area].total > 0 ? persistenceArea[area].retained / persistenceArea[area].total : null;
  canopyDynamicsByArea[area] = {
    observedTreeCanopy2018: Number(total2018.toFixed(2)),
    observedTreeCanopy2021: Number(total2021.toFixed(2)),
    managedPublicCanopy2018: Number(managed2018.toFixed(2)),
    inventoryAssociatedCanopy2021: Number(managed2021.toFixed(2)),
    nonInventoryCanopy2018: Number(nonInventory2018.toFixed(2)),
    nonInventoryCanopy2021: Number(nonInventory2021.toFixed(2)),
    managedTrendPctPointPerYear: Number(managedTrend.toFixed(4)),
    nonInventoryTrendPctPointPerYear: Number(nonInventoryTrend.toFixed(4)),
    totalTrendPctPointPerYear: Number(totalTrend.toFixed(4)),
    publicCanopyPersistence2018to2021: persistence === null ? null : Number(persistence.toFixed(4)),
    estimatedTreeCanopy2026: Number(clamp(total2021 + totalTrend * 5, 0, 100).toFixed(2)),
    note: "2021 total canopy is observed City of Melbourne multispectral canopy. Managed/public trend uses official 2018 public-realm canopy versus 2021 canopy polygons associated with the municipal tree inventory; non-inventory canopy is a proxy and is not a cadastral private-ownership classification.",
  };
}

// Fine-grained planner layer: official 2018 Modified Mesh Block UHI/tree cover,
// joined to MMB HVI, then sampled every 10 m along official City of Melbourne
// planting-schedule street geometry. This creates candidate points, not a claim
// that every 10 m cell is physically plantable.
const mbCodes = meshHeatFeatures.map((feature) => String(feature.properties?.MB_CODE16 ?? "")).filter(Boolean);
const hviByMb = await fetchArcgisHviByMb([...new Set(mbCodes)]);
const meshPolygons = meshHeatFeatures
  .map((feature) => {
    const geometry = feature.geometry;
    const bounds = geometryBounds(geometry);
    const properties = feature.properties ?? {};
    const mbCode = String(properties.MB_CODE16 ?? "");
    const uhi = toNumber(properties.UHI18_M);
    const treeCover = toNumber(properties.PERANYTREE);
    const hvi = hviByMb.get(mbCode) ?? null;
    if (!geometry || !bounds || !mbCode || uhi === null || treeCover === null) return null;
    return { geometry, bounds, areaM2: geometryAreaM2(geometry), mbCode, uhi, treeCover, hvi };
  })
  .filter(Boolean);
const meshIndex = buildPolygonIndex(meshPolygons, 0.004);
const uhiValues = meshPolygons.map((mesh) => mesh.uhi);
const treeCoverValues = meshPolygons.map((mesh) => mesh.treeCover);
const hviValues = meshPolygons.map((mesh) => mesh.hvi).filter((value) => value !== null);

// Existing-tree index for a defensible minimum separation indicator.
const treeGridSize = 0.00025;
const treeGrid = new Map();
for (const item of treePoints) {
  const key = `${Math.floor(item.point[0] / treeGridSize)}:${Math.floor(item.point[1] / treeGridSize)}`;
  if (!treeGrid.has(key)) treeGrid.set(key, []);
  treeGrid.get(key).push(item.point);
}
function nearestTreeDistance(point, maxSearchM = 35) {
  const cellX = Math.floor(point[0] / treeGridSize);
  const cellY = Math.floor(point[1] / treeGridSize);
  let best = Infinity;
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (const treePoint of treeGrid.get(`${cellX + dx}:${cellY + dy}`) ?? []) {
        const d = distanceMeters(point, treePoint);
        if (d < best) best = d;
      }
    }
  }
  return Number.isFinite(best) && best <= maxSearchM ? best : null;
}

const planningGridByArea = Object.fromEntries(supportedAreas.map((area) => [area, []]));
const seen10m = new Set();
for (const record of plantingScheduleRaw) {
  const geometry = geometryFromRecord(record);
  const streetName = String(record.streetname ?? record.street_name ?? record.segdescr ?? "Scheduled street segment").trim();
  const schedule = String(record.schedule ?? record.planting_schedule ?? "").trim();
  for (const line of lineStrings(geometry)) {
    for (const point of sampleLineEveryMeters(line, 10)) {
      const area = findArea(point);
      if (!area || !planningGridByArea[area]) continue;
      const xM = point[0] * 111_320 * Math.cos(point[1] * Math.PI / 180);
      const yM = point[1] * 110_540;
      const cellKey = `${Math.floor(xM / 10)}:${Math.floor(yM / 10)}`;
      if (seen10m.has(cellKey)) continue;
      seen10m.add(cellKey);
      const meshId = findContainingPolygon(point, meshPolygons, meshIndex);
      if (meshId === null) continue;
      const mesh = meshPolygons[meshId];
      const nearestTreeM = nearestTreeDistance(point);
      if (nearestTreeM !== null && nearestTreeM < 5) continue;
      const heatPct = percentile(uhiValues, mesh.uhi);
      const canopyDeficitPct = 100 - percentile(treeCoverValues, mesh.treeCover);
      const vulnerabilityPct = mesh.hvi === null ? 50 : percentile(hviValues, mesh.hvi);
      const priorityScore = Math.round((heatPct + canopyDeficitPct + vulnerabilityPct) / 3);
      planningGridByArea[area].push({
        id: `${area.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${cellKey.replace(":", "-")}`,
        lat: Number(point[1].toFixed(6)),
        lon: Number(point[0].toFixed(6)),
        streetName,
        plantingSchedule: schedule || null,
        meshBlockCode: mesh.mbCode,
        uhi2018: Number(mesh.uhi.toFixed(2)),
        treeCover2018: Number(mesh.treeCover.toFixed(1)),
        hvi2018: mesh.hvi === null ? null : Number(mesh.hvi.toFixed(1)),
        nearestInventoryTreeM: nearestTreeM === null ? null : Number(nearestTreeM.toFixed(1)),
        priorityScore,
      });
    }
  }
}
for (const area of supportedAreas) {
  planningGridByArea[area] = planningGridByArea[area]
    .sort((a, b) => b.priorityScore - a.priorityScore || b.uhi2018 - a.uhi2018 || a.treeCover2018 - b.treeCover2018)
    .slice(0, 80);
}

const enrichmentProvenance = {
  generatedAt: new Date().toISOString(),
  matureCrown: {
    organisation: "City of Melbourne",
    datasets: ["Trees, with species and dimensions (Urban Forest)", "Tree Canopies 2021 (Urban Forest)"],
    method: "Single-inventory-tree canopy polygons labelled Mature; species p80 with citywide fallback",
  },
  backtest: {
    organisation: "City of Melbourne",
    trainingObservation: 2018,
    validationObservation: 2021,
    method: "Out-of-time absolute crown-area validation on single-inventory-tree 2021 canopy polygons with reliable planting years",
  },
  canopyDynamics: {
    organisation: "City of Melbourne",
    datasets: ["Tree canopies public realm 2018 (Urban Forest)", "Tree Canopies 2021 (Urban Forest)", "Trees, with species and dimensions (Urban Forest)"],
  },
  planningGrid: {
    organisations: ["City of Melbourne", "Victorian Department of Transport and Planning"],
    datasets: ["Tree planting zone schedules, with years (Urban Forest)", "Urban Heat (2018)(MMB)", "Heat Vulnerability Index (2018)(MMB)"],
    spacingM: 10,
    score: "Equal-weight percentile of MMB UHI severity, tree-cover deficit and HVI; candidates restricted to official planting-schedule geometry and >=5 m from an inventory tree",
  },
};

const enrichment = `${markerStart}export type EmpiricalMatureCrown = { p80CrownAreaM2: number; sampleCount: number; fitLevel: \"species-mature\" | \"citywide-mature-fallback\"; observationYear: 2021 };\nexport const empiricalMatureCrownByModelId: Record<string, EmpiricalMatureCrown> = ${JSON.stringify(empiricalMatureCrownByModelId, null, 2)};\n\nexport type CanopyDynamics = { observedTreeCanopy2018: number; observedTreeCanopy2021: number; managedPublicCanopy2018: number; inventoryAssociatedCanopy2021: number; nonInventoryCanopy2018: number; nonInventoryCanopy2021: number; managedTrendPctPointPerYear: number; nonInventoryTrendPctPointPerYear: number; totalTrendPctPointPerYear: number; publicCanopyPersistence2018to2021: number | null; estimatedTreeCanopy2026: number; note: string };\nexport const canopyDynamicsByArea: Record<string, CanopyDynamics> = ${JSON.stringify(canopyDynamicsByArea, null, 2)};\n\nexport type CrownBacktestSummary = { n: number; mape: number | null; medianApe: number | null; meanObservedCrownM2: number | null; meanPredictedCrownM2: number | null };\nexport const modelValidation = ${JSON.stringify(modelValidation, null, 2)} as const;\n\nexport type PlanningGridCell = { id: string; lat: number; lon: number; streetName: string; plantingSchedule: string | null; meshBlockCode: string; uhi2018: number; treeCover2018: number; hvi2018: number | null; nearestInventoryTreeM: number | null; priorityScore: number };\nexport const planningGridByArea: Record<string, PlanningGridCell[]> = ${JSON.stringify(planningGridByArea, null, 2)};\n\nexport const planningEnrichmentProvenance = ${JSON.stringify(enrichmentProvenance, null, 2)} as const;${markerEnd}`;

const finalSource = generated.trimEnd() + enrichment + "\n";
await writeFile(generatedFile, finalSource, "utf8");
await writeFile(runtimeFile, finalSource, "utf8");

console.log(
  `Planner enrichment complete: ${matureAll.length.toLocaleString()} mature crown matches; ` +
  `${backtestRows.length.toLocaleString()} 2021 backtest rows (MAPE ${modelValidation.overall.mape ?? "n/a"}%); ` +
  `${Object.values(planningGridByArea).reduce((sum, rows) => sum + rows.length, 0).toLocaleString()} ranked 10 m candidate cells.`,
);
