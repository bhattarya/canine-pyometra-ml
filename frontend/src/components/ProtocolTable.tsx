import styles from "./ProtocolTable.module.css";
import { groupLabel, type Band } from "../lib/model";
import { protocolContext } from "../lib/predict";
import { pct1 } from "../lib/format";

/** Observed success rate by treatment protocol for the given risk band. */
export function ProtocolTable({ band }: { band: Band }) {
  const rows = protocolContext(band);

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Observed success by protocol &middot; {band.toLowerCase()} band &middot; study dogs (small n
          &mdash; directional only)
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.th}>
              Protocol
            </th>
            <th scope="col" className={`${styles.th} ${styles.num}`}>
              Success
            </th>
            <th scope="col" className={`${styles.th} ${styles.num}`}>
              n
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const strong = band === "High" && r.success_rate >= 0.5;
            return (
              <tr key={r.group} className={strong ? styles.strong : undefined}>
                <td className={styles.td}>{groupLabel(r.group)}</td>
                <td className={`${styles.td} ${styles.num} mono`}>{pct1(r.success_rate)}</td>
                <td className={`${styles.td} ${styles.num} mono`}>{r.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
