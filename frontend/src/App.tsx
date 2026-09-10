import { useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import { CaseForm } from "./components/CaseForm";
import { ReportCard } from "./components/ReportCard";
import { CaseSummary } from "./components/CaseSummary";
import { Method } from "./components/Method";
import { EXAMPLE, MODEL } from "./lib/model";
import { predict } from "./lib/predict";

export function App() {
  const [group, setGroup] = useState<string>(EXAMPLE.group);
  const [values, setValues] = useState<Record<string, number>>({});
  const [shown, setShown] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const complete = MODEL.numeric_features.every(
    (f) => typeof values[f] === "number" && Number.isFinite(values[f]),
  );
  const prediction = useMemo(
    () => (complete ? predict(values, group) : null),
    [values, group, complete],
  );

  const onPredict = () => {
    if (!complete) return;
    setShown(true);
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const loadExample = () => {
    setGroup(EXAMPLE.group);
    setValues({ ...EXAMPLE.values });
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <h1 className={styles.title}>Canine Pyometra Treatment Outcome Predictor</h1>
          <p className={styles.lede}>
            Enter admission-day parameters and choose the intended treatment protocol. The
            model returns the predicted probability of treatment success at day&nbsp;14,
            based on an 80-case clinical dataset.
          </p>
        </header>

        <CaseForm
          group={group}
          values={values}
          onGroup={setGroup}
          onField={(f, v) => setValues((s) => ({ ...s, [f]: v }))}
          onSubmit={onPredict}
          onExample={loadExample}
          canSubmit={complete}
        />

        <p className={styles.foot}>
          This tool is based on a logistic-regression model trained on a cohort of 80
          bitches with pyometra (internal cross-validated ROC-AUC&nbsp;
          {MODEL.performance.roc_auc_cv}). Predictions complement, not replace, clinical
          judgement.
        </p>

        <div ref={resultRef}>
          {shown && prediction ? (
            <>
              <ReportCard prediction={prediction} />
              <CaseSummary group={group} values={values} prediction={prediction} />
            </>
          ) : null}
        </div>

        <section className={styles.block}>
          <p className="eyebrow">Method</p>
          <h2 className={styles.h2}>How the estimate is made</h2>
          <Method />
        </section>

        <footer className={styles.pageFoot}>
          <span>Model {MODEL.generated} · logistic regression</span>
          <a href="https://github.com/bhattarya/canine-pyometra-ml">
            github.com/bhattarya/canine-pyometra-ml
          </a>
          <span>Runs in your browser — no case data leaves this page.</span>
        </footer>
      </div>
    </div>
  );
}
