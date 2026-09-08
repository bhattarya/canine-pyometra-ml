import { useMemo, useState } from "react";
import styles from "./App.module.css";
import { TopBar } from "./components/TopBar";
import { CaseForm } from "./components/CaseForm";
import { ReportCard } from "./components/ReportCard";
import { Method } from "./components/Method";
import { ChatPanel } from "./components/chat/ChatPanel";
import type { CaseContext } from "./lib/geminiClient";
import { EXAMPLES, MODEL } from "./lib/model";
import { predict } from "./lib/predict";

type CaseValues = Record<string, number>;

export function App() {
  const [values, setValues] = useState<CaseValues>({ ...EXAMPLES.high.values });
  const [activeExample, setActiveExample] = useState<"low" | "high" | null>("high");

  const prediction = useMemo(() => predict(values), [values]);

  const caseContext = useMemo<CaseContext>(
    () => ({
      values,
      probability: prediction.probability,
      band: prediction.band,
      drivers: prediction.drivers.map((d) => ({ label: d.label, direction: d.direction })),
      modelAuc: MODEL.performance.roc_auc_cv,
      disclaimer: MODEL.disclaimer,
    }),
    [values, prediction],
  );

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

      <header className={styles.masthead}>
        <div className={styles.inner}>
          <p className="eyebrow">Veterinary decision support · research preview</p>
          <h1 className={styles.title}>
            Will medical management
            <br />
            get this dog through?
          </h1>
          <p className={styles.standfirst}>
            An estimate of the probability that medical treatment of canine pyometra
            fails by day&nbsp;14, from six routine admission values — built on an
            80-dog, four-arm cohort.
          </p>
          <p className={styles.disclaimer}>
            Not a validated clinical tool. Trained on a single-centre teaching dataset
            of 80 dogs with 14 failure events — a teaching and discussion aid only. The
            attending clinician&rsquo;s judgement takes precedence.
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.section} aria-labelledby="assess">
          <div className={styles.inner}>
            <p className="eyebrow">01 — Assess a case</p>
            <h2 id="assess" className={styles.h2}>
              Enter the admission bloods
            </h2>
          </div>
          <div className={`${styles.inner} ${styles.workbench}`}>
            <CaseForm
              values={values}
              activeExample={activeExample}
              onField={setField}
              onExample={loadExample}
            />
            <ReportCard prediction={prediction} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="ask">
          <div className={styles.inner}>
            <p className="eyebrow">02 — Talk it through</p>
            <h2 id="ask" className={styles.h2}>
              Ask about this case
            </h2>
          </div>
          <div className={styles.inner}>
            <ChatPanel caseContext={caseContext} />
          </div>
        </section>

        <section
          className={`${styles.section} ${styles.paper} paper-scope`}
          aria-labelledby="method"
        >
          <div className={styles.inner}>
            <p className="eyebrow">03 — Method</p>
            <h2 id="method" className={styles.h2}>
              How the estimate is made
            </h2>
          </div>
          <div className={styles.inner}>
            <Method />
          </div>
        </section>
      </main>

      <footer className={styles.foot}>
        <div className={styles.inner}>
          <span>
            Model {MODEL.generated} · logistic regression, {MODEL.features.length}{" "}
            predictors
          </span>
          <span>
            <a href="https://github.com/bhattarya/canine-pyometra-ml">
              github.com/bhattarya/canine-pyometra-ml
            </a>
          </span>
          <span>Runs in your browser — no case data leaves this page.</span>
        </div>
      </footer>
    </div>
  );
}
