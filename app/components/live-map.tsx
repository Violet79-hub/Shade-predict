"use client";

import { useState, type CSSProperties } from "react";
import { BadgeCheck, Layers3, LocateFixed, MapPin, Trees } from "lucide-react";
import { baseByArea } from "../official-data-model";

export type SelectionMode = "suburb" | "clue" | "street";
type MapPoint = { x: number; y: number };
type District = { name: string; points: MapPoint[]; label: MapPoint };

const districts: District[] = [
  { name: "Kensington", points: [{ x: 4, y: 20 }, { x: 25, y: 10 }, { x: 34, y: 24 }, { x: 32, y: 42 }, { x: 11, y: 39 }, { x: 3, y: 30 }], label: { x: 18, y: 28 } },
  { name: "North Melbourne", points: [{ x: 25, y: 10 }, { x: 47, y: 8 }, { x: 54, y: 37 }, { x: 32, y: 42 }, { x: 34, y: 24 }], label: { x: 40, y: 26 } },
  { name: "Parkville", points: [{ x: 47, y: 8 }, { x: 66, y: 7 }, { x: 65, y: 31 }, { x: 54, y: 37 }], label: { x: 56, y: 18 } },
  { name: "Carlton North", points: [{ x: 66, y: 7 }, { x: 82, y: 11 }, { x: 83, y: 31 }, { x: 65, y: 31 }], label: { x: 73, y: 19 } },
  { name: "Carlton", points: [{ x: 54, y: 37 }, { x: 65, y: 31 }, { x: 83, y: 31 }, { x: 82, y: 50 }, { x: 61, y: 51 }], label: { x: 70, y: 42 } },
  { name: "Fitzroy", points: [{ x: 83, y: 31 }, { x: 96, y: 26 }, { x: 98, y: 48 }, { x: 82, y: 50 }], label: { x: 90, y: 39 } },
  { name: "West Melbourne", points: [{ x: 11, y: 39 }, { x: 32, y: 42 }, { x: 54, y: 37 }, { x: 61, y: 51 }, { x: 49, y: 63 }, { x: 24, y: 61 }], label: { x: 38, y: 51 } },
  { name: "Melbourne CBD", points: [{ x: 61, y: 51 }, { x: 82, y: 50 }, { x: 82, y: 68 }, { x: 62, y: 69 }, { x: 49, y: 63 }], label: { x: 69, y: 60 } },
  { name: "East Melbourne", points: [{ x: 82, y: 50 }, { x: 98, y: 48 }, { x: 96, y: 70 }, { x: 82, y: 68 }], label: { x: 90, y: 59 } },
  { name: "Docklands", points: [{ x: 6, y: 58 }, { x: 24, y: 61 }, { x: 49, y: 63 }, { x: 45, y: 75 }, { x: 10, y: 76 }], label: { x: 27, y: 69 } },
  { name: "South Wharf", points: [{ x: 10, y: 76 }, { x: 45, y: 75 }, { x: 54, y: 88 }, { x: 19, y: 92 }], label: { x: 33, y: 84 } },
  { name: "Southbank", points: [{ x: 45, y: 75 }, { x: 62, y: 69 }, { x: 82, y: 68 }, { x: 80, y: 91 }, { x: 54, y: 88 }], label: { x: 65, y: 81 } },
  { name: "Princes Hill", points: [{ x: 82, y: 11 }, { x: 96, y: 12 }, { x: 96, y: 26 }, { x: 83, y: 31 }], label: { x: 89, y: 20 } },
];

function seededRatio(seed: number, index: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function areaSeed(area: string) {
  return area.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function pointsAttribute(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pointInPolygon(point: MapPoint, polygon: MapPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = currentPoint.y > point.y !== previousPoint.y > point.y
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y || 0.00001) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointsInsideBoundary(seed: number, count: number, polygon: MapPoint[]) {
  const minX = Math.min(...polygon.map((point) => point.x));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxY = Math.max(...polygon.map((point) => point.y));
  const points: MapPoint[] = [];
  for (let attempt = 0; points.length < count && attempt < count * 100 + 500; attempt += 1) {
    const candidate = {
      x: minX + seededRatio(seed, attempt * 2 + 1) * (maxX - minX),
      y: minY + seededRatio(seed, attempt * 2 + 2) * (maxY - minY),
    };
    if (pointInPolygon(candidate, polygon)) points.push(candidate);
  }
  return points;
}

function shadeFor(canopy: number) {
  if (canopy >= 20) return "canopy-5";
  if (canopy >= 15) return "canopy-4";
  if (canopy >= 10) return "canopy-3";
  if (canopy >= 5) return "canopy-2";
  return "canopy-1";
}

function TreeMarker({ point, index, seed }: { point: MapPoint; index: number; seed: number }) {
  const scale = 0.72 + seededRatio(seed + 77, index) * 0.38;
  const rotate = -5 + seededRatio(seed + 99, index) * 10;
  return (
    <g
      className="map-tree-3d"
      transform={`translate(${point.x} ${point.y}) rotate(${rotate}) scale(${scale})`}
      style={{ "--tree-delay": `${Math.min(index * 28, 700)}ms` } as CSSProperties}
    >
      <ellipse className="tree-ground-shadow" cx="1.2" cy="1.9" rx="2.5" ry=".72" />
      <path className="tree-trunk" d="M-.36 1.4L-.18-1.45H.42L.72 1.4Z" />
      <ellipse className="tree-crown-back" cx="-.7" cy="-2.15" rx="1.75" ry="1.3" />
      <ellipse className="tree-crown-mid" cx=".9" cy="-2.05" rx="1.65" ry="1.25" />
      <ellipse className="tree-crown-front" cx=".1" cy="-3.05" rx="1.8" ry="1.42" />
      <ellipse className="tree-highlight" cx="-.5" cy="-3.5" rx=".52" ry=".28" />
    </g>
  );
}

export function LiveMap({
  area,
  count,
  selectionMode,
  streetId,
  year,
  speciesName,
  onAreaChange,
}: {
  area: string;
  count: number;
  selectionMode: SelectionMode;
  streetId: string;
  year: 2030 | 2035 | 2040 | 2045 | 2050;
  speciesName: string;
  onAreaChange: (area: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const seed = areaSeed(area);
  const selectedDistrict = districts.find((district) => district.name === area) ?? districts[0];
  const observedCanopy = baseByArea[area]?.current ?? 0;
  const safeCount = Math.min(500, Math.max(0, Math.round(count || 0)));
  const existingMarkers = pointsInsideBoundary(seed, Math.min(130, Math.max(24, Math.round(observedCanopy * 4))), selectedDistrict.points);
  const plannedMarkers = pointsInsideBoundary(seed + 997, Math.min(44, Math.max(1, Math.ceil(safeCount / 5))), selectedDistrict.points);
  const modeLabel = selectionMode === "street" ? "Street corridor" : selectionMode === "clue" ? "CLUE area" : "Suburb";

  return (
    <section className="live-map-shell council-map" aria-label={`Interactive canopy planning map for ${area}`}>
      <svg className="planning-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="city-grid" width="8" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
            <rect width="8" height="7" fill="#f7f8f5" />
            <path d="M0 1.2H8M1.3 0V7M6.4 0V7" stroke="#e2e5e1" strokeWidth=".42" />
          </pattern>
          <linearGradient id="tree-trunk-gradient" x1="0" x2="1"><stop offset="0" stopColor="#6e4326" /><stop offset=".55" stopColor="#a47543" /><stop offset="1" stopColor="#54331f" /></linearGradient>
          <radialGradient id="tree-crown-back-gradient" cx="35%" cy="25%"><stop offset="0" stopColor="#94d36d" /><stop offset=".7" stopColor="#3c8b4e" /><stop offset="1" stopColor="#1f633c" /></radialGradient>
          <radialGradient id="tree-crown-front-gradient" cx="35%" cy="20%"><stop offset="0" stopColor="#b5e887" /><stop offset=".56" stopColor="#5aa85b" /><stop offset="1" stopColor="#267344" /></radialGradient>
          <filter id="tree-shadow" x="-60%" y="-80%" width="220%" height="240%"><feDropShadow dx=".35" dy=".55" stdDeviation=".35" floodColor="#173b2d" floodOpacity=".48" /></filter>
        </defs>
        <rect width="100" height="100" fill="#f7f8f5" />
        <rect width="100" height="100" fill="url(#city-grid)" />
        <g className="map-viewport" transform={`translate(50 50) scale(${zoom}) translate(-50 -50)`}>
          <path className="map-water" d="M0 70C14 65 23 68 37 72C52 77 64 71 78 74C89 76 95 82 100 86V100H0Z" />
          <path className="map-arterial" d="M-5 49C18 44 30 43 46 38S77 24 105 21" />
          <path className="map-arterial fine" d="M18-5C25 22 26 42 22 105M53-5C54 18 52 45 58 105M86-5C82 21 86 53 91 105" />
          {districts.map((district) => {
            const canopy = baseByArea[district.name]?.current ?? 8;
            const selected = district.name === selectedDistrict.name;
            return (
              <g
                key={district.name}
                className={selected ? "district selected" : "district"}
                role="button"
                tabIndex={0}
                aria-label={`Select ${district.name}`}
                onClick={() => onAreaChange(district.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onAreaChange(district.name);
                }}
              >
                <title>{district.name} · {canopy}% canopy</title>
                <polygon points={pointsAttribute(district.points)} className={`district-fill ${shadeFor(canopy)}`} />
                <polygon points={pointsAttribute(district.points)} className="district-border" />
                <text x={district.label.x} y={district.label.y} className="district-label">{district.name === "Melbourne CBD" ? "Melbourne (CBD)" : district.name}</text>
              </g>
            );
          })}
          {existingMarkers.map((point, index) => <circle key={`existing-${index}`} cx={point.x} cy={point.y} r=".25" className="map-existing-tree" />)}
          {plannedMarkers.map((point, index) => <TreeMarker key={`planned-${index}`} point={point} index={index} seed={seed} />)}
        </g>
      </svg>

      <div className="map-zoom-control" aria-label="Map zoom controls">
        <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, value + .2))}>+</button>
        <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1, value - .2))}>−</button>
        <button aria-label="Reset map view" onClick={() => setZoom(1)}><LocateFixed size={16} /></button>
      </div>
      <div className="live-map-legend">
        <div className="legend-title"><Layers3 size={15} /> Tree canopy cover · 2026</div>
        <small>% of analysis area</small>
        <div className="canopy-ramp"><i /><i /><i /><i /><i /></div>
        <div className="canopy-ticks"><span>0</span><span>5</span><span>10</span><span>15</span><span>20+</span></div>
        <span className="scenario-key"><i className="tree-key" /> Your {year} planting scenario</span>
      </div>
      <div className="planned-count-card"><Trees size={19} /><div><strong>+{safeCount} trees</strong><small>{speciesName} · preview</small></div><BadgeCheck size={15} /></div>
      <div className="map-area-chip"><MapPin size={14} /><strong>{area}</strong><span>{modeLabel}{selectionMode === "street" && streetId ? " · selected corridor" : ""}</span></div>
    </section>
  );
}
