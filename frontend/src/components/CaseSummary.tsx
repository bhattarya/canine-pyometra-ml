import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./CaseSummary.module.css";
import type { Prediction } from "../lib/predict";
import { buildSummary, buildAiContext } from "../lib/summary";
import { aiConfigured, streamAiSummary } from "../lib/aiSummary";

interface Props {
  group: string;
  values: Record<string, number>;
  prediction: Prediction;
}

type Mode = "streaming" | "ai" | "fallback";

export function CaseSummary({ group, values, prediction }: Props) {
  const deterministic = buildSummary(group, values, prediction);
  const useAi = aiConfigured();

  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>(useAi ? "streaming" : "fallback");
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const caseKey = JSON.stringify({ group, values, p: prediction.probability });

  const run = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setText("");
    setFailed(false);
    setMode("streaming");

    (async () => {
      try {
        let got = "";
        for await (const chunk of streamAiSummary(
          buildAiContext(group, values, prediction),
          ctrl.signal,
        )) {
          got += chunk;
          setText(got);
        }
        if (ctrl.signal.aborted) return;
        if (got.trim().length < 40) throw new Error("empty response");
        setMode("ai");
      } catch {
        if (ctrl.signal.aborted) return;
        setFailed(true);
        setMode("fallback");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseKey]);

  useEffect(() => {
    if (!useAi) {
      setMode("fallback");
      return;
    }
    run();
    return () => abortRef.current?.abort();
  }, [run, useAi]);

  const showFallback = mode === "fallback";
  const paragraphs = showFallback
    ? deterministic
    : text.split(/\n\n+/).filter((s) => s.trim());

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Plain-English summary</h3>
        <span className={styles.tag}>
          {mode === "ai" && "AI-generated"}
          {mode === "streaming" && "AI-generated · writing…"}
          {showFallback && (failed ? "AI unavailable — generated summary" : "generated summary")}
        </span>
      </div>

      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => (
          <p key={i} className={styles.p}>
            {p}
          </p>
        ))
      ) : (
        <p className={styles.p}>…</p>
      )}

      {useAi && mode === "ai" && (
        <button
          type="button"
          className={`btn-ghost ${styles.regen} no-print`}
          onClick={run}
        >
          Regenerate
        </button>
      )}
    </div>
  );
}
