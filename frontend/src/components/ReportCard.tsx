import styles from "./ReportCard.module.css";
import type { Prediction } from "../lib/predict";
import { protocolContext } from "../lib/predict";
import { MODEL, groupLabel, type Band } from "../lib/model";
import { pct, pct1 } from "../lib/format";
import { RiskGauge } from "./RiskGauge";
import { DriverChart } from "./DriverChart";
import { ProtocolTable } from "./ProtocolTable";

const BAND_CLASS: Record<Band, string> = {
  Low: styles.chipLow,
  Intermediate: styles.chipMid,
  High: styles.chipHigh,
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function ReportCard({ prediction }: { prediction: Prediction }) {
  const { probability: p, band } = prediction;
  const stat = MODEL.risk_bands.table[band];
  const rate = stat.observed_failure_rate;

  const bandFact =
    rate === 0
      ? "No study dog in this band failed medical management."
      : `${Math.round(rate * stat.n)} of ${stat.n} study dogs in this band failed medical ` +
        `management (${pct1(rate)}).`;

  let advice: string;
  if (band === "High") {
    const better = protocolContext("High")
      .filter((r) => r.success_rate >= 0.5)
      .map((r) => groupLabel(r.group));
    advice =
      better.length > 0
        ? `${joinList(better)} did markedly better than the other protocols.`
        : "No protocol performed clearly better in this band.";
  } else if (band === "Intermediate") {
    advice =
      "An active medical protocol (G2 or G3) with close follow-up is reasonable; escalate early " +
      "if the dog does not improve.";
  } else {
    advice =
      "Medical management is expected to succeed; protocol choice can follow clinician and owner " +
      "preference.";
  }

  return (
    <div className={styles.card}>
      <div className={styles.verdict}>
        <span className={`${styles.chip} ${BAND_CLASS[band]}`}>{band} risk</span>
        <div className={`${styles.big} mono`}>{pct(p)}</div>
        <div className={styles.vcaption}>
          <div>probability medical management fails by day 14</div>
          <div>chance of success &asymp; {pct(1 - p)}</div>
        </div>
      </div>

      <hr className={styles.rule} />
      <RiskGauge probability={p} />

      <hr className={styles.rule} />
      <DriverChart drivers={prediction.drivers} />

      <hr className={styles.rule} />
      <ProtocolTable band={band} />

      <hr className={styles.rule} />
      <p className={styles.readout}>
        {pct(p)} estimated risk of medical-treatment failure &mdash; {band.toLowerCase()}. {bandFact}{" "}
        {advice}
      </p>

      <div className={`${styles.actions} no-print`}>
        <button type="button" className="pill" onClick={() => window.print()}>
          Print case card
        </button>
        <span className={`${styles.date} mono`}>{new Date().toLocaleDateString()}</span>
      </div>

      <p className={styles.note}>
        {MODEL.disclaimer} Model discrimination ROC-AUC &asymp; {MODEL.performance.roc_auc_cv}{" "}
        (internal cross-validation).
      </p>
    </div>
  );
}
