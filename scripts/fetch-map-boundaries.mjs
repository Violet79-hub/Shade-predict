import { mkdir, writeFile } from 'node:fs/promises';
const source = 'https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/CoolingGreening/CoolingGreening/MapServer/54/query';
const names = ['MELBOURNE','SOUTH YARRA','NORTH MELBOURNE','SOUTHBANK','EAST MELBOURNE','FLEMINGTON','KENSINGTON','PORT MELBOURNE','DOCKLANDS','WEST MELBOURNE','CARLTON NORTH','CARLTON','PARKVILLE'];
const params = new URLSearchParams({where: `LOCALITY IN (${names.map(n => `'${n}'`).join(',')})`,outFields:'LOCALITY,PERANYTREE,UHI18_M',returnGeometry:'true',outSR:'4326',geometryPrecision:'6',f:'geojson'});
const response = await fetch(`${source}?${params}`, {signal: AbortSignal.timeout(90000)});
if (!response.ok) throw Error(`Boundary download failed: ${response.status}`);
const result = await response.json();
if (result.features?.length !== 13) throw Error('Expected all 13 official locality boundaries.');
for (const feature of result.features) {
  const locality = feature.properties.LOCALITY;
  feature.properties = {name: locality === 'MELBOURNE' ? 'Melbourne CBD' : ['SOUTH YARRA','FLEMINGTON','PORT MELBOURNE'].includes(locality) ? locality : locality.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), canopy: Number(feature.properties.PERANYTREE)};
}
result.source = source;
result.observedYear = 2018;
await mkdir(new URL('../public/map/', import.meta.url), {recursive:true});
await writeFile(new URL('../public/map/suburbs.geojson', import.meta.url), JSON.stringify(result));
console.log('Saved 13 verified official boundaries.');
