import styles from "./NumberField.module.css";

interface Props {
  id: string;
  label: string;
  unit: string;
  hint?: string;
  step: number;
  value: number | undefined;
  onChange: (value: number) => void;
}

export function NumberField({ id, label, unit, hint, step, value, onChange }: Props) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} <span className={styles.unit}>({unit})</span>
      </label>
      <input
        id={id}
        className="control num"
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
          else if (e.target.value === "") onChange(NaN);
        }}
      />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
