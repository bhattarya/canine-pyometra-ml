import styles from "./BarList.module.css";
import { pct1 } from "../../lib/format";

interface BarListProps {
  items: { label: string; value: number }[];
  domain?: [number, number];
  format?: (v: number) => string;
}

export function BarList({ items, domain = [0, 1], format = pct1 }: BarListProps) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;

  return (
    <ul className={styles.list}>
      {items.map((it) => {
        const raw = ((it.value - lo) / span) * 100;
        const width = Math.max(0, Math.min(100, raw));
        return (
          <li className={styles.row} key={it.label}>
            <span className={styles.label} title={it.label}>
              {it.label}
            </span>
            <span className={styles.track}>
              <span className={styles.fill} style={{ width: `${width}%` }} />
            </span>
            <span className={`${styles.value} mono`}>{format(it.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}
