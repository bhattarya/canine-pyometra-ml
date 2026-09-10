import styles from "./ProtocolTable.module.css";
import { MODEL, groupLabel } from "../lib/model";
import { pct1 } from "../lib/format";

export function ProtocolTable({ selected }: { selected: string }) {
  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Observed success by protocol (cohort)</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Protocol</th>
            <th className={`${styles.th} ${styles.num}`}>Success</th>
            <th className={`${styles.th} ${styles.num}`}>n</th>
          </tr>
        </thead>
        <tbody>
          {MODEL.groups.map((g) => {
            const o = MODEL.protocol_observed[g];
            return (
              <tr key={g} className={g === selected ? styles.selected : undefined}>
                <td className={styles.td}>{groupLabel(g)}</td>
                <td className={`${styles.td} ${styles.num}`}>{pct1(o.success_rate)}</td>
                <td className={`${styles.td} ${styles.num}`}>{o.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.caption}>
        Raw day-14 resolution rates in the 80-dog cohort. Arms were not randomised for
        severity; read the gradient, not the exact figures.
      </p>
    </div>
  );
}
