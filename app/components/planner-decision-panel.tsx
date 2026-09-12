"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  DollarSign,
  Info,
  ThermometerSun,
  Trees,
  Wallet,
} from "lucide-react";
import styles from "./planner-decision-panel.module.css";

type Horizon = 2030 | 2035 | 2040 | 2045 | 2050;

type PlannerResult = {
  baseline: number;
  withPlanting: number;
  canopyGain: number;
  baselineHeat: number;
  plantingHeat: number;
  heatReduction: number;
  analysisArea: number;
  addedArea: number;
  perTree: number;
  empiricalTreeModel: {
    name: string;
    fitLevel: "species" | "citywide";
    sampleCount: number;
    rmseLog: number;
    minObservedAge: number;
    maxObservedAge: number;
  };
  empiricalHeatModel: {
    r2: number;
    treeCoverCoefficient: number;
  };
  officialData: {
    observedTreeCanopy2018: number;
    observedUhi2018: number;
  };
};

type Props = {
  area: string;
  count: number;
  year: Horizon;
  result: PlannerResult;
};

type CostProfile = {
  id: string;
  label: string;
  cost: number;
  detail: string;
};

type SiteWorks = {
  id: string;
  label: string;
  low: number;
  high: number;
  annualMaintenance: number;
};

const COST_PROFILES: CostProfile[] = [
  {
    id: "paved45",
    label: "45L tree · paved area",
    cost: 1597,
    detail: "Stock, delivery, planting, concrete cutting, soil and establishment maintenance",
  },
  {
    id: "paved100",
    label: "100L tree · paved area",
    cost: 1799,
    detail: "Larger stock with paved-area establishment allowance",
  },
  {
    id: "permeable45",
    label: "45L tree · permeable pavement",
    cost: 2297,
    detail: "Includes permeable-pavement allowance in the council benchmark",
  },
  {
    id: "permeable100",
    label: "100L tree · permeable pavement",
    cost: 2499,
    detail: "Larger stock plus permeable-pavement allowance",
  },
];

const SITE_WORKS: SiteWorks[] = [
  { id: "none", label: "No extra WSUD site works", low: 0, high: 0, annualMaintenance: 0 },
  { id: "kerb", label: "Simple passive kerb cut", low: 750, high: 1500, annualMaintenance: 150 },
  { id: "trench", label: "Infiltration trench", low: 1000, high: 2000, annualMaintenance: 150 },
  { id: "road", label: "In-road flush planting", low: 2000, high: 4000, annualMaintenance: 150 },
  { id: "outstand", label: "Kerb outstand", low: 3000, high: 5000, annualMaintenance: 150 },
  { id: "grill", label: "In-footpath tree grill", low: 3000, high: 8000, annualMaintenance: 150 },
  { id: "pit", label: "Expanded tree pit under paving", low: 6000, high: 10000, annualMaintenance: 150 },
];

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function pct(value: number) {
  return value.toFixed(2) + "%";
}

function temp(value: number) {
  return value.toFixed(2) + "°C";
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

export function PlannerDecisionPanel({ area, count, year, result }: Props) {
  const [profileId, setProfileId] = useState("paved45");
  const [siteWorksId, setSiteWorksId] = useState("none");
  const [budget, setBudget] = useState(1000000);
  const [realisation, setRealisation] = useState(80);

  const profile = COST_PROFILES.find((item) => item.id === profileId) ?? COST_PROFILES[0];
  const siteWorks = SITE_WORKS.find((item) => item.id === siteWorksId) ?? SITE_WORKS[0];

  const planning = useMemo(() => {
    const unitLow = profile.cost + siteWorks.low;
    const unitHigh = profile.cost + siteWorks.high;
    const unitMid = (unitLow + unitHigh) / 2;
    const totalLow = unitLow * count;
    const totalHigh = unitHigh * count;
    const totalMid = unitMid * count;
    const yearsToTarget = Math.max(1, year - 2026);
    const annualCapital = totalMid / yearsToTarget;
    const annualMaintenance = siteWorks.annualMaintenance * count;
    const costPerCanopyPoint = totalMid / Math.max(0.01, Math.abs(result.canopyGain));
    const costPerPointOneUhi = totalMid / Math.max(0.01, Math.abs(result.heatReduction) / 0.1);
    const costPerAddedHectare = totalMid / Math.max(0.01, result.addedArea / 10000);
    const budgetTreeCapacity = Math.max(0, Math.floor(budget / Math.max(1, unitMid)));
    const fundingGap = totalMid - budget;
    const budgetCoverage = totalMid > 0 ? Math.min(100, (budget / totalMid) * 100) : 100;

    const z80 = 1.2815515655446004;
    const lowerPerTree = result.perTree * Math.exp(-z80 * result.empiricalTreeModel.rmseLog);
    const upperPerTree = result.perTree * Math.exp(z80 * result.empiricalTreeModel.rmseLog);
    const maxGain = Math.max(0, 100 - result.baseline);
    const lowerGain = Math.max(
      0,
      Math.min(maxGain, (lowerPerTree * count * 100) / Math.max(1, result.analysisArea)),
    );
    const upperGain = Math.max(
      0,
      Math.min(maxGain, (upperPerTree * count * 100) / Math.max(1, result.analysisArea)),
    );
    const canopyLow = result.baseline + lowerGain;
    const canopyHigh = result.baseline + upperGain;
    const heatA =
      result.baselineHeat +
      result.empiricalHeatModel.treeCoverCoefficient * (canopyLow - result.baseline);
    const heatB =
      result.baselineHeat +
      result.empiricalHeatModel.treeCoverCoefficient * (canopyHigh - result.baseline);
    const heatLow = Math.min(heatA, heatB);
    const heatHigh = Math.max(heatA, heatB);

    const stressedCanopy = result.baseline + result.canopyGain * (realisation / 100);
    const stressedHeat = result.baselineHeat - result.heatReduction * (realisation / 100);
    const targetTreeAge = year - 2026 + 1;
    const extrapolated =
      targetTreeAge < result.empiricalTreeModel.minObservedAge ||
      targetTreeAge > result.empiricalTreeModel.maxObservedAge;

    return {
      unitLow,
      unitHigh,
      unitMid,
      totalLow,
      totalHigh,
      totalMid,
      annualCapital,
      annualMaintenance,
      costPerCanopyPoint,
      costPerPointOneUhi,
      costPerAddedHectare,
      budgetTreeCapacity,
      fundingGap,
      budgetCoverage,
      canopyLow,
      canopyHigh,
      heatLow,
      heatHigh,
      stressedCanopy,
      stressedHeat,
      targetTreeAge,
      extrapolated,
    };
  }, [budget, count, profile, realisation, result, siteWorks, year]);

  return (
    <section className={styles.shell} aria-label="Urban planner decision support">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>URBAN PLANNER DECISION VIEW</span>
          <h2>Scenario, delivery cost and model evidence</h2>
          <p>
            Compare policy outcomes and translate the planting scenario into an indicative capital envelope for {area}.
          </p>
        </div>
        <div className={styles.horizonBadge}>{year} horizon</div>
      </div>

      <div className={styles.scenarioGrid}>
        <article className={styles.scenarioCard}>
          <span className={styles.scenarioKicker}>BAU · no intervention</span>
          <strong>{pct(result.baseline)} canopy</strong>
          <b>{temp(result.baselineHeat)} UHI</b>
          <small>$0 incremental planting program</small>
        </article>
        <article className={styles.scenarioCardStrong}>
          <span className={styles.scenarioKicker}>STRATEGY · requested plan</span>
          <strong>{pct(result.withPlanting)} canopy</strong>
          <b>{temp(result.plantingHeat)} UHI</b>
          <small>
            80% residual band: {pct(planning.canopyLow)}–{pct(planning.canopyHigh)} canopy
          </small>
        </article>
        <article className={styles.scenarioCard}>
          <span className={styles.scenarioKicker}>STRESSED · policy sensitivity</span>
          <strong>{pct(planning.stressedCanopy)} canopy</strong>
          <b>{temp(planning.stressedHeat)} UHI</b>
          <small>{realisation}% of modelled planting benefit realised</small>
          <input
            className={styles.range}
            aria-label="Stressed scenario benefit realisation"
            type="range"
            min="40"
            max="100"
            step="5"
            value={realisation}
            onChange={(event) => setRealisation(Number(event.target.value))}
          />
        </article>
      </div>

      <div className={styles.scenarioNote}>
        <Info size={15} />
        <span>
          Scenario spread is a policy sensitivity, not statistical uncertainty. The 80% band comes only from empirical crown-model residual error; backtest error is not yet available in this repository.
        </span>
      </div>

      <div className={styles.costLayout}>
        <div className={styles.costControls}>
          <div className={styles.sectionTitle}>
            <DollarSign size={19} />
            <div>
              <strong>Indicative delivery cost</strong>
              <span>Victorian council planning benchmarks · editable assumptions</span>
            </div>
          </div>

          <label>
            Base tree delivery benchmark
            <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              {COST_PROFILES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {money.format(item.cost)}/tree
                </option>
              ))}
            </select>
          </label>
          <p className={styles.controlHelp}>{profile.detail}</p>

          <label>
            Optional passive irrigation / site works
            <select value={siteWorksId} onChange={(event) => setSiteWorksId(event.target.value)}>
              {SITE_WORKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.high > 0 ? " · " + money.format(item.low) + "–" + money.format(item.high) : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Available capital budget
            <div className={styles.budgetInput}>
              <span>A$</span>
              <input
                type="number"
                min="0"
                step="50000"
                value={budget}
                onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
          </label>
        </div>

        <div className={styles.costHero}>
          <span>INDICATIVE PROGRAM CAPITAL</span>
          <strong>
            {money.format(planning.totalLow)} – {money.format(planning.totalHigh)}
          </strong>
          <p>
            {count} trees · {money.format(planning.unitLow)}–{money.format(planning.unitHigh)} per delivered site
          </p>
          <div className={styles.budgetBar}>
            <i style={{ width: String(planning.budgetCoverage) + "%" }} />
          </div>
          <div className={styles.budgetSummary}>
            <span>
              Budget funds about <strong>{planning.budgetTreeCapacity} trees</strong> at midpoint cost
            </span>
            <span className={planning.fundingGap > 0 ? styles.gap : styles.headroom}>
              {planning.fundingGap > 0
                ? money.format(planning.fundingGap) + " funding gap"
                : money.format(Math.abs(planning.fundingGap)) + " headroom"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <Metric
          label="Average annual capital"
          value={money.format(planning.annualCapital)}
          sub="Midpoint capital spread across years to target"
        />
        <Metric
          label="Cost per +1pp canopy"
          value={money.format(planning.costPerCanopyPoint)}
          sub="Incremental percentage point versus BAU"
        />
        <Metric
          label="Cost per 0.1°C UHI reduction"
          value={money.format(planning.costPerPointOneUhi)}
          sub="Modelled marginal cooling efficiency"
        />
        <Metric
          label="Cost per added canopy hectare"
          value={money.format(planning.costPerAddedHectare)}
          sub="Based on modelled added crown area"
        />
      </div>

      {planning.annualMaintenance > 0 && (
        <div className={styles.maintenanceRow}>
          <Wallet size={16} />
          <span>
            Passive-irrigation maintenance benchmark: <strong>{money.format(planning.annualMaintenance)}/year</strong>, shown separately from capital.
          </span>
        </div>
      )}

      <div className={styles.evidenceGrid}>
        <div className={styles.evidenceCard}>
          <div className={styles.sectionTitle}>
            <Trees size={19} />
            <div>
              <strong>Model evidence</strong>
              <span>What is actually supported by the current repo</span>
            </div>
          </div>
          <div className={styles.statusRow}>
            <Check size={15} />
            <span>
              Crown model: {result.empiricalTreeModel.sampleCount.toLocaleString()} samples · {result.empiricalTreeModel.fitLevel} fit
            </span>
          </div>
          <div className={styles.statusRow}>
            <Check size={15} />
            <span>UHI model: official 2018 fit · R² {result.empiricalHeatModel.r2.toFixed(3)}</span>
          </div>
          <div className={planning.extrapolated ? styles.warningRow : styles.statusRow}>
            {planning.extrapolated ? <AlertTriangle size={15} /> : <Check size={15} />}
            <span>
              Target tree age {planning.targetTreeAge}; observed model age domain {result.empiricalTreeModel.minObservedAge}–{result.empiricalTreeModel.maxObservedAge}
              {planning.extrapolated ? " · extrapolated" : " · in observed domain"}
            </span>
          </div>
        </div>

        <div className={styles.evidenceCard}>
          <div className={styles.sectionTitle}>
            <ThermometerSun size={19} />
            <div>
              <strong>Review readiness</strong>
              <span>Items not fabricated when source artefacts are absent</span>
            </div>
          </div>
          <div className={styles.pendingRow}>
            <AlertTriangle size={15} />
            <span>Asymptotic crown curve beyond observed age ceiling · pending crown_curves.json</span>
          </div>
          <div className={styles.pendingRow}>
            <AlertTriangle size={15} />
            <span>≤2019 → 2021 per-suburb backtest · pending reproducible capture pipeline</span>
          </div>
          <div className={styles.pendingRow}>
            <AlertTriangle size={15} />
            <span>10 m grid heat-placement layer · pending shadenet grid pipeline inputs</span>
          </div>
          <div className={styles.pendingRow}>
            <AlertTriangle size={15} />
            <span>Private-canopy + attrition reconciliation across independent captures · pending</span>
          </div>
        </div>
      </div>

      <div className={styles.sourceNote}>
        <Info size={15} />
        <span>
          Cost basis: City of Greater Dandenong urban-tree cost benchmark for base planting, plus Hobsons Bay Canopy Delivery Plan ranges for optional passive irrigation / WSUD. RMIT notes established-street trees can easily cost about A$2,000 each. Values are nominal source benchmarks, not indexed to 2026, not a City of Melbourne tender quote, and overlapping civil works should be de-duplicated by a project quantity surveyor.
        </span>
      </div>
    </section>
  );
}
