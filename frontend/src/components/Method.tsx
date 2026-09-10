import styles from "./Method.module.css";
import { MODEL, groupLabel, NICE_NAME } from "../lib/model";
import { BarList } from "./charts/BarList";

export function Method() {
  const [lo, hi] = MODEL.success_bands.cutpoints_prob;

  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>
        Enter the dog&rsquo;s admission picture and the protocol you intend to use; the tool
        returns the model&rsquo;s estimated probability that the treatment resolves the case by
        day&nbsp;14.
      </p>

      <h3 className={styles.h}>The data</h3>
      <p>
        {MODEL.cohort} Admission demographics, vital signs, haematology, serum biochemistry
        and ultrasonographic uterine diameter were recorded. Baseline data were complete and
        the cohort was balanced across the four arms on every measured variable.
      </p>

      <h3 className={styles.h}>The model</h3>
      <p>
        An L2-penalised logistic regression for <strong>treatment success by day&nbsp;14</strong>,
        fitted on all 80 dogs. Inputs: the intended protocol (G1&ndash;G4) plus nine routine
        admission values &mdash; age, illness duration, heart rate, total leucocyte count,
        creatinine, albumin, ALP, uterine diameter and a clinical severity score. Held-out
        discrimination is <span className="mono">ROC-AUC {MODEL.performance.roc_auc_cv} &plusmn;{" "}
        {MODEL.performance.roc_auc_cv_sd}</span> (repeated stratified 5-fold cross-validation).
      </p>

      <h3 className={styles.h}>Reading the number</h3>
      <p>
        Estimates below <span className="mono">{lo * 100}%</span> read as <em>unlikely to
        succeed</em>; <span className="mono">{lo * 100}&ndash;{hi * 100}%</span> as
        <em> uncertain</em>; above <span className="mono">{hi * 100}%</span> as <em>likely</em>.
        On this clean, separable dataset the model is over-confident at the extremes &mdash;
        treat the output as a band, not a precise percentage, and read it alongside the observed
        cohort rates below.
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Observed success by protocol</figcaption>
        <BarList
          items={MODEL.display.success_by_protocol.map((r) => ({
            label: groupLabel(r.group),
            value: r.success_rate,
          }))}
        />
        <figcaption className={styles.figNote}>
          Raw day-14 resolution, all 80 dogs. The surgical arm (G4) was not randomised for
          severity &mdash; interpret the gradient, not the exact figures.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>
          Strongest single admission predictors
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
          Single-variable discrimination (AUC) for the day-14 outcome. Renal and hepatic
          markers and low albumin carry most of the signal.
        </figcaption>
      </figure>

      <h3 className={styles.h}>Limitations</h3>
      <ul className={styles.limits}>
        <li>
          Single centre, 80 dogs, 14 failure events &mdash; wide confidence intervals,
          external validity untested.
        </li>
        <li>
          The surgical arm (G4) was not randomised and every dog resolved (20/20), so the
          model cannot estimate surgical risk &mdash; its figure is the observed rate.
        </li>
        <li>
          The model is over-confident at the extremes on this clean dataset &mdash; read the
          band, not the exact percentage.
        </li>
        <li>No prospective or multi-centre validation &mdash; this is a methodology demonstration.</li>
      </ul>
    </div>
  );
}
