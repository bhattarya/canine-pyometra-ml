import styles from "./CaseForm.module.css";
import { NumberField } from "./NumberField";
import { EXAMPLES, FIELD_UI, MODEL } from "../lib/model";

interface Props {
  values: Record<string, number>;
  activeExample: "low" | "high" | null;
  onField: (feature: string, value: number) => void;
  onExample: (key: "low" | "high") => void;
}

export function CaseForm({ values, activeExample, onField, onExample }: Props) {
  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.formHead}>
        <span className={styles.tag}>Admission values</span>
        <span className={styles.tagNote}>day 0, before treatment</span>
      </div>

      <div className={styles.fields}>
        {MODEL.features.map((f) => {
          const ui = FIELD_UI[f];
          const r = MODEL.input_ranges[f];
          const lo = Math.floor(Math.min(r.min, values[f]));
          const hi = Math.ceil(Math.max(r.max, values[f]));
          const dp = r.min < 10 ? 1 : 0;
          return (
            <NumberField
              key={f}
              id={`fld-${f}`}
              label={ui.short}
              unit={ui.unit}
              hint={`${ui.ref} · study range ${r.min.toFixed(dp)}–${r.max.toFixed(dp)}`}
              value={values[f]}
              step={ui.step}
              min={lo}
              max={hi}
              onChange={(v) => onField(f, v)}
            />
          );
        })}
      </div>

      <div className={styles.examples}>
        <span className={styles.exLabel}>Load example</span>
        {(Object.keys(EXAMPLES) as ("low" | "high")[]).map((k) => (
          <button
            key={k}
            type="button"
            className={activeExample === k ? styles.exOn : styles.ex}
            onClick={() => onExample(k)}
          >
            {EXAMPLES[k].label}
          </button>
        ))}
      </div>
    </form>
  );
}
