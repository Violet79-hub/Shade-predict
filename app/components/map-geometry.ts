import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson';
export type Boundary = Feature<Polygon | MultiPolygon, { name: string; canopy: number }>;

function ringContains(p: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function contains(p: Position, f: Boundary) {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polygons.some(r => ringContains(p, r[0]) && !r.slice(1).some(h => ringContains(p, h)));
}
export function bounds(f: Boundary): [[number, number], [number, number]] {
  const points = f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2);
  return [[Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]];
}
function disk(lng: number, lat: number, radius: number): Polygon {
  const ring = Array.from({ length: 17 }, (_, i) => {
    const angle = i / 16 * Math.PI * 2;
    return [lng + Math.cos(angle) * radius / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.sin(angle) * radius / 111320];
  });
  return { type: 'Polygon', coordinates: [ring] };
}
// Illustrative geometry only: these heights and positions are not forecast outputs.
export function treeGeometry(f: Boundary, count: number, year: number, anchor: [number, number] | null): FeatureCollection {
  const [[west, south], [east, north]] = bounds(f);
  const seed = [...f.properties.name].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const rand = (i: number) => { const x = Math.sin(i * 12.9898 + seed) * 43758.5453; return x - Math.floor(x); };
  const points: Position[] = [];
  const total = Number.isFinite(count) ? Math.max(0, Math.min(500, Math.floor(count))) : 0;
  for (let i = 0; i < total * 200 + 1000 && points.length < total; i++) {
    const p = anchor ? [anchor[0] + (rand(i * 2) - .5) * .0018, anchor[1] + (rand(i * 2 + 1) - .5) * .0014] : [west + rand(i * 2) * (east - west), south + rand(i * 2 + 1) * (north - south)];
    if (contains(p, f)) points.push(p);
  }
  const features: Feature[] = [];
  const growth = .65 + (Math.max(2030, Math.min(2050, year)) - 2030) / 40;
  points.forEach(([lng, lat], i) => {
    const radius = (3.4 + rand(i + 900) * 1.4) * growth, trunk = 2.5 * growth;
    features.push({ type: 'Feature', geometry: disk(lng, lat, .28), properties: { base: 0, height: trunk + radius, color: '#795333' } });
    for (let j = 0; j < 9; j++) {
      const t = (j + .5) / 9 * 2 - 1;
      features.push({ type: 'Feature', geometry: disk(lng, lat, Math.sqrt(1 - t * t) * radius), properties: { base: trunk + j * radius * 2 / 9, height: trunk + (j + 1) * radius * 2 / 9, color: j < 3 ? '#236244' : j < 7 ? '#398154' : '#66a466' } });
    }
  });
  return { type: 'FeatureCollection', features };
}
