import styles from "./Method.module.css";
import { MODEL, groupLabel, NICE_NAME } from "../lib/model";
import { pct1, round } from "../lib/format";
import { BarList } from "./charts/BarList";
import { BandTiles } from "./charts/BandTiles";

const [cut0, cut1] = MODEL.risk_bands.cutpoints_prob;
const c0 = round(cut0 * 100);
const c1 = round(cut1 * 100);

const topHighProtocols = Object.entries(MODEL.protocol_hint.High)
  .sort((a, b) => b[1].success_rate - a[1].success_rate)
  .slice(0, 2)
  .map(([group]) => groupLabel(group))
  .join(" and ");

export function Method() {
  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>
        The workflow follows the canine-parvovirus prognosis study of Nafe
        Monfared et al. (Front. Vet. Sci. 2025): screen the admission variables,
        reduce them with recursive feature elimination (RFECV), then compare many
        algorithms under repeated stratified cross-validation.
      </p>

      <h3 className={styles.h}>The data</h3>
      <p>
        80 dogs presenting with pyometra, assigned across four protocols (20
        each) and followed to day 14. Admission demographics, vital signs,
        haematology, serum biochemistry and ultrasonographic uterine diameter
        were recorded. Baseline data were complete, and the cohort was balanced
        across the arms on every measured variable.
      </p>

      <h3 className={styles.h}>The model behind this predictor</h3>
      <p>
        An L2-penalised logistic regression for medical failure by day 14
        (death, rescue ovariohysterectomy, or non-response), fitted on{" "}
        {MODEL.cohort} using six variables that survived selection — BUN,
        creatinine, alkaline phosphatase, albumin, age and illness duration.
        Held-out discrimination is ROC-AUC{" "}
        <span className="mono">
          {MODEL.performance.roc_auc_cv} ± {MODEL.performance.roc_auc_cv_sd}
        </span>{" "}
        (repeated stratified 5-fold CV). Random forest and naïve Bayes performed
        within cross-validation noise; logistic regression was kept because it is
        transparent and portable.
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>
          Observed success by protocol
        </figcaption>
        <BarList
          items={MODEL.display.success_by_protocol.map((r) => ({
            label: groupLabel(r.group),
            value: r.success_rate,
          }))}
        />
        <figcaption className={styles.figNote}>
          Uncomplicated resolution by day 14, all 80 dogs. G4 (surgery) was not
          randomised — interpret the gradient, not the exact figures.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>
          What separates failure from success at admission
        </figcaption>
        <BarList
          items={MODEL.display.top_predictors.map((r) => ({
            label: NICE_NAME[r.variable] ?? r.variable,
            value: r.auc,
          }))}
          domain={[0.5, 1]}
          format={(v) => v.toFixed(2)}
        />
        <figcaption className={styles.figNote}>
          Single-variable discrimination (AUC) for medical failure. Renal and
          hepatic markers and low albumin carry most of the signal.
        </figcaption>
      </figure>

      <h3 className={styles.h}>Reading the risk bands</h3>
      <p>
        The predicted probability is grouped into three bands, with fixed
        cut-points at <span className="mono">{c0}%</span> and{" "}
        <span className="mono">{c1}%</span>.
      </p>
      <div className={styles.tiles}>
        <BandTiles table={MODEL.risk_bands.table} />
      </div>
      <p className={styles.note}>
        In the study cohort, no medically managed dog below the {c1}% mark
        failed; above it, {pct1(MODEL.risk_bands.table.High.observed_failure_rate)}{" "}
        did — and among those, {topHighProtocols} clearly out-performed the other
        medical options.
      </p>

      <h3 className={styles.h}>Limitations</h3>
      <ul className={styles.limits}>
        <li>
          Single centre, 80 dogs, 14 failure events — wide confidence intervals,
          external validity untested.
        </li>
        <li>
          The surgical arm (G4) was not randomised and is perfectly separated on
          outcome, so protocol comparisons are descriptive, not causal.
        </li>
        <li>
          On this clean dataset the model is over-confident at the extremes —
          treat the output as a band (low / intermediate / high), not a precise
          percentage.
        </li>
        <li>
          No prospective or multi-centre validation — this is a methodology
          demonstration.
        </li>
      </ul>
    </div>
  );
}
