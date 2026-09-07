"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BrainCircuit,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FolderOpen,
  Info,
  Leaf,
  LoaderCircle,
  MapPin,
  Route,
  Save,
  Sparkles,
  ThermometerSun,
  Trash2,
  Trees,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteHeader } from "@/app/components/site-header";
import { LiveMap, SelectionMode } from "@/app/components/live-map";
import {
  areas,
  baseByArea,
  calculateScenario,
  formatArea,
  makeGrowthData,
  species,
  streetCorridorsByArea,
} from "../data";

const clueAreas = [
  { id: "city-north", name: "City North", area: "Carlton" },
  { id: "hoddle-grid", name: "Hoddle Grid", area: "Melbourne CBD" },
  { id: "docklands", name: "Docklands", area: "Docklands" },
  { id: "southbank", name: "Southbank", area: "Southbank" },
  { id: "city-edge", name: "City Edge", area: "West Melbourne" },
];

type SavedScenario = {
  id: string;
  savedAt: string;
  area: string;
  selectionMode: SelectionMode;
  clueAreaId: string;
  streetId: string;
  speciesId: string;
  count: number;
  year: 2035 | 2050;
  canopy: number;
  heat: number;
  cooling: number;
  areaScale?: number;
};

function Logo() {
  return (
    <div className="brand-lockup" aria-label="Shade 2050 home">
      <div className="logo-mark">
        <Leaf size={22} strokeWidth={2.4} />
      </div>
      <div>
        <div className="brand-name">Shade 2050</div>
        <div className="brand-tag">Greener Melbourne. Cooler Futures.</div>
      </div>
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
  tone = "green",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "green" | "red" | "blue";
}) {
  return (
    <div className={`metric-pill ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniCanopyMap({
  density,
  heat = false,
}: {
  density: number;
  heat?: boolean;
}) {
  const dots = Array.from({ length: density }, (_, index) => ({
    left: `${13 + ((index * 31) % 76)}%`,
    top: `${10 + ((index * 23) % 77)}%`,
    size: 5 + ((index * 7) % 9),
  }));
  return (
    <div className={`mini-map ${heat ? "heat" : "canopy"}`} aria-hidden="true">
      <svg viewBox="0 0 120 82" preserveAspectRatio="none">
        <path d="M5 16L33 10L51 21L82 8L115 23M2 55L27 43L48 57L72 39L117 54M28 4L31 80M71 2L66 80M99 8L91 77" />
      </svg>
      {!heat &&
        dots.map((dot, index) => (
          <i
            key={index}
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
            }}
          />
        ))}
    </div>
  );
}

function ComparisonCard({
  label,
  value,
  sub,
  density,
  type = "canopy",
  emphasis = false,
  delta,
}: {
  label: string;
  value: string;
  sub: string;
  density: number;
  type?: "canopy" | "heat";
  emphasis?: boolean;
  delta?: string;
}) {
  return (
    <article className={`comparison-card ${emphasis ? "emphasis" : ""}`}>
      <div className="comparison-label">{label}</div>
      <MiniCanopyMap density={density} heat={type === "heat"} />
      <div
        className={`comparison-value ${type === "heat" ? "temperature" : ""}`}
      >
        {value}
      </div>
      <div className="comparison-sub">{sub}</div>
      {delta && (
        <div className="delta">
          <TrendingUp size={13} />
          {delta}
        </div>
      )}
    </article>
  );
}

function ScenarioControls({
  area,
  setArea,
  selectionMode,
  setSelectionMode,
  clueAreaId,
  setClueAreaId,
  streetId,
  setStreetId,
  speciesId,
  setSpeciesId,
  count,
  setCount,
  year,
  setYear,
  running,
  run,
}: {
  area: string;
  setArea: (v: string) => void;
  selectionMode: SelectionMode;
  setSelectionMode: (v: SelectionMode) => void;
  clueAreaId: string;
  setClueAreaId: (v: string) => void;
  streetId: string;
  setStreetId: (v: string) => void;
  speciesId: string;
  setSpeciesId: (v: string) => void;
  count: number;
  setCount: (v: number) => void;
  year: 2035 | 2050;
  setYear: (v: 2035 | 2050) => void;
  running: boolean;
  run: () => void;
}) {
  const activeTree = species.find((item) => item.id === speciesId)!;
  const streetOptions = streetCorridorsByArea[area] ?? [];
  const activeStreet =
    streetOptions.find((item) => item.id === streetId) ?? streetOptions[0];
  const maxTrees =
    selectionMode === "street" ? (activeStreet?.capacity ?? 500) : 500;
  return (
    <aside className="controls-panel">
      <div className="control-section">
        <div className="step-title">
          <span>1</span>
          <div>
            <strong>Select a planning scale</strong>
            <small>Move from strategy to street delivery</small>
          </div>
        </div>
        <Tabs
          value={selectionMode}
          onValueChange={(value) => setSelectionMode(value as SelectionMode)}
          className="compact-tabs"
        >
          <TabsList className="segmented" aria-label="Planning scale">
            <TabsTrigger value="suburb">Suburb</TabsTrigger>
            <TabsTrigger value="clue">CLUE Area</TabsTrigger>
            <TabsTrigger value="street">Street corridor</TabsTrigger>
          </TabsList>
          <TabsContent value="suburb">
            <label className="field-label" htmlFor="area-select">
              Selected suburb
            </label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id="area-select" className="site-select">
                <MapPin size={16} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-note">
              Strategic view for suburb-wide canopy and heat outcomes.
            </div>
          </TabsContent>
          <TabsContent value="clue">
            <label className="field-label" htmlFor="clue-area-select">
              CLUE planning area
            </label>
            <Select value={clueAreaId} onValueChange={setClueAreaId}>
              <SelectTrigger id="clue-area-select" className="site-select">
                <MapPin size={16} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clueAreas.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-note">
              Central-city planning unit for precinct-level decisions.
            </div>
          </TabsContent>
          <TabsContent value="street">
            <label className="field-label" htmlFor="street-area-select">
              Suburb context
            </label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id="street-area-select" className="site-select">
                <MapPin size={16} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="field-label" htmlFor="street-select">
              Street section
            </label>
            <Select value={activeStreet?.id} onValueChange={setStreetId}>
              <SelectTrigger id="street-select" className="site-select">
                <Route size={16} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {streetOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeStreet && (
              <div className="street-capacity-card">
                <span>
                  <strong>{activeStreet.length} m</strong>corridor length
                </span>
                <span>
                  <strong>{activeStreet.capacity}</strong>available sites
                </span>
                <span>
                  <strong>{activeStreet.currentCanopy}%</strong>current canopy
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <div className="control-section">
        <div className="step-title">
          <span>2</span>
          <div>
            <strong>Choose trees to plant</strong>
            <small>Configure the intervention</small>
          </div>
        </div>
        <label className="field-label" htmlFor="species-select">
          Tree species
        </label>
        <Select value={speciesId} onValueChange={setSpeciesId}>
          <SelectTrigger
            id="species-select"
            className="site-select tree-select"
          >
            <Trees size={17} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {species.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="species-note">
          <Leaf size={14} />
          {activeTree.note}
        </div>
        <label className="field-label" htmlFor="tree-count">
          Number of trees
        </label>
        <div className="number-field">
          <Input
            id="tree-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxTrees}
            step={1}
            value={count || ""}
            onChange={(e) =>
              setCount(e.target.value === "" ? 0 : Number(e.target.value))
            }
            onBlur={() => setCount(Math.min(maxTrees, Math.max(1, count || 1)))}
          />
          <span>trees</span>
        </div>
        <div className="input-help">
          {selectionMode === "street"
            ? `This corridor has up to ${maxTrees} available planting sites`
            : `Enter any whole number from 1 to ${maxTrees}`}
        </div>
        <label className="field-label">Target year</label>
        <div className="year-toggle" role="group" aria-label="Target year">
          {[2035, 2050].map((item) => (
            <button
              key={item}
              onClick={() => setYear(item as 2035 | 2050)}
              className={year === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="control-section run-section">
        <div className="step-title">
          <span>3</span>
          <div>
            <strong>Run scenario</strong>
            <small>
              {selectionMode === "street"
                ? "Forecast this street section"
                : "Generate Model B projections"}
            </small>
          </div>
        </div>
        <Button className="run-button" onClick={run} disabled={running}>
          {running ? (
            <>
              <LoaderCircle className="spin" /> Forecasting growth…
            </>
          ) : (
            <>
              <Sparkles /> Run prediction <ArrowRight />
            </>
          )}
        </Button>
        <div className="model-ready">
          <span>
            <BadgeCheck size={14} /> Model B ready
          </span>
          <small>v2.4 · calibrated 2026</small>
        </div>
      </div>
    </aside>
  );
}

function OverviewPanel({
  result,
  year,
}: {
  result: ReturnType<typeof calculateScenario>;
  year: 2035 | 2050;
}) {
  return (
    <div className="overview-content">
      <div className="overview-grid">
        <section className="result-block">
          <div className="block-heading">
            <span className="heading-icon green">
              <Leaf size={17} />
            </span>
            <div>
              <h3>Tree canopy coverage</h3>
              <p>Area-wide projected cover</p>
            </div>
          </div>
          <div className="triple-cards">
            <ComparisonCard
              label="Current · 2024"
              value={`${result.current}%`}
              sub={formatArea(result.currentArea)}
              density={9}
            />
            <ComparisonCard
              label={`Baseline · ${year}`}
              value={`${result.baseline}%`}
              sub={formatArea(result.baselineArea)}
              density={15}
            />
            <ComparisonCard
              label={`With planting · ${year}`}
              value={`${result.withPlanting}%`}
              sub={formatArea(result.plantingArea)}
              density={24}
              emphasis
              delta={`+${result.canopyGain}% cover`}
            />
          </div>
        </section>
        <section className="result-block">
          <div className="block-heading">
            <span className="heading-icon red">
              <ThermometerSun size={17} />
            </span>
            <div>
              <h3>Urban heat</h3>
              <p>Average surface temperature</p>
            </div>
          </div>
          <div className="triple-cards">
            <ComparisonCard
              label="Current · 2024"
              value={`${result.currentHeat}°`}
              sub="Observed summer peak"
              density={0}
              type="heat"
            />
            <ComparisonCard
              label={`Baseline · ${year}`}
              value={`${result.baselineHeat}°`}
              sub="Climate-adjusted"
              density={0}
              type="heat"
            />
            <ComparisonCard
              label={`With planting · ${year}`}
              value={`${result.plantingHeat}°`}
              sub="After intervention"
              density={0}
              type="heat"
              emphasis
              delta={`−${result.heatReduction}°C vs baseline`}
            />
          </div>
          <div className="heat-scale">
            <span>Cooler</span>
            <i />
            <span>Hotter</span>
          </div>
        </section>
      </div>
      <section className="impact-section">
        <div className="impact-heading">
          <Trees size={18} />
          <strong>Your planting impact</strong>
          <span>Compared with no intervention</span>
        </div>
        <div className="impact-grid">
          <MetricPill
            icon={<Trees size={20} />}
            value={`+${formatArea(result.addedArea)}`}
            label="added tree-level canopy"
          />
          <MetricPill
            icon={<TrendingUp size={20} />}
            value={`+${result.canopyGain}%`}
            label="canopy cover increase"
          />
          <MetricPill
            icon={<ThermometerSun size={20} />}
            value={`−${result.heatReduction}°C`}
            label="surface temperature"
            tone="red"
          />
          <MetricPill
            icon={<Building2 size={20} />}
            value="Higher liveability"
            label="cooler, healthier streets"
            tone="blue"
          />
        </div>
      </section>
    </div>
  );
}

function CanopyChangePanel({
  result,
  year,
  area,
}: {
  result: ReturnType<typeof calculateScenario>;
  year: 2035 | 2050;
  area: string;
}) {
  const years = [2024, 2030, 2035, 2040, 2045, 2050].filter(
    (item) => item <= year,
  );
  if (years[years.length - 1] !== year) years.push(year);
  const trajectory = years.map((item) => {
    const progress = (item - 2024) / (year - 2024);
    return {
      year: item,
      baseline: Number(
        (
          result.current +
          (result.baseline - result.current) * progress
        ).toFixed(1),
      ),
      withPlanting: Number(
        (
          result.current +
          (result.withPlanting - result.current) * progress
        ).toFixed(1),
      ),
    };
  });
  const interventionArea = Math.max(
    0,
    result.plantingArea - result.baselineArea,
  );
  return (
    <div className="canopy-change-panel">
      <div className="canopy-change-hero">
        <div className="canopy-hero-icon">
          <Leaf size={25} />
        </div>
        <div>
          <div className="eyebrow">AREA-LEVEL CANOPY OUTCOME</div>
          <h3>Canopy change across {area}</h3>
          <p>
            Compares natural canopy growth with the additional coverage created
            by this planting plan.
          </p>
        </div>
        <span className="canopy-gain-badge">
          +{result.canopyGain}% total gain
        </span>
      </div>
      <div className="canopy-pathway">
        <div>
          <small>CURRENT · 2024</small>
          <strong>{result.current}%</strong>
          <span>{formatArea(result.currentArea)}</span>
        </div>
        <ArrowRight />
        <div>
          <small>NO INTERVENTION · {year}</small>
          <strong>{result.baseline}%</strong>
          <span>{formatArea(result.baselineArea)}</span>
        </div>
        <ArrowRight />
        <div className="canopy-pathway-result">
          <small>WITH PLANTING · {year}</small>
          <strong>{result.withPlanting}%</strong>
          <span>{formatArea(result.plantingArea)}</span>
        </div>
      </div>
      <div className="canopy-change-grid">
        <section className="chart-card canopy-area-chart">
          <div className="chart-heading">
            <div>
              <h4>Area-wide canopy trajectory</h4>
              <p>
                Coverage percentage from current conditions to the target year
              </p>
            </div>
            <span className="chart-chip">% of area</span>
          </div>
          <div className="canopy-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trajectory}
                margin={{ top: 12, right: 15, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="scenarioCanopyFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#45ad75" stopOpacity={0.32} />
                    <stop
                      offset="100%"
                      stopColor="#45ad75"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#dce7e2"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="year"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                />
                <YAxis
                  domain={[0, Math.ceil(result.withPlanting + 5)]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                  unit="%"
                />
                <ChartTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #d8e5df",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="withPlanting"
                  name="With planting"
                  stroke="#14805a"
                  strokeWidth={3}
                  fill="url(#scenarioCanopyFill)"
                />
                <Area
                  type="monotone"
                  dataKey="baseline"
                  name="No intervention"
                  stroke="#849c94"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i className="solid" />
              With planting
            </span>
            <span>
              <i className="dashed" />
              No intervention
            </span>
          </div>
        </section>
        <aside className="canopy-breakdown">
          <h4>What changes by {year}</h4>
          <div>
            <small>Natural canopy growth</small>
            <strong>+{(result.baseline - result.current).toFixed(1)}%</strong>
            <span>without new planting</span>
          </div>
          <div className="highlight">
            <small>Planting contribution</small>
            <strong>+{formatArea(interventionArea)}</strong>
            <span>above the baseline</span>
          </div>
          <div>
            <small>Final covered area</small>
            <strong>{formatArea(result.plantingArea)}</strong>
            <span>
              {result.withPlanting}% of {area}
            </span>
          </div>
        </aside>
      </div>
      <div className="canopy-model-note">
        <Info size={15} />
        <p>
          <strong>Different from Model B:</strong> this view aggregates all
          trees into area-wide canopy coverage. Model B shows the crown growth
          forecast for each individual tree.
        </p>
      </div>
    </div>
  );
}

function ModelBPanel({
  tree,
  count,
  year,
  result,
  area,
}: {
  tree: (typeof species)[number];
  count: number;
  year: 2035 | 2050;
  result: ReturnType<typeof calculateScenario>;
  area: string;
}) {
  const growth = makeGrowthData(tree, count);
  const target = growth.find((item) => item.year === year)!;
  const contribution = [10, 25, 50, 100].map((treesCount) => ({
    trees: treesCount,
    canopy: Math.round(target.crown * treesCount),
  }));
  return (
    <div className="model-panel">
      <div className="model-hero">
        <div className="model-orb">
          <BrainCircuit size={27} />
        </div>
        <div>
          <div className="eyebrow">TREE-LEVEL FORECAST ENGINE</div>
          <h3>Model B · Crown growth projection</h3>
          <p>
            Recursive simulation estimates how each planted tree grows, then
            aggregates its contribution to the area-level canopy scenario.
          </p>
        </div>
        <div className="model-status">
          <span>
            <i />
            Operational
          </span>
          <small>Model version 2.4</small>
        </div>
      </div>
      <div className="input-ribbon">
        <div>
          <small>Planning area</small>
          <strong>{area}</strong>
        </div>
        <div>
          <small>Species</small>
          <strong>{tree.name}</strong>
        </div>
        <div>
          <small>Trees planted</small>
          <strong>{count}</strong>
        </div>
        <div>
          <small>Starting crown</small>
          <strong>{tree.startArea} m²</strong>
        </div>
        <div>
          <small>Target horizon</small>
          <strong>{year}</strong>
        </div>
      </div>
      <div className="forecast-metrics">
        <div>
          <span className="metric-kicker">Crown area / tree</span>
          <strong>{target.crown} m²</strong>
          <small>at {year}</small>
        </div>
        <div>
          <span className="metric-kicker">Crown radius</span>
          <strong>{result.radius} m</strong>
          <small>{(result.radius * 2).toFixed(1)} m diameter</small>
        </div>
        <div>
          <span className="metric-kicker">Annual growth</span>
          <strong>{(tree.growthRate * 100).toFixed(1)}%</strong>
          <small>recursive median</small>
        </div>
        <div className="confidence-card">
          <span className="metric-kicker">Prediction quality</span>
          <strong>
            <BadgeCheck size={18} />
            In domain
          </strong>
          <small>86% confidence band</small>
        </div>
      </div>
      <div className="model-charts">
        <section className="chart-card main-chart">
          <div className="chart-heading">
            <div>
              <h4>Projected crown growth</h4>
              <p>Per-tree crown area with uncertainty band</p>
            </div>
            <span className="chart-chip">m² / tree</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={growth}
                margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#18815d" stopOpacity={0.28} />
                    <stop
                      offset="100%"
                      stopColor="#18815d"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#dce7e2"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="year"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                />
                <ChartTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #d8e5df",
                    boxShadow: "0 10px 30px #23483c20",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#17805c"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="crown"
                  stroke="#137a57"
                  strokeWidth={3}
                  fill="url(#growthFill)"
                />
                <Area
                  type="monotone"
                  dataKey="reference"
                  stroke="#8aa7a0"
                  strokeDasharray="5 4"
                  strokeWidth={1.6}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i className="solid" />
              {tree.name}
            </span>
            <span>
              <i className="dashed" />
              Species median
            </span>
            <span>
              <i className="band" />
              Confidence band
            </span>
          </div>
        </section>
        <section className="chart-card contribution-chart">
          <div className="chart-heading">
            <div>
              <h4>Scenario contribution</h4>
              <p>Canopy added by planting volume</p>
            </div>
            <span className="chart-chip">{year}</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contribution}
                margin={{ top: 12, right: 2, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#dce7e2"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="trees"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62746f", fontSize: 11 }}
                />
                <ChartTooltip
                  cursor={{ fill: "#eaf4ef" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #d8e5df",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="canopy" fill="#42a879" radius={[7, 7, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="axis-note">Number of planted trees</div>
        </section>
      </div>
      <div className="model-footer">
        <div className="domain-card">
          <span className={tree.status === "Supported" ? "success" : "warning"}>
            {tree.status === "Supported" ? (
              <Check size={15} />
            ) : (
              <CircleAlert size={15} />
            )}{" "}
            {tree.status}
          </span>
          <div>
            <strong>Prediction within observed domain</strong>
            <small>Reference crown range: {tree.range}</small>
          </div>
        </div>
        <details className="advanced-model">
          <summary>
            <span>
              <Info size={15} />
              Advanced model notes
            </span>
            <ChevronDown size={16} />
          </summary>
          <p>
            Each yearly crown estimate becomes the starting state for the next
            time step. Species-specific growth rates are constrained to observed
            crown ranges; scenario totals are aggregated after per-tree
            inference. Demo values are precomputed for portfolio presentation.
          </p>
        </details>
      </div>
    </div>
  );
}

function HeatModelPanel({
  result,
  year,
  area,
}: {
  result: ReturnType<typeof calculateScenario>;
  year: 2035 | 2050;
  area: string;
}) {
  const climateCooling = (result.currentHeat - result.baselineHeat).toFixed(1);
  const totalCooling = (result.currentHeat - result.plantingHeat).toFixed(1);
  return (
    <div className="heat-model-panel">
      <div className="heat-model-hero">
        <div className="heat-model-icon">
          <ThermometerSun size={25} />
        </div>
        <div>
          <div className="heat-eyebrow">URBAN HEAT FORECAST ENGINE</div>
          <h3>Heat Prediction Model</h3>
          <p>
            Translates projected canopy change into area-level surface
            temperature outcomes for {area}.
          </p>
        </div>
        <span className="heat-model-status">
          <i />
          Prediction available
        </span>
      </div>
      <div className="heat-pathway">
        <div>
          <small>MODEL INPUT</small>
          <strong>+{result.canopyGain}% canopy</strong>
          <span>From the planting scenario</span>
        </div>
        <ArrowRight size={18} />
        <div>
          <small>CLIMATE BASELINE</small>
          <strong>{result.baselineHeat}°C</strong>
          <span>No-intervention · {year}</span>
        </div>
        <ArrowRight size={18} />
        <div className="pathway-result">
          <small>PREDICTED OUTCOME</small>
          <strong>{result.plantingHeat}°C</strong>
          <span>With planting · {year}</span>
        </div>
      </div>
      <section className="heat-comparison">
        <div className="block-heading">
          <span className="heading-icon red">
            <ThermometerSun size={17} />
          </span>
          <div>
            <h3>Surface temperature comparison</h3>
            <p>Current measurement, future baseline and intervention result</p>
          </div>
        </div>
        <div className="heat-triple">
          <ComparisonCard
            label="Current · 2024"
            value={`${result.currentHeat}°C`}
            sub="Observed summer peak"
            density={0}
            type="heat"
          />
          <ComparisonCard
            label={`No intervention · ${year}`}
            value={`${result.baselineHeat}°C`}
            sub={`−${climateCooling}°C from current`}
            density={0}
            type="heat"
          />
          <ComparisonCard
            label={`With planting · ${year}`}
            value={`${result.plantingHeat}°C`}
            sub={`−${totalCooling}°C from current`}
            density={0}
            type="heat"
            emphasis
            delta={`−${result.heatReduction}°C vs baseline`}
          />
        </div>
        <div className="heat-scale detailed">
          <span>25°C · cooler</span>
          <i />
          <span>45°C · hotter</span>
        </div>
      </section>
      <div className="heat-metric-grid">
        <div>
          <small>Baseline change</small>
          <strong>−{climateCooling}°C</strong>
          <span>Climate-adjusted change by {year}</span>
        </div>
        <div className="highlight">
          <small>Planting benefit</small>
          <strong>−{result.heatReduction}°C</strong>
          <span>Additional cooling from canopy</span>
        </div>
        <div>
          <small>Total change</small>
          <strong>−{totalCooling}°C</strong>
          <span>Current to planted scenario</span>
        </div>
      </div>
      <div className="heat-model-note">
        <Info size={15} />
        <p>
          <strong>How it works:</strong> the heat model receives the baseline
          temperature, target year and projected canopy coverage from Model B.
          It compares the no-intervention baseline with the planting scenario;
          values shown here are calibrated prototype outputs.
        </p>
      </div>
    </div>
  );
}

function SavedPlans({
  plans,
  onLoad,
  onDelete,
}: {
  plans: SavedScenario[];
  onLoad: (plan: SavedScenario) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="saved-plans-trigger">
          <FolderOpen size={16} />
          Saved plans<span>{plans.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="saved-plans-sheet">
        <SheetHeader>
          <div className="saved-sheet-icon">
            <Bookmark size={19} />
          </div>
          <SheetTitle>Saved planting scenarios</SheetTitle>
          <SheetDescription>
            Reopen a plan to continue testing its canopy and heat outcomes.
          </SheetDescription>
        </SheetHeader>
        <div className="saved-plan-list">
          {plans.length === 0 ? (
            <div className="saved-empty">
              <FolderOpen size={28} />
              <strong>No saved plans yet</strong>
              <p>Run a scenario, then select Save scenario.</p>
            </div>
          ) : (
            plans.map((plan) => {
              const tree = species.find((item) => item.id === plan.speciesId);
              const savedStreet = (streetCorridorsByArea[plan.area] ?? []).find(
                (item) => item.id === plan.streetId,
              );
              return (
                <article className="saved-plan-card" key={plan.id}>
                  <div className="saved-plan-top">
                    <div>
                      <small>
                        {plan.selectionMode === "clue"
                          ? "CLUE AREA"
                          : plan.selectionMode === "street"
                            ? "STREET CORRIDOR"
                            : "SUBURB"}
                      </small>
                      <h3>
                        {plan.selectionMode === "street" && savedStreet
                          ? savedStreet.name
                          : plan.area}{" "}
                        · {plan.year}
                      </h3>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${plan.area} plan`}
                      onClick={() => onDelete(plan.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p>
                    {plan.count} × {tree?.name ?? "trees"}
                  </p>
                  <div className="saved-plan-metrics">
                    <span>
                      <strong>{plan.canopy}%</strong>canopy
                    </span>
                    <span>
                      <strong>{plan.heat}°C</strong>surface temp.
                    </span>
                    <span>
                      <strong>−{plan.cooling}°C</strong>cooling
                    </span>
                  </div>
                  <div className="saved-plan-footer">
                    <time>
                      {new Date(plan.savedAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    <SheetClose asChild>
                      <Button size="sm" onClick={() => onLoad(plan)}>
                        Load plan <ArrowRight size={14} />
                      </Button>
                    </SheetClose>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VisualComparison({
  year,
  result,
  area,
}: {
  year: 2035 | 2050;
  result: ReturnType<typeof calculateScenario>;
  area: string;
}) {
  const cards = [
    {
      label: "Current · 2024",
      value: `${result.current}% canopy`,
      pos: "left",
    },
    {
      label: `No intervention · ${year}`,
      value: `${result.baseline}% canopy`,
      pos: "center",
    },
    {
      label: `With your planting · ${year}`,
      value: `${result.withPlanting}% canopy`,
      pos: "right",
    },
  ];
  return (
    <section className="visual-section">
      <div className="section-title-row">
        <div>
          <span className="heading-icon green">
            <Sparkles size={17} />
          </span>
          <div>
            <h2>See the street-level difference</h2>
            <p>The same {area} streetscape across three canopy futures</p>
          </div>
        </div>
        <span className="render-badge">Scenario visualisation</span>
      </div>
      <div className="visual-grid">
        {cards.map((card, index) => (
          <div className="street-card" key={card.label}>
            <div className={`street-image ${card.pos}`} />
            <div className="street-label">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
            {index < 2 && (
              <div className="street-arrow">
                <ArrowRight size={18} />
              </div>
            )}
          </div>
        ))}
        <aside className="quote-card">
          <Leaf size={26} />
          <blockquote>
            “Greener streets.
            <br />
            Cooler communities.
            <br />A brighter Melbourne.”
          </blockquote>
          <small>Shade 2050 planning vision</small>
        </aside>
      </div>
    </section>
  );
}

export default function Home() {
  const [area, setArea] = useState("Carlton"),
    [speciesId, setSpeciesId] = useState("river-red-gum"),
    [count, setCount] = useState(50),
    [year, setYear] = useState<2035 | 2050>(2050),
    [running, setRunning] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("suburb"),
    [clueAreaId, setClueAreaId] = useState("city-north"),
    [streetId, setStreetId] = useState(streetCorridorsByArea.Carlton[0].id);
  const [savedPlans, setSavedPlans] = useState<SavedScenario[]>([]),
    [justSaved, setJustSaved] = useState(false);
  const [lastRun, setLastRun] = useState({
    area,
    speciesId,
    count,
    year,
    selectionMode,
    clueAreaId,
    streetId,
    areaScale: 1,
  });
  const activeStreet =
    (streetCorridorsByArea[area] ?? []).find((item) => item.id === streetId) ??
    streetCorridorsByArea[area]?.[0];
  const lastStreet =
    (streetCorridorsByArea[lastRun.area] ?? []).find(
      (item) => item.id === lastRun.streetId,
    ) ?? streetCorridorsByArea[lastRun.area]?.[0];
  const activeTree = species.find((item) => item.id === lastRun.speciesId)!;
  const result = useMemo(
    () =>
      calculateScenario(
        lastRun.area,
        activeTree,
        lastRun.count,
        lastRun.year,
        lastRun.areaScale,
        lastRun.selectionMode === "street" && lastStreet
          ? { current: lastStreet.currentCanopy, heat: lastStreet.heat }
          : undefined,
      ),
    [lastRun, activeTree, lastStreet],
  );
  const resultLabel =
    lastRun.selectionMode === "street" && lastStreet
      ? lastStreet.name
      : lastRun.area;
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("shade2050-saved-scenarios");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<
          SavedScenario & { selectionMode: string }
        >;
        setSavedPlans(
          parsed.map((plan) => ({
            ...plan,
            selectionMode:
              plan.selectionMode === "draw"
                ? "suburb"
                : (plan.selectionMode as SelectionMode),
            streetId:
              plan.streetId ?? streetCorridorsByArea[plan.area]?.[0]?.id ?? "",
          })),
        );
      }
    } catch {
      /* Keep the planner usable when storage is unavailable. */
    }
  }, []);
  const persistPlans = (plans: SavedScenario[]) => {
    setSavedPlans(plans);
    try {
      window.localStorage.setItem(
        "shade2050-saved-scenarios",
        JSON.stringify(plans),
      );
    } catch {
      /* Saving remains optional in restricted browsers. */
    }
  };
  const chooseArea = (name: string) => {
    const firstStreet = streetCorridorsByArea[name]?.[0];
    setArea(name);
    setStreetId(firstStreet?.id ?? "");
    if (selectionMode === "street" && firstStreet)
      setCount((value) => Math.min(value, firstStreet.capacity));
  };
  const chooseMode = (mode: SelectionMode) => {
    setSelectionMode(mode);
    if (mode === "clue") {
      const clue = clueAreas.find((item) => item.id === clueAreaId);
      if (clue) chooseArea(clue.area);
    }
    if (mode === "street") {
      const firstStreet = streetCorridorsByArea[area]?.[0];
      setStreetId(firstStreet?.id ?? "");
      if (firstStreet)
        setCount((value) => Math.min(value, firstStreet.capacity));
    }
  };
  const chooseClueArea = (id: string) => {
    setClueAreaId(id);
    const clue = clueAreas.find((item) => item.id === id);
    if (clue) chooseArea(clue.area);
  };
  const chooseStreet = (id: string) => {
    setStreetId(id);
    const selected = (streetCorridorsByArea[area] ?? []).find(
      (item) => item.id === id,
    );
    if (selected) setCount((value) => Math.min(value, selected.capacity));
  };
  const run = () => {
    const maximum =
      selectionMode === "street" ? (activeStreet?.capacity ?? 500) : 500;
    const safeCount = Math.min(maximum, Math.max(1, count || 1));
    const areaScale =
      selectionMode === "street" ? (activeStreet?.areaScale ?? 1) : 1;
    setCount(safeCount);
    setRunning(true);
    window.setTimeout(() => {
      setLastRun({
        area,
        speciesId,
        count: safeCount,
        year,
        selectionMode,
        clueAreaId,
        streetId: activeStreet?.id ?? streetId,
        areaScale,
      });
      setRunning(false);
    }, 850);
  };
  const saveScenario = () => {
    const plan: SavedScenario = {
      id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      savedAt: new Date().toISOString(),
      area: lastRun.area,
      selectionMode: lastRun.selectionMode,
      clueAreaId: lastRun.clueAreaId,
      streetId: lastRun.streetId,
      speciesId: lastRun.speciesId,
      count: lastRun.count,
      year: lastRun.year,
      canopy: result.withPlanting,
      heat: result.plantingHeat,
      cooling: result.heatReduction,
      areaScale: lastRun.areaScale,
    };
    persistPlans([plan, ...savedPlans]);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  };
  const loadScenario = (plan: SavedScenario) => {
    const mode =
      plan.selectionMode === "street" ? "street" : plan.selectionMode;
    const loadedStreet =
      (streetCorridorsByArea[plan.area] ?? []).find(
        (item) => item.id === plan.streetId,
      ) ?? streetCorridorsByArea[plan.area]?.[0];
    const areaScale =
      mode === "street" ? (loadedStreet?.areaScale ?? plan.areaScale ?? 1) : 1;
    setArea(plan.area);
    setSpeciesId(plan.speciesId);
    setCount(plan.count);
    setYear(plan.year);
    setSelectionMode(mode);
    setClueAreaId(plan.clueAreaId);
    setStreetId(loadedStreet?.id ?? "");
    setLastRun({
      area: plan.area,
      speciesId: plan.speciesId,
      count: plan.count,
      year: plan.year,
      selectionMode: mode,
      clueAreaId: plan.clueAreaId,
      streetId: loadedStreet?.id ?? "",
      areaScale,
    });
  };
  const deleteScenario = (id: string) =>
    persistPlans(savedPlans.filter((plan) => plan.id !== id));
  return (
    <main className="app-shell">
      <SiteHeader active="scenario" />
      <div className="workspace" id="scenario">
        <ScenarioControls
          area={area}
          setArea={chooseArea}
          selectionMode={selectionMode}
          setSelectionMode={chooseMode}
          clueAreaId={clueAreaId}
          setClueAreaId={chooseClueArea}
          streetId={activeStreet?.id ?? streetId}
          setStreetId={chooseStreet}
          speciesId={speciesId}
          setSpeciesId={setSpeciesId}
          count={count}
          setCount={setCount}
          year={year}
          setYear={setYear}
          running={running}
          run={run}
        />
        <LiveMap
          area={area}
          count={count}
          selectionMode={selectionMode}
          streetId={activeStreet?.id ?? streetId}
        />
        <section className="results-panel" id="results">
          <div className="results-header">
            <div className="results-title">
              <span className="results-tree">
                <Trees size={24} />
              </span>
              <div>
                <h1>
                  {lastRun.selectionMode === "street" && lastStreet
                    ? `Street plan · ${lastStreet.name}`
                    : `Scenario results for ${lastRun.area}`}
                </h1>
                <p>
                  {lastRun.selectionMode === "street"
                    ? "Street-level planting capacity and forecast outcome"
                    : "Comparing no intervention with your planting plan"}
                </p>
              </div>
            </div>
            <div className="results-header-actions">
              <div className="area-facts">
                {lastRun.selectionMode === "street" && lastStreet ? (
                  <>
                    <span>
                      CORRIDOR<strong>{lastStreet.length} m</strong>
                    </span>
                    <span>
                      SITE CAPACITY<strong>{lastStreet.capacity} trees</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      ANALYSIS AREA
                      <strong>
                        {(result.analysisArea / 1000000).toFixed(2)} km²
                      </strong>
                    </span>
                    <span>
                      POPULATION
                      <strong>{baseByArea[lastRun.area].population}</strong>
                    </span>
                  </>
                )}
              </div>
              <div className="scenario-save-actions">
                <Button
                  className={`save-scenario-button ${justSaved ? "saved" : ""}`}
                  onClick={saveScenario}
                >
                  {justSaved ? (
                    <>
                      <Check size={16} />
                      Scenario saved
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save scenario
                    </>
                  )}
                </Button>
                <SavedPlans
                  plans={savedPlans}
                  onLoad={loadScenario}
                  onDelete={deleteScenario}
                />
              </div>
            </div>
          </div>
          <Tabs defaultValue="overview" className="results-tabs">
            <TabsList variant="line" className="results-tab-list">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="canopy">Canopy change</TabsTrigger>
              <TabsTrigger value="heat">
                <ThermometerSun size={14} />
                Heat model
              </TabsTrigger>
              <TabsTrigger value="model" className="model-tab">
                <BrainCircuit size={15} />
                Model B
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <OverviewPanel result={result} year={lastRun.year} />
            </TabsContent>
            <TabsContent value="canopy">
              <CanopyChangePanel
                result={result}
                year={lastRun.year}
                area={resultLabel}
              />
            </TabsContent>
            <TabsContent value="heat">
              <HeatModelPanel
                result={result}
                year={lastRun.year}
                area={resultLabel}
              />
            </TabsContent>
            <TabsContent value="model">
              <ModelBPanel
                tree={activeTree}
                count={lastRun.count}
                year={lastRun.year}
                result={result}
                area={resultLabel}
              />
            </TabsContent>
            <TabsContent value="details">
              <div className="details-grid">
                <div>
                  <Clock3 />
                  <h3>Forecast horizon</h3>
                  <p>
                    Annual recursive crown growth from 2026 to {lastRun.year}.
                  </p>
                </div>
                <div>
                  <BadgeCheck />
                  <h3>
                    {lastRun.selectionMode === "street"
                      ? "Corridor capacity"
                      : "Model domain"}
                  </h3>
                  <p>
                    {lastRun.selectionMode === "street" && lastStreet
                      ? `${lastStreet.capacity} feasible planting sites across ${lastStreet.length} metres.`
                      : `${activeTree.name} is evaluated against the ${activeTree.range} observed crown range.`}
                  </p>
                </div>
                <div>
                  <Info />
                  <h3>Saved planning record</h3>
                  <p>
                    Save this scenario to reopen its inputs, location, canopy
                    outcome and heat result later.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
      <VisualComparison
        year={lastRun.year}
        result={result}
        area={resultLabel}
      />
      <footer>
        <span>
          <Leaf size={15} />
          Shade 2050
        </span>
        <p>Decision support for a cooler, greener Melbourne.</p>
        <span>Portfolio prototype · 2026</span>
      </footer>
    </main>
  );
}
