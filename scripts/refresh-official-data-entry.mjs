// Entry point for the official-data refresh pipeline.
//
// DataVic harvests several City of Melbourne datasets, but occasionally a
// harvested CKAN resource remains visible while its datastore_search endpoint
// returns 404. When that happens we fetch the exact same official dataset from
// the City of Melbourne Open Data (Opendatasoft) API instead. No synthetic data
// or hard-coded fallback values are introduced here.

const originalFetch = globalThis.fetch.bind(globalThis);

const DATASET_BY_RESOURCE = new Map([
  ["0f2a2180-2be0-5a58-a270-7538c35259e6", "trees-with-species-and-dimensions-urban-forest"],
  ["87c0e94c-d7f9-4e92-ac4a-cf1905a3a903", "tree-canopies-2011-urban-forest"],
  ["9413d4b7-3b07-48f2-a7cd-0112fe3c3d96", "2018-building-footprints"],
  ["5826dcef-6524-4099-bdf7-c33e1e372acd", "2023-building-footprints"],
]);

const datasetCache = new Map();

async function fetchOfficialDataset(datasetId) {
  if (datasetCache.has(datasetId)) return datasetCache.get(datasetId);

  const candidates = [
    `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${datasetId}/exports/json`,
    `https://data.melbourne.vic.gov.au/api/v2/catalog/datasets/${datasetId}/exports/json`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      console.log(`DataVic datastore unavailable; fetching official City of Melbourne dataset: ${datasetId}`);
      const response = await originalFetch(url, {
        headers: { "user-agent": "Shade2050-data-refresh/3.0" },
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
      datasetCache.set(datasetId, records);
      console.log(`Fetched ${records.length.toLocaleString()} records from City of Melbourne for ${datasetId}.`);
      return records;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to fetch official City of Melbourne dataset ${datasetId}`);
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  const isDataVicDatastore =
    url.includes("discover.data.vic.gov.au") &&
    url.includes("/api/3/action/datastore_search");

  if (!isDataVicDatastore) return originalFetch(input, init);

  const primary = await originalFetch(input, init);
  if (primary.ok) return primary;

  // Only replace a failed harvested resource when we can map it back to the
  // exact City of Melbourne official dataset identifier.
  const requestUrl = new URL(url);
  const resourceId = requestUrl.searchParams.get("resource_id");
  const datasetId = resourceId ? DATASET_BY_RESOURCE.get(resourceId) : null;
  if (!datasetId) return primary;

  const records = await fetchOfficialDataset(datasetId);
  const offset = Number(requestUrl.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(requestUrl.searchParams.get("limit") ?? 100) || 100;
  const page = records.slice(offset, offset + limit);

  return new Response(
    JSON.stringify({
      success: true,
      result: {
        records: page,
        total: records.length,
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};

await import("./refresh-official-urban-data.mjs");
