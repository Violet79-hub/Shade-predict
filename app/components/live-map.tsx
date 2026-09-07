"use client";

import { BadgeCheck, Layers3, MapPin, Route, Trees } from "lucide-react";
import { baseByArea, streetCorridorsByArea } from "../data";

export type SelectionMode = "suburb" | "clue" | "street";
type MapPoint = { x: number; y: number };

function seededRatio(seed: number, index: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
function areaSeed(area: string) {
  return area
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}
function boundaryPoints(seed: number): MapPoint[] {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 9 - Math.PI / 2;
    const radius = 34 + seededRatio(seed + 401, index) * 7;
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 51 + Math.sin(angle) * radius,
    };
  });
}
function pointsAttribute(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
function pointInPolygon(point: MapPoint, polygon: MapPoint[]) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index],
      previousPoint = polygon[previous];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || 0.00001) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
function pointsInsideBoundary(
  seed: number,
  count: number,
  polygon: MapPoint[],
) {
  const minX = Math.min(...polygon.map((point) => point.x)),
    maxX = Math.max(...polygon.map((point) => point.x)),
    minY = Math.min(...polygon.map((point) => point.y)),
    maxY = Math.max(...polygon.map((point) => point.y));
  const points: MapPoint[] = [];
  for (
    let attempt = 0;
    points.length < count && attempt < count * 80 + 500;
    attempt += 1
  ) {
    const candidate = {
      x: minX + seededRatio(seed, attempt * 2 + 1) * (maxX - minX),
      y: minY + seededRatio(seed, attempt * 2 + 2) * (maxY - minY),
    };
    if (pointInPolygon(candidate, polygon)) points.push(candidate);
  }
  return points;
}

function corridorGeometry(route: 0 | 1 | 2, seed: number) {
  if (route === 0)
    return {
      start: { x: 42 + (seed % 8), y: 10 },
      control: { x: 38 + (seed % 10), y: 50 },
      end: { x: 51 + (seed % 7), y: 91 },
    };
  if (route === 1)
    return {
      start: { x: 12, y: 78 - (seed % 10) },
      control: { x: 48, y: 44 + (seed % 8) },
      end: { x: 90, y: 22 + (seed % 8) },
    };
  return {
    start: { x: 8, y: 38 + (seed % 18) },
    control: { x: 52, y: 33 + (seed % 14) },
    end: { x: 92, y: 48 + (seed % 12) },
  };
}
function pointOnCorridor(
  geometry: ReturnType<typeof corridorGeometry>,
  position: number,
  index: number,
) {
  const inverse = 1 - position;
  const x =
    inverse * inverse * geometry.start.x +
    2 * inverse * position * geometry.control.x +
    position * position * geometry.end.x;
  const y =
    inverse * inverse * geometry.start.y +
    2 * inverse * position * geometry.control.y +
    position * position * geometry.end.y;
  return {
    x: x + (index % 2 === 0 ? -0.65 : 0.65),
    y: y + (index % 2 === 0 ? 0.55 : -0.55),
  };
}

const nearbyAreas: Record<string, string[]> = {
  Carlton: [
    "Parkville",
    "Princes Hill",
    "North Melbourne",
    "Fitzroy",
    "Melbourne CBD",
  ],
  "Melbourne CBD": [
    "Docklands",
    "Carlton",
    "East Melbourne",
    "Southbank",
    "West Melbourne",
  ],
  Docklands: [
    "West Melbourne",
    "Melbourne CBD",
    "South Wharf",
    "Southbank",
    "Kensington",
  ],
  Southbank: [
    "Melbourne CBD",
    "East Melbourne",
    "South Wharf",
    "Docklands",
    "West Melbourne",
  ],
};

export function LiveMap({
  area,
  count,
  selectionMode,
  streetId,
}: {
  area: string;
  count: number;
  selectionMode: SelectionMode;
  streetId: string;
}) {
  const seed = areaSeed(area),
    boundary = boundaryPoints(seed),
    streetOptions = streetCorridorsByArea[area] ?? [],
    street =
      streetOptions.find((item) => item.id === streetId) ?? streetOptions[0];
  const baseExistingCount = Math.min(
      120,
      Math.max(40, Math.round((baseByArea[area]?.current ?? 12.3) * 4.7)),
    ),
    safeCount = Math.min(500, Math.max(0, Math.round(count || 0)));
  const existingTrees = pointsInsideBoundary(seed, baseExistingCount, boundary),
    labels = nearbyAreas[area] ?? [
      "Parkville",
      "East Melbourne",
      "North Melbourne",
      "Fitzroy",
      "Melbourne CBD",
    ];
  const geometry = street ? corridorGeometry(street.route, seed) : null,
    streetCount = street ? Math.min(safeCount, street.capacity) : 0;
  const plannedTrees =
    selectionMode === "street" && geometry
      ? Array.from({ length: streetCount }, (_, index) =>
          pointOnCorridor(geometry, (index + 1) / (streetCount + 1), index),
        )
      : pointsInsideBoundary(seed + 997, safeCount, boundary);
  const streetPath = geometry
    ? `M${geometry.start.x} ${geometry.start.y} Q${geometry.control.x} ${geometry.control.y} ${geometry.end.x} ${geometry.end.y}`
    : "";
  return (
    <section
      className="live-map-shell schematic-map"
      aria-label={`Planning map for ${area}`}
    >
      <svg
        className="planning-map-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`blocks-${seed}`}
            width="9"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${(seed % 18) - 9})`}
          >
            <rect width="7.4" height="5.5" rx=".5" fill="#b8b9ab" />
            <rect
              x=".6"
              y=".7"
              width="2.2"
              height="1.5"
              fill="#d6d2bd"
              opacity=".7"
            />
            <path d="M0 6.3H9M8.2 0V7" stroke="#e9e7dc" strokeWidth="1.2" />
          </pattern>
          <filter id="area-shadow">
            <feDropShadow
              dx="0"
              dy=".7"
              stdDeviation=".65"
              floodColor="#173f35"
              floodOpacity=".42"
            />
          </filter>
        </defs>
        <rect width="100" height="100" fill="#9eb29b" />
        <rect
          width="100"
          height="100"
          fill={`url(#blocks-${seed})`}
          opacity=".96"
        />
        <path
          d="M-8 77C17 62 32 61 52 48S82 32 108 28"
          className="map-road-major"
        />
        <path
          d="M-8 77C17 62 32 61 52 48S82 32 108 28"
          className="map-road-inner"
        />
        <path d="M69 -8C65 20 69 37 58 108" className="map-road-major narrow" />
        <path d="M69 -8C65 20 69 37 58 108" className="map-road-inner narrow" />
        <path d="M8 4L31 18L22 37L4 27Z" className="map-park" />
        <path d="M72 62L98 57L103 81L78 91Z" className="map-park" />
        <polygon
          points={pointsAttribute(boundary)}
          className="area-boundary-fill"
        />
        <polygon
          points={pointsAttribute(boundary)}
          className="area-boundary-line"
          filter="url(#area-shadow)"
        />
        {selectionMode === "street" && geometry && (
          <>
            <path d={streetPath} className="street-corridor-halo" />
            <path d={streetPath} className="street-corridor-line" />
          </>
        )}
        {existingTrees.map((point, index) => (
          <circle
            key={`existing-${index}`}
            cx={point.x}
            cy={point.y}
            r=".72"
            className="map-existing-tree"
          />
        ))}
        {plannedTrees.slice(0, 90).map((point, index) => (
          <circle
            key={`halo-${index}`}
            cx={point.x}
            cy={point.y}
            r={safeCount > 180 ? 1.15 : 1.7}
            className="map-planting-halo"
          />
        ))}
        {plannedTrees.map((point, index) => (
          <circle
            key={`planned-${index}`}
            cx={point.x}
            cy={point.y}
            r={safeCount > 180 ? 0.56 : 0.83}
            className="map-planned-tree"
          />
        ))}
      </svg>
      <div className="map-place-label north-west">{labels[0]}</div>
      <div className="map-place-label north-east">{labels[1]}</div>
      <div className="map-place-label west">{labels[2]}</div>
      <div className="map-place-label east">{labels[3]}</div>
      <div className="map-place-label south">{labels[4]}</div>
      <div
        className={`selected-area-label ${selectionMode === "street" ? "street-label-active" : ""}`}
      >
        {selectionMode === "street" && street ? street.name : area}
      </div>
      <div className="live-map-legend">
        <div className="legend-title">
          <Layers3 size={14} /> Map layers
        </div>
        <span>
          <i className="existing-dot" /> Existing trees
        </span>
        <span>
          <i className="canopy-swatch" />{" "}
          {selectionMode === "street"
            ? "Selected street corridor"
            : "Canopy coverage"}
        </span>
        <span>
          <i className="planned-dot" /> Planting locations (
          {plannedTrees.length})
        </span>
      </div>
      <div className="planned-count-card">
        <Trees size={18} />
        <div>
          <strong>
            +{selectionMode === "street" ? streetCount : safeCount} trees
          </strong>
          <small>
            {selectionMode === "street"
              ? "placed along corridor"
              : "placed inside boundary"}
          </small>
        </div>
        <BadgeCheck size={15} />
      </div>
      {selectionMode === "street" && street && (
        <div className="corridor-map-card">
          <Route />
          <div>
            <strong>{street.length} m corridor</strong>
            <span>
              {street.capacity} available sites · {street.currentCanopy}% canopy
              · {street.heat}°C
            </span>
          </div>
        </div>
      )}
      <div className="map-scale">
        <span>0</span>
        <i />
        <span>500 m</span>
        <i />
        <span>1 km</span>
      </div>
      <div className="map-area-chip">
        <MapPin size={14} />
        <strong>{area}</strong>
        <span>
          {selectionMode === "clue"
            ? "CLUE planning area"
            : selectionMode === "street"
              ? "Street delivery plan"
              : "Suburb boundary"}
        </span>
      </div>
    </section>
  );
}
