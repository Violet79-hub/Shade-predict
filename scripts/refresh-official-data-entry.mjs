// Entry point for the official-data refresh pipeline.
//
// DataVic harvests City of Melbourne datasets, but a harvested CKAN resource
// can remain listed while its datastore endpoint is unavailable. In that case
// this wrapper retrieves the exact same official dataset from the City of
// Melbourne Open Data API. It never substitutes synthetic rows.
//
// The core refresh script historically asks for the 2011 canopy resource as its
// "tree allometry" input. That dataset is polygon-only and cannot provide age or
// species. We therefore intercept only that request and supply an empirical
// tree-level training table derived from two real official sources instead:
//   1. City of Melbourne 2025 tree inventory (species, year planted, location)
//   2. City of Melbourne 2018 public-realm canopy polygons (observed crown area)
// Only 2018 canopy polygons containing exactly one inventory tree planted on or
// before 2018 are used. Growth-training rows are further limited to trees planted
// from 2003-2017 because the City notes that planting-year records are generally
// reliable for trees planted from 2003 onwards.

import { readFile, writeFile } from "node:fs/promises";

const originalFetch = globalThis.fetch.bind(globalThis);

const TREE_2025_RESOURCE = "0f2a2180-2be0-5a58-a270-7538c35259e6";
const LEGACY_TREE_ALLOMETRY_RESOURCE = "87c0e94c-d7f9-4e92-ac4a-cf1905a3a903";
const BUILDING_2018_RESOURCE = "9413d4b7-3b07-48f2-a7cd-0112fe3c3d96";
const BUILDING_2023_RESOURCE = "5826dcef-6524-4099-bdf7-c33e1e372acd";

const TREE_2025_DATASET = "trees-with-species-and-dimensions-urban-forest";
const CANOPY_2018_DATASET = "tree-canopies-public-realm-2018-urban-forest";

const DATASET_BY_RESOURCE = new Map([
  [TREE_2025_RESOURCE, TREE_2025_DATASET],
  [BUILDING_2018_RESOURCE, "2018-building-footprints"],
  [BUILDING_2023_RESOURCE, "2023-building-footprints"],
]);

const datasetCache = new Map();
let empiricalAllometryPromise = null;

async function fetchOfficialDataset(datasetId) {
  if (datasetCache.has(datasetId)) return datasetCache.get(datasetId);

  const promise = (async () => {
    const candidates = [
      `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${datasetId}/exports/json`,
      `https://data.melbourne.vic.gov.au/api/v2/catalog/datasets/${datasetId}/exports/json`,
    ];

    let lastError = null;
    for (const url of candidates) {
      try {
        console.log(`Fetching official City of Melbourne dataset: ${datasetId}`);
        const response = await originalFetch(url, {
          headers: { "user-agent": "Shade2050-data-refresh/4.2" },
        });
        if (!response.ok) {
          lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
          continue;
        }
        const payload = await response.json();
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.records)
              ? payload.records
              : null;
        if (!records) {
          lastError = new Error(`Unexpected official export response for ${datasetId}`);
          continue;
        }
        console.log(`Fetched ${records.length.toLocaleString()} records from City of Melbourne for ${datasetId}.`);
        return records;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`Unable to fetch official City of Melbourne dataset ${datasetId}`);
  })();

  datasetCache.set(datasetId, promise);
  try {
    return await promise;
  } catch (error) {
    datasetCache.delete(datasetId);
    throw error;
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function yearValue(...values) {
  for (const value of values) {
    const direct = toNumber(value);
    if (direct !== null && direct >= 1800 && direct <= 2100) return Math.trunc(direct);
    const match = String(value ?? "").match(/\b(18|19|20)\d{2}\b/);
    if (match) return Number(match[0]);
  }
  return null;
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

  const raw =
    record.geo_point_2d ??
    record.coordinatelocation ??
    record.coordinate_location ??
    record.geolocation ??
    record.location;

  if (raw && typeof raw === "object") {
    if (raw.type === "Point" && Array.isArray(raw.coordinates)) {
      return [toNumber(raw.coordinates[0]), toNumber(raw.coordinates[1])];
    }
    if (raw.geometry?.type === "Point" && Array.isArray(raw.geometry.coordinates)) {
      return [toNumber(raw.geometry.coordinates[0]), toNumber(raw.geometry.coordinates[1])];
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
  const rLat = numbers.find((value) => value < -30 && value > -45);
  const rLon = numbers.find((value) => value > 140 && value < 150);
  return rLat !== undefined && rLon !== undefined ? [rLon, rLat] : null;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
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
  const points = [];
  const collect = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push(value);
      return;
    }
    for (const child of value) collect(child);
  };
  collect(geometry?.coordinates);
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxX: Math.max(...points.map((p) => p[0])),
    maxY: Math.max(...points.map((p) => p[1])),
  };
}

function geometryAreaM2(geometry) {
  const ringArea = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const meanLat = ring.reduce((sum, point) => sum + Number(point[1] ?? 0), 0) / ring.length;
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
  if (geometry?.type === "MultiPolygon") {
    return (geometry.coordinates ?? []).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  }
  return 0;
}

function gridKey(x, y, size) {
  return `${Math.floor(x / size)}:${Math.floor(y / size)}`;
}

async function buildEmpiricalAllometryRows() {
  if (empiricalAllometryPromise) return empiricalAllometryPromise;

  empiricalAllometryPromise = (async () => {
    console.log("Building empirical tree-growth samples from official 2018 canopy polygons + 2025 tree inventory…");
    const [trees, canopyRows] = await Promise.all([
      fetchOfficialDataset(TREE_2025_DATASET),
      fetchOfficialDataset(CANOPY_2018_DATASET),
    ]);

    const polygons = [];
    for (const record of canopyRows) {
      const geometry = geometryFromRecord(record);
      const bounds = geometryBounds(geometry);
      if (!geometry || !bounds) continue;
      const suppliedArea = toNumber(record.shape_area ?? record.shapearea);
      const areaM2 = suppliedArea !== null && suppliedArea > 0
        ? suppliedArea
        : geometryAreaM2(geometry);
      if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 20_000) continue;
      polygons.push({ geometry, bounds, areaM2 });
    }

    if (polygons.length < 1000) {
      throw new Error(`Only ${polygons.length} usable official 2018 canopy polygons were parsed.`);
    }

    const cellSize = 0.002;
    const grid = new Map();
    polygons.forEach((polygon, index) => {
      const minX = Math.floor(polygon.bounds.minX / cellSize);
      const maxX = Math.floor(polygon.bounds.maxX / cellSize);
      const minY = Math.floor(polygon.bounds.minY / cellSize);
      const maxY = Math.floor(polygon.bounds.maxY / cellSize);
      for (let gx = minX; gx <= maxX; gx += 1) {
        for (let gy = minY; gy <= maxY; gy += 1) {
          const key = `${gx}:${gy}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(index);
        }
      }
    });

    const polygonTrees = new Map();
    for (const tree of trees) {
      const point = extractPoint(tree);
      const planted = yearValue(tree.year_planted, tree.date_planted);
      if (!point || planted === null || planted > 2018) continue;
      const candidateIds = grid.get(gridKey(point[0], point[1], cellSize)) ?? [];
      let selected = null;
      for (const polygonId of candidateIds) {
        const polygon = polygons[polygonId];
        if (
          point[0] < polygon.bounds.minX ||
          point[0] > polygon.bounds.maxX ||
          point[1] < polygon.bounds.minY ||
          point[1] > polygon.bounds.maxY ||
          !pointInGeometry(point, polygon.geometry)
        ) {
          continue;
        }
        if (selected === null || polygon.areaM2 < polygons[selected].areaM2) selected = polygonId;
      }
      if (selected === null) continue;
      if (!polygonTrees.has(selected)) polygonTrees.set(selected, []);
      polygonTrees.get(selected).push({ tree, planted });
    }

    const training = [];
    for (const [polygonId, matches] of polygonTrees) {
      if (matches.length !== 1) continue;
      const { tree, planted } = matches[0];
      if (planted < 2003 || planted > 2017) continue;
      const age = 2018 - planted;
      if (age < 1 || age > 15) continue;

      const commonName = String(
        tree.common_name ?? tree.common_nam ?? tree.commonname ?? "",
      ).trim();
      const scientificName = String(
        tree.scientific_name ?? tree.scientific ?? tree.scientificname ?? "",
      ).trim();
      if (!commonName) continue;

      const crownArea = polygons[polygonId].areaM2;
      const canopyDiameter = 2 * Math.sqrt(crownArea / Math.PI);
      if (!Number.isFinite(canopyDiameter) || canopyDiameter <= 0 || canopyDiameter > 80) continue;

      training.push({
        canopy_dia: Number(canopyDiameter.toFixed(4)),
        age,
        yearplant: planted,
        common_nam: commonName,
        scientific: scientificName || null,
      });
    }

    const speciesCounts = new Map();
    for (const row of training) {
      const key = row.common_nam.toLowerCase();
      speciesCounts.set(key, (speciesCounts.get(key) ?? 0) + 1);
    }
    const speciesWith15 = [...speciesCounts.values()].filter((sampleCount) => sampleCount >= 15).length;

    console.log(
      `Created ${training.length.toLocaleString()} single-tree empirical crown samples from ${polygons.length.toLocaleString()} official 2018 canopy polygons; ${speciesWith15} species have >=15 samples.`,
    );

    if (training.length < 100 || speciesWith15 < 1) {
      throw new Error(
        `Official 2018 canopy/tree spatial join produced only ${training.length} training rows and ${speciesWith15} species with >=15 samples. Refusing synthetic fallback.`,
      );
    }
    return training;
  })();

  return empiricalAllometryPromise;
}

function paginatedCkanResponse(records, requestUrl) {
  const offset = Number(requestUrl.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(requestUrl.searchParams.get("limit") ?? 100) || 100;
  return new Response(
    JSON.stringify({
      success: true,
      result: {
        records: records.slice(offset, offset + limit),
        total: records.length,
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const isDataVicDatastore =
    url.includes("discover.data.vic.gov.au") &&
    url.includes("/api/3/action/datastore_search");

  if (!isDataVicDatastore) return originalFetch(input, init);

  const requestUrl = new URL(url);
  const resourceId = requestUrl.searchParams.get("resource_id");

  if (resourceId === LEGACY_TREE_ALLOMETRY_RESOURCE) {
    const empiricalRows = await buildEmpiricalAllometryRows();
    return paginatedCkanResponse(empiricalRows, requestUrl);
  }

  const primary = await originalFetch(input, init);
  if (primary.ok) return primary;

  const datasetId = resourceId ? DATASET_BY_RESOURCE.get(resourceId) : null;
  if (!datasetId) return primary;

  const records = await fetchOfficialDataset(datasetId);
  return paginatedCkanResponse(records, requestUrl);
};

await import("./refresh-official-urban-data.mjs");

// The official ArcGIS locality values are uppercase (for example CARLTON and
// NORTH MELBOURNE). The UI uses one canonical display-name vocabulary. Normalize
// the completed generated module here so both supportedAreas and officialUrbanData
// use exactly the same keys as the application.
const CANONICAL_LOCALITIES = new Map([
  ["CARLTON", "Carlton"],
  ["CARLTON NORTH", "Carlton North"],
  ["DOCKLANDS", "Docklands"],
  ["EAST MELBOURNE", "East Melbourne"],
  ["KENSINGTON", "Kensington"],
  ["MELBOURNE", "Melbourne CBD"],
  ["NORTH MELBOURNE", "North Melbourne"],
  ["PARKVILLE", "Parkville"],
  ["SOUTHBANK", "Southbank"],
  ["SOUTH WHARF", "South Wharf"],
  ["WEST MELBOURNE", "West Melbourne"],
  ["FITZROY", "Fitzroy"],
  ["PRINCES HILL", "Princes Hill"],
]);

const EXPECTED_AREAS = [...CANONICAL_LOCALITIES.values()];
const generatedFile = new URL("../app/generated-official-data.ts", import.meta.url);
const runtimeFile = new URL("../app/generated-official-data.runtime.ts", import.meta.url);
let generated = await readFile(generatedFile, "utf8");

for (const [officialName, canonicalName] of CANONICAL_LOCALITIES) {
  generated = generated.replaceAll(`"${officialName}"`, `"${canonicalName}"`);
}

generated = generated.replace(
  '"dataset": "Tree canopies 2011 (Urban Forest)",\n    "sourceYear": 2011,\n    "resourceId": "87c0e94c-d7f9-4e92-ac4a-cf1905a3a903"',
  '"dataset": "2018 public-realm canopy polygons spatially joined to 2025 tree inventory",\n    "sourceYear": 2018,\n    "resourceId": "tree-canopies-public-realm-2018-urban-forest"',
);

const missingAreas = EXPECTED_AREAS.filter(
  (areaName) => !generated.includes(`"${areaName}"`),
);
if (missingAreas.length) {
  throw new Error(
    `Generated official-data snapshot is missing canonical areas: ${missingAreas.join(", ")}. Refusing Netlify build.`,
  );
}
if (!generated.includes('"id": "citywide"')) {
  throw new Error("Generated official-data snapshot is missing the empirical citywide tree model.");
}
if (!generated.includes("export const empiricalHeatModel")) {
  throw new Error("Generated official-data snapshot is missing the empirical heat model.");
}

await writeFile(generatedFile, generated, "utf8");
await writeFile(runtimeFile, generated, "utf8");
console.log(
  `Verified build-only runtime snapshot: ${EXPECTED_AREAS.length} canonical areas + empirical tree models + empirical heat model.`,
);
