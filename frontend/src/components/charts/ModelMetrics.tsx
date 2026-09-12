import styles from "./ModelMetrics.module.css";
import { ROC_CURVE, TREATMENT_METRICS } from "../../data/findings";

/**
 * Stat tiles (ROC-AUC, accuracy, sensitivity, specificity, F1) plus the ROC
 * curve they're drawn from — one clean out-of-fold pass under repeated
 * stratified 5-fold cross-validation (20 repeats) on the deployed design.
 */
const fmt = (r: { mean: number; sd: number; pct: boolean }): string =>
  r.pct ? `${Math.round(r.mean * 100)}%` : r.mean.toFixed(3);
const fmtSd = (r: { mean: number; sd: number; pct: boolean }): string =>
  r.pct ? `± ${Math.round(r.sd * 100)} pp` : `± ${r.sd.toFixed(3)}`;

const VB = 220;
const PAD_L = 34;
const PAD_B = 26;
const PLOT = VB - PAD_L - 10;
const x = (fpr: number) => PAD_L + fpr * PLOT;
const y = (tpr: number) => VB - PAD_B - tpr * PLOT;

const path = ROC_CURVE.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.fpr)},${y(p.tpr)}`).join(" ");

export function ModelMetrics() {
  return (
    <div className={styles.wrap}>
      <div className={styles.tiles}>
        {TREATMENT_METRICS.map((m) => (
          <div key={m.key} className={styles.tile}>
            <div className={styles.tileLabel}>{m.label}</div>
            <div className={styles.tileValue}>{fmt(m)}</div>
            <div className={styles.tileSd}>{fmtSd(m)}</div>
          </div>
        ))}
      </div>

      <div className={styles.rocRow}>
        <svg
          className={styles.roc}
          viewBox={`0 0 ${VB} ${VB}`}
          role="img"
          aria-label="ROC curve, out-of-fold predictions, repeated stratified cross-validation"
        >
          {/* axes */}
          <line x1={PAD_L} y1={VB - PAD_B} x2={VB - 10} y2={VB - PAD_B} stroke="var(--line-2)" strokeWidth={1} />
          <line x1={PAD_L} y1={10} x2={PAD_L} y2={VB - PAD_B} stroke="var(--line-2)" strokeWidth={1} />
          {[0, 0.5, 1].map((t) => (
            <text key={`x${t}`} x={x(t)} y={VB - PAD_B + 14} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
              {t}
            </text>
          ))}
          {[0, 0.5, 1].map((t) => (
            <text key={`y${t}`} x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--ink-3)">
              {t}
            </text>
          ))}
          <text
            x={(PAD_L + VB - 10) / 2}
            y={VB - 2}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--ink-3)"
          >
            False-positive rate
          </text>
          <text
            x={-VB / 2}
            y={11}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--ink-3)"
            transform="rotate(-90)"
          >
            True-positive rate
          </text>

          {/* chance line */}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* ROC curve */}
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          <path
            d={`${path} L${x(1)},${y(0)} L${x(0)},${y(0)} Z`}
            fill="var(--accent)"
            opacity={0.08}
          />
        </svg>
        <p className={styles.rocNote}>
          Curve traces one complete out-of-fold pass (every dog scored by a model that never
          trained on it) at every probability threshold. The dashed line is chance
          (AUC&nbsp;0.5); the model scores AUC&nbsp;{TREATMENT_METRICS[0].mean.toFixed(3)}. The
          tiles use a single 0.5 threshold, averaged across CV folds &mdash; specificity carries
          the widest interval because only 14 of 80 dogs failed treatment.
        </p>
      </div>
    </div>
  );
}
