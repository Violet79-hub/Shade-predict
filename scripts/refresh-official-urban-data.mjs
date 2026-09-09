import { writeFile } from "node:fs/promises";

const TREE_RESOURCE = "0f2a2180-2be0-5a58-a270-7538c35259e6";
const BUILDING_RESOURCE = "5826dcef-6524-4099-bdf7-c33e1e372acd";
const CKAN_BASE = "https://discover.data.vic.gov.au/en_AU/api/3/action/datastore_search";
const UHI_SUBURB_QUERY =
  "https://dev-plan-gis.mapshare.vic.gov.au/arcgis/rest/services/CoolingGreening/CoolingGreening/MapServer/54/query";

const areas = {
  Carlton: [[-37.8085, 144.956], [-37.792, 144.979]],
  "Carlton North": [[-37.7915, 144.961], [-37.7775, 144.983]],
  Docklands: [[-37.824, 144.931], [-37.805, 144.958]],
  "East Melbourne": [[-37.8215, 144.976], [-37.805, 145.0]],
  Kensington: [[-37.805, 144.9155], [-37.781, 144.944]],
  "Melbourne CBD": [[-37.8225, 144.95], [-37.804, 144.976]],
  "North Melbourne": [[-37.81, 144.9325], [-37.789, 144.958]],
  Parkville: [[-37.801, 144.935], [-37.771, 144.967]],
  Southbank: [[-37.834, 144.95], [-37.814, 144.979]],
  "South Wharf": [[-37.831, 144.944], [-37.818, 144.961]],
  "West Melbourne": [[-37.82, 144.916], [-37.792, 144.952]],
  Fitzroy: [[-37.807, 144.968], [-37.789, 144.99]],
  "Princes Hill": [[-37.787, 144.957], [-37.775, 144.974]],
};

const uhiLocalityMap = {
  "Melbourne CBD": "MELBOURNE",
};

function inBounds(lat, lon, bounds) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const [[south, west], [north, east]] = bounds;
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "Shade2050-data-refresh/1.0",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
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
    if (!payload?.success || !Array.isArray(payload.result?.records)) {
      throw new Error(`Unexpected CKAN response for ${resourceId}`);
    }
    const records = payload.result.records;
    all.push(...records);
    offset += records.length;
    if (records.length === 0 || offset >= payload.result.total) break;
  }

  return all;
}

function extractPoint(record) {
  const lat = toNumber(record.latitude);
  const lon = toNumber(record.longitude);
  if (lat !== null && lon !== null) return [lat, lon];

  const raw = record.geo_point_2d ?? record.coordinatelocation ?? record.geolocation;
  if (!raw) return [null, null];
  if (typeof raw === "object") {
    if (Array.isArray(raw) && raw.length >= 2) return [toNumber(raw[0]), toNumber(raw[1])];
    if ("lat" in raw && "lon" in raw) return [toNumber(raw.lat), toNumber(raw.lon)];
  }

  const text = String(raw);
  const matches = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (matches.length < 2) return [null, null];
  const possibleLat = matches.find((value) => value < -30 && value > -45);
  const possibleLon = matches.find((value) => value > 140 && value < 150);
  return [possibleLat ?? null, possibleLon ?? null];
}

function normaliseAge(record) {
  const ageText = String(record.age_description ?? "").toLowerCase();
  const planted = toNumber(record.year_planted);
  const inferredAge = planted ? Math.max(0, 2026 - planted) : null;

  if (/young|juvenile|new|establish/.test(ageText) || (inferredAge !== null && inferredAge < 12)) {
    return "young";
  }
  if (/old|senescent|over.?mature|veteran/.test(ageText) || (inferredAge !== null && inferredAge >= 45)) {
    return "old";
  }
  return "mature";
}

function isAtRisk(record) {
  const uleText = String(record.useful_life_expectency ?? "").toLowerCase();
  const uleValue = toNumber(record.useful_life_expectency_value);
  return /short|remove|poor|less than|<\s*10/.test(uleText) || (uleValue !== null && uleValue <= 10);
}

function parseGeoShape(record) {
  const raw = record.geo_shape;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ringAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const meanLat = ring.reduce((sum, point) => sum + Number(point[1] ?? 0), 0) / ring.length;
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLon = 111_320 * Math.cos((meanLat * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ax = Number(a[0]) * metresPerDegreeLon;
    const ay = Number(a[1]) * metresPerDegreeLat;
    const bx = Number(b[0]) * metresPerDegreeLon;
    const by = Number(b[1]) * metresPerDegreeLat;
    area += ax * by - bx * ay;
  }
  return Math.abs(area) / 2;
}

function polygonAreaM2(shape) {
  const geometry = shape?.geometry ?? shape;
  if (!geometry) return 0;
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates ?? [];
    return Math.max(0, ringAreaM2(outer) - holes.reduce((sum, ring) => sum + ringAreaM2(ring), 0));
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates ?? []).reduce((sum, polygon) => {
      const [outer, ...holes] = polygon;
      return sum + Math.max(0, ringAreaM2(outer) - holes.reduce((holeSum, ring) => holeSum + ringAreaM2(ring), 0));
    }, 0);
  }
  return 0;
}

function boundsAreaM2(bounds) {
  const [[south, west], [north, east]] = bounds;
  const meanLat = (south + north) / 2;
  const height = (north - south) * 111_320;
  const width = (east - west) * 111_320 * Math.cos((meanLat * Math.PI) / 180);
  return Math.max(1, Math.abs(width * height));
}

async function fetchUhiForArea(areaName) {
  const locality = uhiLocalityMap[areaName] ?? areaName.toUpperCase();
  const params = new URLSearchParams({
    where: `UPPER(LOCALITY)='${locality.replaceAll("'", "''")}'`,
    outFields: "LOCALITY,PERANYTREE,PERANYVEG,UHI18_M,Shape_Area",
    returnGeometry: "false",
    f: "json",
  });
  const payload = await fetchJson(`${UHI_SUBURB_QUERY}?${params}`);
  const features = payload?.features ?? [];
  if (!features.length) {
    throw new Error(`No official Urban Heat 2018 suburb record found for ${areaName} (${locality})`);
  }
  const attributes = features[0].attributes ?? {};
  return {
    treeCanopy: toNumber(attributes.PERANYTREE),
    vegetation: toNumber(attributes.PERANYVEG),
    uhi: toNumber(attributes.UHI18_M),
    shapeArea: toNumber(attributes.Shape_Area),
    locality: attributes.LOCALITY ?? locality,
  };
}

console.log("Fetching official City of Melbourne tree inventory…");
const trees = await fetchAllCkan(TREE_RESOURCE);
console.log(`Fetched ${trees.length.toLocaleString()} tree records.`);

console.log("Fetching official 2023 building footprints…");
const buildings = await fetchAllCkan(BUILDING_RESOURCE);
console.log(`Fetched ${buildings.length.toLocaleString()} building records.`);

const output = {};

for (const [areaName, bounds] of Object.entries(areas)) {
  const areaTrees = trees.filter((record) => {
    const [lat, lon] = extractPoint(record);
    return inBounds(lat, lon, bounds);
  });

  const ageCounts = { young: 0, mature: 0, old: 0 };
  let atRisk = 0;
  const dbhValues = [];
  for (const tree of areaTrees) {
    ageCounts[normaliseAge(tree)] += 1;
    if (isAtRisk(tree)) atRisk += 1;
    const dbh = toNumber(tree.diameter_breast_height);
    if (dbh !== null && dbh >= 0 && dbh < 1000) dbhValues.push(dbh);
  }

  const areaBuildings = buildings.filter((record) => {
    const [lat, lon] = extractPoint(record);
    return inBounds(lat, lon, bounds);
  });

  let footprintArea = 0;
  const heights = [];
  for (const building of areaBuildings) {
    footprintArea += polygonAreaM2(parseGeoShape(building));
    const extrusion = toNumber(building.structure_extrusion);
    const maxElevation = toNumber(building.structure_max_elevation);
    const minElevation = toNumber(building.structure_min_elevation);
    const height = extrusion ?? (maxElevation !== null && minElevation !== null ? maxElevation - minElevation : null);
    if (height !== null && height > 0 && height < 400) heights.push(height);
  }

  const officialHeat = await fetchUhiForArea(areaName);
  const analysisAreaM2 = boundsAreaM2(bounds);
  const treeCount = areaTrees.length;
  const buildingCoverage = Math.min(1, footprintArea / analysisAreaM2);
  const vegetation = officialHeat.vegetation ?? 0;

  output[areaName] = {
    analysisAreaM2: Math.round(analysisAreaM2),
    observedTreeCanopy2018: Number((officialHeat.treeCanopy ?? 0).toFixed(2)),
    observedVegetation2018: Number(vegetation.toFixed(2)),
    observedUhi2018: Number((officialHeat.uhi ?? 0).toFixed(2)),
    nonVegetatedSurfaceProxy: Number(Math.max(0, Math.min(1, 1 - vegetation / 100)).toFixed(4)),
    treeInventory2025: {
      count: treeCount,
      youngShare: treeCount ? Number((ageCounts.young / treeCount).toFixed(4)) : 0,
      matureShare: treeCount ? Number((ageCounts.mature / treeCount).toFixed(4)) : 0,
      oldShare: treeCount ? Number((ageCounts.old / treeCount).toFixed(4)) : 0,
      atRiskShare: treeCount ? Number((atRisk / treeCount).toFixed(4)) : 0,
      averageDbhCm: dbhValues.length
        ? Number((dbhValues.reduce((sum, value) => sum + value, 0) / dbhValues.length).toFixed(1))
        : null,
    },
    buildings2023: {
      structureCount: areaBuildings.length,
      buildingCoverage: Number(buildingCoverage.toFixed(4)),
      averageHeightM: heights.length
        ? Number((heights.reduce((sum, value) => sum + value, 0) / heights.length).toFixed(1))
        : null,
    },
    coverageNote: `Tree/building records aggregated inside the Shade 2050 ${areaName} analysis bounds; UHI/vegetation use the official 2018 suburb record (${officialHeat.locality}).`,
  };
}

const generatedAt = new Date().toISOString();
const moduleSource = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.\n\nexport type OfficialAreaUrbanData = {\n  analysisAreaM2: number;\n  observedTreeCanopy2018: number;\n  observedVegetation2018: number;\n  observedUhi2018: number;\n  nonVegetatedSurfaceProxy: number;\n  treeInventory2025: {\n    count: number;\n    youngShare: number;\n    matureShare: number;\n    oldShare: number;\n    atRiskShare: number;\n    averageDbhCm: number | null;\n  };\n  buildings2023: {\n    structureCount: number;\n    buildingCoverage: number;\n    averageHeightM: number | null;\n  };\n  coverageNote: string;\n};\n\nexport const officialUrbanData: Record<string, OfficialAreaUrbanData> = ${JSON.stringify(output, null, 2)};\n\nexport const officialDataProvenance = ${JSON.stringify({
  generatedAt,
  treeInventory: {
    organisation: "City of Melbourne",
    dataset: "Trees, with species and dimensions (Urban Forest)",
    sourceYear: 2025,
    resourceId: TREE_RESOURCE,
  },
  buildings: {
    organisation: "City of Melbourne",
    dataset: "2023 Building Footprints",
    sourceYear: 2023,
    resourceId: BUILDING_RESOURCE,
  },
  urbanHeat: {
    organisation: "Victorian Department of Transport and Planning",
    dataset: "Cooling & Greening — Urban Heat (2018) (Suburb)",
    sourceYear: 2018,
    layer: 54,
  },
}, null, 2)} as const;\n`;

await writeFile(new URL("../app/generated-official-data.ts", import.meta.url), moduleSource, "utf8");
console.log(`Official urban-data snapshot generated at ${generatedAt}.`);
