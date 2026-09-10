import styles from "./DriverChart.module.css";
import type { Driver } from "../lib/predict";

interface Props {
  drivers: Driver[];
  disabled?: boolean;
}

export function DriverChart({ drivers, disabled = false }: Props) {
  const maxAbs = Math.max(1e-6, ...drivers.map((d) => Math.abs(d.logOdds)));

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>What moves this estimate</h3>

      {disabled ? (
        <p className={styles.disabledNote}>
          Not shown for the surgical arm — the estimate is the observed cohort rate, not a
          model output.
        </p>
      ) : (
        <>
          <ul className={styles.list}>
            {drivers.map((d) => {
              const w = (Math.abs(d.logOdds) / maxAbs) * 50;
              return (
                <li key={d.feature} className={styles.row}>
                  <div className={styles.label}>
                    <span className={styles.name}>{d.label}</span>
                    <span className={`${styles.val} num`}>{d.value}</span>
                  </div>
                  <div className={styles.track}>
                    <span className={styles.axis} />
                    {d.effect === "supports" ? (
                      <span className={styles.barUp} style={{ width: `${w}%` }} />
                    ) : d.effect === "against" ? (
                      <span className={styles.barDown} style={{ width: `${w}%` }} />
                    ) : (
                      <span className={styles.dot} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className={styles.caption}>
            <span>← lowers chance of success</span>
            <span>raises →</span>
          </div>
        </>
      )}
    </div>
  );
}
