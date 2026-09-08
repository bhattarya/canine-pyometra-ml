import styles from "./RiskGauge.module.css";
import { MODEL } from "../lib/model";
import { clamp } from "../lib/format";

/** Horizontal 0->100% risk bar with a needle at the estimated probability. */
export function RiskGauge({ probability }: { probability: number }) {
  const [cut0, cut1] = MODEL.risk_bands.cutpoints_prob;
  const p0 = cut0 * 100;
  const p1 = cut1 * 100;
  const needle = clamp(probability * 100, 1.5, 98.5);

  const ticks: { pos: number; label: string }[] = [
    { pos: 0, label: "0%" },
    { pos: p0, label: `${Math.round(p0)}%` },
    { pos: p1, label: `${Math.round(p1)}%` },
    { pos: 100, label: "100%" },
  ];

  return (
    <div className={styles.wrap}>
      <div
        className={styles.bar}
        style={{
          ["--cut0" as string]: `${p0}%`,
          ["--cut1" as string]: `${p1}%`,
        }}
        role="img"
        aria-label={
          `Risk gauge: ${Math.round(probability * 100)} percent on a 0 to 100 percent scale; ` +
          `band cutpoints at ${Math.round(p0)} and ${Math.round(p1)} percent.`
        }
      >
        <span className={styles.needle} style={{ left: `${needle}%` }} aria-hidden="true" />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {ticks.map((t) => (
          <span
            key={t.label}
            className={`${styles.tick} mono`}
            style={{
              left: `${t.pos}%`,
              transform:
                t.pos === 0 ? "none" : t.pos === 100 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
