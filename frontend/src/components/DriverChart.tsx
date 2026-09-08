import styles from "./DriverChart.module.css";
import type { Driver } from "../lib/predict";

/** Diverging bars: each driver's contribution to the linear predictor. */
export function DriverChart({ drivers }: { drivers: Driver[] }) {
  const maxAbs = Math.max(1e-9, ...drivers.map((d) => Math.abs(d.logOdds)));

  return (
    <div className={styles.wrap}>
      <p className={`eyebrow ${styles.title}`}>What moves this estimate</p>

      <ul className={styles.list}>
        {drivers.map((d) => {
          const len = (Math.abs(d.logOdds) / maxAbs) * 50;
          const raises = d.direction === "raises";
          return (
            <li
              key={d.feature}
              className={styles.row}
              aria-label={`${d.label}, entered value ${d.value}, ${d.direction} risk`}
            >
              <div className={styles.label}>
                <span className={styles.name} title={d.label}>
                  {d.label}
                </span>
                <span className={`${styles.val} mono`}>{d.value}</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <span className={styles.axis} />
                <span
                  className={raises ? styles.barUp : styles.barDown}
                  style={{ width: `${len}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className={styles.captionRow} aria-hidden="true">
        <div />
        <div className={`${styles.caption} mono`}>
          <span>&larr; lowers risk</span>
          <span>raises risk &rarr;</span>
        </div>
      </div>
    </div>
  );
}
