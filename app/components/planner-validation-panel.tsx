"use client";

import { BadgeCheck, CircleAlert, MapPin, Trees } from "lucide-react";
import styles from "./planner-validation-panel.module.css";

type ValidationSummary = {
  n: number;
  mape: number | null;
  medianApe: number | null;
  meanObservedCrownM2: number | null;
  meanPredictedCrownM2: number | null;
};

type GridCell = {
  id: string;
  lat: number;
  lon: number;
  streetName: string;
  plantingSchedule: string | null;
  meshBlockCode: string;
  uhi2018: number;
  treeCover2018: number;
  hvi2018: number | null;
  nearestInventoryTreeM: number | null;
  priorityScore: number;
};

type Props = {
  area: string;
  result: {
    matureCrownEvidence: {
      p80CrownAreaM2: number;
      sampleCount: number;
      fitLevel: string;
      observationYear: number;
    } | null;
    canopyDynamics: {
      observedTreeCanopy2018: number;
      observedTreeCanopy2021: number;
      managedPublicCanopy2018: number;
      inventoryAssociatedCanopy2021: number;
      nonInventoryCanopy2018: number;
      nonInventoryCanopy2021: number;
      totalTrendPctPointPerYear: number;
      publicCanopyPersistence2018to2021: number | null;
      estimatedTreeCanopy2026: number;
      note: string;
    } | null;
    modelValidation: {
      overall: ValidationSummary;
      area: ValidationSummary | null;
      kpiMapePct: number;
      method: string;
    };
    planningGrid: GridCell[];
  };
};

function fmt(value: number | null, digits = 1) {
  return value === null ? "—" : value.toFixed(digits);
}

export function PlannerValidationPanel({ area, result }: Props) {
  const areaValidation = result.modelValidation.area;
  const topCells = result.planningGrid.slice(0, 8);
  const pass =
    areaValidation?.mape !== null &&
    areaValidation?.mape !== undefined &&
    areaValidation.mape <= result.modelValidation.kpiMapePct;

  return (
    <section className={styles.shell} aria-label="Empirical validation and planting candidates">
      <div className={styles.heading}>
        <div>
          <span>EMPIRICAL VALIDATION + DELIVERY LOCATION</span>
          <h2>What the model can now defend with observed data</h2>
          <p>
            Mature-crown calibration, independent 2021 validation, observed canopy dynamics and ranked 10 m planting candidates for {area}.
          </p>
        </div>
      </div>

      <div className={styles.metrics}>
        <article>
          <Trees size={18} />
          <span>Mature crown plateau</span>
          <strong>{result.matureCrownEvidence ? `${result.matureCrownEvidence.p80CrownAreaM2.toFixed(1)} m²` : "—"}</strong>
          <small>
            {result.matureCrownEvidence
              ? `${result.matureCrownEvidence.sampleCount.toLocaleString()} mature-tree observations · ${result.matureCrownEvidence.fitLevel}`
              : "No mature-tree evidence available"}
          </small>
        </article>
        <article>
          {pass ? <BadgeCheck size={18} /> : <CircleAlert size={18} />}
          <span>2021 crown backtest</span>
          <strong>{areaValidation?.mape == null ? "—" : `${areaValidation.mape.toFixed(1)}% MAPE`}</strong>
          <small>
            {areaValidation
              ? `${areaValidation.n} held-out observations · KPI ≤ ${result.modelValidation.kpiMapePct}%`
              : "No held-out observations in this area"}
          </small>
        </article>
        <article>
          <Trees size={18} />
          <span>Observed canopy change</span>
          <strong>
            {result.canopyDynamics
              ? `${result.canopyDynamics.observedTreeCanopy2018.toFixed(1)}% → ${result.canopyDynamics.observedTreeCanopy2021.toFixed(1)}%`
              : "—"}
          </strong>
          <small>
            {result.canopyDynamics
              ? `${result.canopyDynamics.totalTrendPctPointPerYear >= 0 ? "+" : ""}${result.canopyDynamics.totalTrendPctPointPerYear.toFixed(2)} pp/year observed 2018–2021`
              : "No 2021 canopy observation available"}
          </small>
        </article>
        <article>
          <BadgeCheck size={18} />
          <span>10 m planting candidates</span>
          <strong>{result.planningGrid.length}</strong>
          <small>Top ranked cells retained per suburb from official planting-schedule geometry</small>
        </article>
      </div>

      {result.canopyDynamics && (
        <div className={styles.dynamics}>
          <div>
            <span>Managed/public proxy</span>
            <strong>
              {result.canopyDynamics.managedPublicCanopy2018.toFixed(1)}% → {result.canopyDynamics.inventoryAssociatedCanopy2021.toFixed(1)}%
            </strong>
          </div>
          <div>
            <span>Non-inventory canopy proxy</span>
            <strong>
              {result.canopyDynamics.nonInventoryCanopy2018.toFixed(1)}% → {result.canopyDynamics.nonInventoryCanopy2021.toFixed(1)}%
            </strong>
          </div>
          <div>
            <span>2018 public-canopy persistence</span>
            <strong>
              {result.canopyDynamics.publicCanopyPersistence2018to2021 == null
                ? "—"
                : `${(result.canopyDynamics.publicCanopyPersistence2018to2021 * 100).toFixed(1)}%`}
            </strong>
          </div>
          <div>
            <span>2026 canopy anchor</span>
            <strong>{result.canopyDynamics.estimatedTreeCanopy2026.toFixed(1)}%</strong>
          </div>
        </div>
      )}

      <div className={styles.note}>
        <CircleAlert size={15} />
        <span>
          “Non-inventory canopy” is a measurable proxy, not a cadastral claim that the canopy is privately owned. The model does not infer land ownership from imagery alone.
        </span>
      </div>

      <div className={styles.gridHeader}>
        <div>
          <h3>Highest-priority 10 m planting candidates</h3>
          <p>Ranked from official MMB heat, tree-cover deficit and HVI, restricted to City planting-schedule geometry.</p>
        </div>
      </div>

      <div className={styles.gridList}>
        {topCells.length === 0 ? (
          <div className={styles.empty}>No verified planting-schedule candidate cells were generated for this area.</div>
        ) : (
          topCells.map((cell, index) => (
            <article key={cell.id} className={styles.gridRow}>
              <div className={styles.rank}>#{index + 1}</div>
              <div className={styles.street}>
                <MapPin size={15} />
                <div>
                  <strong>{cell.streetName || "Scheduled planting segment"}</strong>
                  <span>{cell.plantingSchedule || "Official planting schedule"}</span>
                </div>
              </div>
              <div>
                <span>Priority</span>
                <strong>{cell.priorityScore}/100</strong>
              </div>
              <div>
                <span>UHI 2018</span>
                <strong>{cell.uhi2018.toFixed(1)}°C</strong>
              </div>
              <div>
                <span>Tree cover</span>
                <strong>{cell.treeCover2018.toFixed(1)}%</strong>
              </div>
              <div>
                <span>HVI</span>
                <strong>{fmt(cell.hvi2018, 0)}</strong>
              </div>
              <div>
                <span>Nearest inventory tree</span>
                <strong>{cell.nearestInventoryTreeM == null ? ">35 m" : `${cell.nearestInventoryTreeM.toFixed(1)} m`}</strong>
              </div>
            </article>
          ))
        )}
      </div>

      <div className={styles.footerNote}>
        Backtest method: {result.modelValidation.method}. Candidate cells are decision-support candidates, not final engineering approval; utilities, soil volume, sightlines and underground services still require site investigation.
      </div>
    </section>
  );
}
