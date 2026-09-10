import styles from "./CaseSummary.module.css";
import type { Prediction } from "../lib/predict";
import { buildSummary } from "../lib/summary";

interface Props {
  group: string;
  values: Record<string, number>;
  prediction: Prediction;
}

export function CaseSummary({ group, values, prediction }: Props) {
  const paragraphs = buildSummary(group, values, prediction);
  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Plain-English summary</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className={styles.p}>
          {p}
        </p>
      ))}
    </div>
  );
}
