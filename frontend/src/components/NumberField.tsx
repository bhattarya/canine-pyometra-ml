import styles from "./NumberField.module.css";
import { clamp } from "../lib/format";

interface Props {
  id: string;
  label: string;
  unit: string;
  hint: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function NumberField({ id, label, unit, hint, value, step, min, max, onChange }: Props) {
  const commit = (raw: string, fromSlider: boolean) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return;
    onChange(fromSlider ? n : n);
  };
  const trackPos = ((clamp(value, min, max) - min) / (max - min)) * 100;

  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label} <span className={styles.unit}>{unit}</span>
        </label>
        <input
          id={id}
          className={`${styles.number} mono`}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => commit(e.target.value, false)}
        />
      </div>
      <div className={styles.hint}>{hint}</div>
      <input
        className={styles.slider}
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => commit(e.target.value, true)}
        style={{ ["--pos" as string]: `${trackPos}%` }}
      />
    </div>
  );
}
