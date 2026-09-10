import styles from "./CaseForm.module.css";
import { NumberField } from "./NumberField";
import { MODEL, groupLabel } from "../lib/model";

interface Props {
  group: string;
  values: Record<string, number>;
  onGroup: (g: string) => void;
  onField: (feature: string, value: number) => void;
  onSubmit: () => void;
  onExample: () => void;
  canSubmit: boolean;
}

export function CaseForm({
  group,
  values,
  onGroup,
  onField,
  onSubmit,
  onExample,
  canSubmit,
}: Props) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fld-group">
            Treatment protocol
          </label>
          <select
            id="fld-group"
            className="control"
            value={group}
            onChange={(e) => onGroup(e.target.value)}
          >
            {MODEL.groups.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)}
              </option>
            ))}
          </select>
        </div>

        {MODEL.numeric_features.map((f) => (
          <NumberField
            key={f}
            id={`fld-${f}`}
            label={MODEL.labels[f]}
            unit={MODEL.units[f]}
            hint={MODEL.ref_ranges[f]}
            step={MODEL.step[f] ?? 1}
            value={values[f]}
            onChange={(v) => onField(f, v)}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          Predict treatment success
        </button>
        <button type="button" className="btn-ghost no-print" onClick={onExample}>
          Fill example values
        </button>
        {!canSubmit ? (
          <span className={styles.needAll}>Enter all fields to run the model.</span>
        ) : null}
      </div>
    </form>
  );
}
