import styles from "./ReportCard.module.css";
import type { Prediction } from "../lib/predict";
import { MODEL, groupLabel, type SuccessBand } from "../lib/model";
import { pct, pct1 } from "../lib/format";
import { SuccessGauge } from "./RiskGauge";
import { DriverChart } from "./DriverChart";
import { ProtocolTable } from "./ProtocolTable";

const BAND_CLASS: Record<SuccessBand, string> = {
  Likely: styles.bandGood,
  Uncertain: styles.bandWarn,
  Unlikely: styles.bandPoor,
};
const BAND_WORD: Record<SuccessBand, string> = {
  Likely: "likely to succeed",
  Uncertain: "uncertain",
  Unlikely: "unlikely to succeed",
};

export function ReportCard({ prediction }: { prediction: Prediction }) {
  const { probability: p, band, group, observedOnly } = prediction;
  const observed = MODEL.protocol_observed[group];

  const readout = observedOnly
    ? `Every dog in the cohort treated surgically (G4) resolved by day 14 (${observed.n}/${observed.n}). ` +
      `The model cannot estimate surgical risk from data with no failures, so the figure shown is the observed rate.`
    : band === "Likely"
      ? `The model estimates a ${pct(p)} chance that ${groupLabel(group)} resolves this case by day 14. ` +
        `For comparison, this protocol succeeded in ${pct1(observed.success_rate)} of the ${observed.n} cohort dogs that received it.`
      : band === "Uncertain"
        ? `The estimate (${pct(p)}) sits in the uncertain range. Consider close follow-up and early escalation, ` +
          `or a protocol with stronger cohort performance.`
        : `A low estimate (${pct(p)}) — the admission picture points away from success on ${groupLabel(group)}. ` +
          `Weigh escalation or surgery.`;

  return (
    <section className={styles.card}>
      <div className={styles.verdict}>
        <div>
          <p className={styles.forProtocol}>{groupLabel(group)}</p>
          <div className={styles.big}>{pct(p)}</div>
          <p className={styles.sub}>
            predicted chance of treatment success by day 14
            <br />
            <span className={styles.subFaint}>chance of failure ≈ {pct(1 - p)}</span>
          </p>
        </div>
        <span className={`${styles.band} ${BAND_CLASS[band]}`}>{BAND_WORD[band]}</span>
      </div>

      {observedOnly ? <p className={styles.caveat}>{MODEL.g4_caveat}</p> : null}

      <SuccessGauge probability={p} />

      <DriverChart drivers={prediction.drivers} disabled={observedOnly} />

      <ProtocolTable selected={group} />

      <p className={styles.readout}>{readout}</p>

      <div className={`${styles.actions} no-print`}>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          Print result
        </button>
        <span className={styles.date}>{new Date().toLocaleDateString()}</span>
      </div>

      <p className={styles.note}>
        {MODEL.disclaimer} Model discrimination ROC-AUC ≈ {MODEL.performance.roc_auc_cv} ±{" "}
        {MODEL.performance.roc_auc_cv_sd} (repeated stratified 5-fold cross-validation).
      </p>
    </section>
  );
}
