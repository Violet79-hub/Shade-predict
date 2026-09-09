"use client";

import { BadgeCheck, Layers3, MapPin, Trees } from "lucide-react";
import { baseByArea } from "../official-data-model";

export type SelectionMode = "suburb" | "clue" | "street";
type MapPoint = { x: number; y: number };

function seededRatio(seed: number, index: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
function areaSeed(area: string) {
  return area.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}
function boundaryPoints(seed: number): MapPoint[] {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 9 - Math.PI / 2;
    const radius = 34 + seededRatio(seed + 401, index) * 7;
    return { x: 50 + Math.cos(angle) * radius, y: 51 + Math.sin(angle) * radius };
  });
}
function pointsAttribute(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
function pointInPolygon(point: MapPoint, polygon: MapPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index], previousPoint = polygon[previous];
    const intersects = currentPoint.y > point.y !== previousPoint.y > point.y && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y || 0.00001) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
function pointsInsideBoundary(seed: number, count: number, polygon: MapPoint[]) {
  const minX = Math.min(...polygon.map((point) => point.x)), maxX = Math.max(...polygon.map((point) => point.x)), minY = Math.min(...polygon.map((point) => point.y)), maxY = Math.max(...polygon.map((point) => point.y));
  const points: MapPoint[] = [];
  for (let attempt = 0; points.length < count && attempt < count * 80 + 500; attempt += 1) {
    const candidate = { x: minX + seededRatio(seed, attempt * 2 + 1) * (maxX - minX), y: minY + seededRatio(seed, attempt * 2 + 2) * (maxY - minY) };
    if (pointInPolygon(candidate, polygon)) points.push(candidate);
  }
  return points;
}

export function LiveMap({ area, count }: { area: string; count: number; selectionMode: SelectionMode; streetId: string }) {
  const seed = areaSeed(area), boundary = boundaryPoints(seed);
  const observedCanopy = baseByArea[area]?.current ?? 0;
  const illustrativeExistingCount = Math.min(100, Math.max(20, Math.round(observedCanopy * 3.5)));
  const safeCount = Math.min(500, Math.max(0, Math.round(count || 0)));
  const existingMarkers = pointsInsideBoundary(seed, illustrativeExistingCount, boundary);
  const plannedMarkers = pointsInsideBoundary(seed + 997, Math.min(safeCount, 120), boundary);

  return (
    <section className="live-map-shell schematic-map" aria-label={`Illustrative planning visual for ${area}`}>
      <svg className="planning-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id={`blocks-${seed}`} width="9" height="7" patternUnits="userSpaceOnUse" patternTransform={`rotate(${(seed % 18) - 9})`}>
            <rect width="7.4" height="5.5" rx=".5" fill="#b8b9ab" />
            <rect x=".6" y=".7" width="2.2" height="1.5" fill="#d6d2bd" opacity=".7" />
            <path d="M0 6.3H9M8.2 0V7" stroke="#e9e7dc" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="#9eb29b" />
        <rect width="100" height="100" fill={`url(#blocks-${seed})`} opacity=".96" />
        <path d="M-8 77C17 62 32 61 52 48S82 32 108 28" className="map-road-major" />
        <path d="M-8 77C17 62 32 61 52 48S82 32 108 28" className="map-road-inner" />
        <path d="M69 -8C65 20 69 37 58 108" className="map-road-major narrow" />
        <path d="M69 -8C65 20 69 37 58 108" className="map-road-inner narrow" />
        <path d="M8 4L31 18L22 37L4 27Z" className="map-park" />
        <path d="M72 62L98 57L103 81L78 91Z" className="map-park" />
        <polygon points={pointsAttribute(boundary)} className="area-boundary-fill" />
        <polygon points={pointsAttribute(boundary)} className="area-boundary-line" />
        {existingMarkers.map((point, index) => <circle key={`existing-${index}`} cx={point.x} cy={point.y} r=".72" className="map-existing-tree" />)}
        {plannedMarkers.map((point, index) => <circle key={`planned-${index}`} cx={point.x} cy={point.y} r={safeCount > 180 ? 0.56 : 0.83} className="map-planned-tree" />)}
      </svg>
      <div className="selected-area-label">{area}</div>
      <div className="live-map-legend">
        <div className="legend-title"><Layers3 size={14} /> Illustrative visual</div>
        <span><i className="existing-dot" /> Marker density scaled from official canopy %</span>
        <span><i className="planned-dot" /> Scenario markers (not surveyed planting sites)</span>
      </div>
      <div className="planned-count-card">
        <Trees size={18} />
        <div><strong>+{safeCount} trees</strong><small>scenario quantity · locations illustrative</small></div>
        <BadgeCheck size={15} />
      </div>
      <div className="map-area-chip"><MapPin size={14} /><strong>{area}</strong><span>Official data model · schematic map</span></div>
    </section>
  );
}
