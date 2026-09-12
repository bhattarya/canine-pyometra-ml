import styles from "./Method.module.css";
import { BarList } from "./charts/BarList";
import { AlgorithmLeaderboard } from "./charts/AlgorithmLeaderboard";
import { StageReduction } from "./charts/StageReduction";
import { BandCalibration } from "./charts/BandCalibration";
import { FeatureEffects } from "./charts/FeatureEffects";
import { ModelMetrics } from "./charts/ModelMetrics";
import { AlgorithmMetricsTable } from "./charts/AlgorithmMetricsTable";
import {
  BAND_CUTPOINTS,
  COHORT,
  PROGNOSTIC_PERF,
  SUCCESS_BY_PROTOCOL,
  TOP_PREDICTORS,
  TREATMENT_PERF,
} from "../data/findings";

export function Method() {
  const [lo, hi] = BAND_CUTPOINTS;

  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>
        Enter the dog&rsquo;s admission picture and the protocol you intend to use; the tool
        returns the model&rsquo;s estimated probability that the treatment resolves the case by
        day&nbsp;14.
      </p>

      <h3 className={styles.h}>The data</h3>
      <p>
        {COHORT} Admission demographics, vital signs, haematology, serum biochemistry and
        ultrasonographic uterine diameter were recorded. Baseline data were complete and the
        cohort was balanced across the four arms on every measured variable.
      </p>

      <h3 className={styles.h}>The model</h3>
      <p>
        An L2-penalised logistic regression for <strong>treatment success by day&nbsp;14</strong>,
        fitted on all 80 dogs. Inputs: the intended protocol (G1&ndash;G4) plus nine routine
        admission values &mdash; age, illness duration, heart rate, total leucocyte count,
        neutrophil count, creatinine, albumin, ALP and ALT. Held-out discrimination is{" "}
        <span className="mono">ROC-AUC {TREATMENT_PERF.rocAucCv} &plusmn;{" "}
        {TREATMENT_PERF.rocAucCvSd}</span> (repeated stratified 5-fold cross-validation).
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Model performance</figcaption>
        <ModelMetrics />
        <figcaption className={styles.figNote}>
          Accuracy, sensitivity, specificity and F1 use the standard 0.5 probability threshold;
          ROC-AUC and the curve are threshold-free. All five are averaged over repeated
          stratified 5-fold cross-validation (20 repeats) &mdash; the same protocol as every
          other number on this page.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Algorithm bake-off &mdash; ROC-AUC</figcaption>
        <AlgorithmLeaderboard />
        <figcaption className={styles.figNote}>
          Fifteen algorithms compared under repeated stratified 5-fold cross-validation on the
          deployed design. The intervals overlap heavily &mdash; no model is reliably more
          accurate on 80 dogs with 14 failures. Logistic regression (highlighted) was chosen
          because it is interpretable and runs entirely in the browser.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Algorithm bake-off &mdash; every metric</figcaption>
        <AlgorithmMetricsTable />
        <figcaption className={styles.figNote}>
          Same 12 algorithms and the same cross-validation, broken out by metric. Accuracy,
          sensitivity, specificity and F1 use the 0.5 probability threshold; ROC-AUC does not.
          Rows with wide specificity intervals are unreliable at catching failures &mdash; only
          14 of 80 dogs failed treatment, so that estimate rests on very few events.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Feature reduction &mdash; predictors vs AUC</figcaption>
        <StageReduction />
        <figcaption className={styles.figNote}>
          Feature selection mirrors the canine-parvovirus prognosis study (Nafe Monfared et al.,
          2025): start with every admission variable, drop weak ones by univariate screen, then
          reduce further by recursive feature elimination. Discrimination barely changes &mdash;
          the shorter model is preferred for parsimony.
        </figcaption>
      </figure>

      <h3 className={styles.h}>Reading the number</h3>
      <p>
        Estimates below <span className="mono">{Math.round(lo * 100)}%</span> read as <em>unlikely
        to succeed</em>; <span className="mono">{Math.round(lo * 100)}&ndash;{Math.round(hi * 100)}%</span>{" "}
        as <em>uncertain</em>; above <span className="mono">{Math.round(hi * 100)}%</span> as{" "}
        <em>likely</em>.
        On this clean, separable dataset the model is over-confident at the extremes &mdash;
        treat the output as a band, not a precise percentage, and read it alongside the observed
        cohort rates below.
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Observed success within each band</figcaption>
        <BandCalibration />
        <figcaption className={styles.figNote}>
          How the predicted bands played out in the cohort: of the cases the model rated
          &lsquo;likely&rsquo;, 100% resolved; of those it rated &lsquo;unlikely&rsquo;, 33%. On
          this clean dataset the model is over-confident at the extremes, so the band is more
          trustworthy than the exact percentage.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Observed success by protocol</figcaption>
        <BarList
          items={SUCCESS_BY_PROTOCOL.map((r) => ({ label: r.label, value: r.value }))}
        />
        <figcaption className={styles.figNote}>
          Raw day-14 resolution, all 80 dogs (n&nbsp;=&nbsp;20 per arm). The surgical arm (G4)
          was not randomised for severity &mdash; interpret the gradient, not the exact figures.
        </figcaption>
      </figure>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>
          Strongest single admission predictors
        </figcaption>
        <BarList
          items={TOP_PREDICTORS.map((r) => ({ label: r.label, value: r.auc }))}
          domain={[0.5, 1]}
          format={(v) => v.toFixed(2)}
        />
        <figcaption className={styles.figNote}>
          Single-variable discrimination (AUC) for the day-14 outcome. Renal and hepatic markers
          and low albumin carry most of the signal.
        </figcaption>
      </figure>

      <h3 className={styles.h}>What the model weights</h3>
      <p>
        The logistic fit is fully inspectable: each admission value and each protocol contributes
        a fixed weight to the log-odds of success. A companion model for <em>medical failure</em>
        {" "}on the G1&ndash;G3 arms scores <span className="mono">ROC-AUC{" "}
        {PROGNOSTIC_PERF.rocAucCv} &plusmn; {PROGNOSTIC_PERF.rocAucCvSd}</span>.
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.figHead}>Standardised coefficients</figcaption>
        <FeatureEffects />
        <figcaption className={styles.figNote}>
          Standardised logistic-regression coefficients &mdash; the direction and relative size
          of each admission value&rsquo;s and each protocol&rsquo;s effect on the predicted
          probability of success, holding everything else fixed (log-odds per 1&nbsp;SD;
          protocols relative to G1 supportive care).
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
