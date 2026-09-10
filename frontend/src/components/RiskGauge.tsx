import styles from "./RiskGauge.module.css";
import { MODEL } from "../lib/model";
import { clamp } from "../lib/format";

/** Horizontal 0–100% bar for a SUCCESS probability: red (low) → amber → green. */
export function SuccessGauge({ probability }: { probability: number }) {
  const [lo, hi] = MODEL.success_bands.cutpoints_prob;
  const pin = clamp(probability * 100, 1.5, 98.5);
  const ticks = [0, lo * 100, hi * 100, 100];

  return (
    <div
      className={styles.wrap}
      role="img"
      aria-label={`Predicted success ${Math.round(probability * 100)} percent`}
    >
      <div
        className={styles.bar}
        style={{
          ["--lo" as string]: `${lo * 100}%`,
          ["--hi" as string]: `${hi * 100}%`,
        }}
      >
        <span className={styles.needle} style={{ left: `${pin}%` }} />
      </div>
      <div className={styles.ticks}>
        {ticks.map((t, i) => (
          <span
            key={t}
            className={styles.tick}
            style={{
              left: `${t}%`,
              transform:
                i === 0 ? "translateX(0)" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t}%
          </span>
        ))}
      </div>
    </div>
  );
}
