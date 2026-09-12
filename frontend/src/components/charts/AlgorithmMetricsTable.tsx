import styles from "./AlgorithmMetricsTable.module.css";
import { LEADERBOARD_FULL } from "../../data/findings";

/**
 * Full metric breakdown per algorithm: ROC-AUC, accuracy, sensitivity,
 * specificity, F1 — the same repeated stratified 5-fold CV (20 repeats)
 * behind every other number in this section. Complements the ROC-AUC-only
 * bar chart above with the numbers that chart can't show at a glance.
 */
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function AlgorithmMetricsTable() {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.modelCol}>Algorithm</th>
            <th>ROC-AUC</th>
            <th>Accuracy</th>
            <th>Sensitivity</th>
            <th>Specificity</th>
            <th>F1</th>
          </tr>
        </thead>
        <tbody>
          {LEADERBOARD_FULL.map((r) => (
            <tr key={r.key} className={r.deployed ? styles.deployed : undefined}>
              <td className={styles.modelCol}>{r.model}</td>
              <td>
                {r.auc.mean.toFixed(3)}
                <span className={styles.sd}> ± {r.auc.sd.toFixed(3)}</span>
              </td>
              <td>
                {pct(r.accuracy.mean)}
                <span className={styles.sd}> ± {Math.round(r.accuracy.sd * 100)}pp</span>
              </td>
              <td>
                {pct(r.sensitivity.mean)}
                <span className={styles.sd}> ± {Math.round(r.sensitivity.sd * 100)}pp</span>
              </td>
              <td>
                {pct(r.specificity.mean)}
                <span className={styles.sd}> ± {Math.round(r.specificity.sd * 100)}pp</span>
              </td>
              <td>
                {r.f1.mean.toFixed(3)}
                <span className={styles.sd}> ± {r.f1.sd.toFixed(3)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
