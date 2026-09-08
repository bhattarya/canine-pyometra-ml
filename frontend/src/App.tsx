import { useMemo, useState } from "react";
import styles from "./App.module.css";
import { TopBar } from "./components/TopBar";
import { CaseForm } from "./components/CaseForm";
import { ReportCard } from "./components/ReportCard";
import { Method } from "./components/Method";
import { EXAMPLES, MODEL } from "./lib/model";
import { predict } from "./lib/predict";

type CaseValues = Record<string, number>;

export function App() {
  const [values, setValues] = useState<CaseValues>({ ...EXAMPLES.high.values });
  const [activeExample, setActiveExample] = useState<"low" | "high" | null>("high");

  const prediction = useMemo(() => predict(values), [values]);

  const setField = (feature: string, value: number) => {
    setValues((v) => ({ ...v, [feature]: value }));
    setActiveExample(null);
  };
  const loadExample = (key: "low" | "high") => {
    setValues({ ...EXAMPLES[key].values });
    setActiveExample(key);
  };

  return (
    <div className={styles.shell}>
      <TopBar />

      <main className={styles.main}>
        <header className={styles.masthead}>
          <p className="eyebrow">Veterinary decision support · research preview</p>
          <h1 className={styles.title}>Pyometra Outcome Predictor</h1>
          <p className={styles.standfirst}>
            Estimates the probability that <em>medical</em> management of canine pyometra fails by
            day&nbsp;14 &mdash; from six routine admission values. Built on an 80-dog, four-arm
            cohort (G1 supportive · G2 PGF2&alpha; · G3 aglepristone&nbsp;+&nbsp;PGF2&alpha; · G4
            ovariohysterectomy).
          </p>
          <p className={styles.disclaimer}>
            <strong>Not a validated clinical tool.</strong> Trained on a single-centre teaching
            dataset of 80 dogs with 14 failure events. A teaching and discussion aid only &mdash;
            the attending clinician&rsquo;s judgement takes precedence.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="assess">
          <div className={styles.sectionHead}>
            <span className={styles.marker}>&sect;1</span>
            <h2 id="assess" className={styles.h2}>
              Assess a case
            </h2>
          </div>
          <div className={styles.workbench}>
            <CaseForm
              values={values}
              activeExample={activeExample}
              onField={setField}
              onExample={loadExample}
            />
            <ReportCard prediction={prediction} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="method">
          <div className={styles.sectionHead}>
            <span className={styles.marker}>&sect;2</span>
            <h2 id="method" className={styles.h2}>
              How the tool works
            </h2>
          </div>
          <Method />
        </section>
      </main>

      <footer className={styles.foot}>
        <span>
          Model generated {MODEL.generated} · logistic regression, {MODEL.features.length}{" "}
          predictors · {MODEL.performance.cv}
        </span>
        <span>
          Code &amp; full analysis:{" "}
          <a href="https://github.com/bhattarya/canine-pyometra-ml">
            github.com/bhattarya/canine-pyometra-ml
          </a>
        </span>
        <span>Runs entirely in your browser — no data leaves this page.</span>
      </footer>
    </div>
  );
}
