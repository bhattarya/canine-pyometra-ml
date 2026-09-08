import styles from "./BandTiles.module.css";
import { MODEL } from "../../lib/model";

type Table = (typeof MODEL)["risk_bands"]["table"];

const ORDER: (keyof Table)[] = ["Low", "Intermediate", "High"];

const DOT: Record<keyof Table, string> = {
  Low: "var(--r-low)",
  Intermediate: "var(--r-mid)",
  High: "var(--r-high)",
};

export function BandTiles({ table }: { table: Table }) {
  return (
    <div className={styles.grid}>
      {ORDER.map((band) => {
        const row = table[band];
        return (
          <div className={styles.tile} key={band}>
            <span className={styles.band}>
              <span className={styles.dot} style={{ background: DOT[band] }} />
              {band}
            </span>
            <span className={`${styles.big} mono`}>
              {(row.observed_failure_rate * 100).toFixed(0)}%
            </span>
            <span className={styles.sub}>
              observed failure · n = {row.n} study dogs
            </span>
          </div>
        );
      })}
    </div>
  );
}
