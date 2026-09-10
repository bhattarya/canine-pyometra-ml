import { useEffect, useRef } from "react";
import styles from "./ChatPanel.module.css";
import { ChatMessage } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { useChat } from "../../hooks/useChat";
import type { CaseContext } from "../../lib/geminiClient";

interface Props {
  caseContext: CaseContext;
}

const STARTERS = [
  "Why is this case the risk it is?",
  "Which admission value matters most here?",
  "What does this risk band mean for management?",
  "How much should I trust this number?",
];

export function ChatPanel({ caseContext }: Props) {
  const { messages, send, stop, reset, loading, error, configured, started } =
    useChat(caseContext);
  const listRef = useRef<HTMLDivElement>(null);

  const lastContent = messages[messages.length - 1]?.content ?? "";
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContent]);

  const pct = Math.round(caseContext.probability * 100);
  const pctText = pct < 1 ? "<1" : pct > 99 ? ">99" : String(pct);

  return (
    <section className={styles.panel} aria-label="Case assistant">
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h3 className={styles.title}>Ask about this case</h3>
          {configured && started ? (
            <button className={styles.clear} onClick={reset} type="button">
              Clear
            </button>
          ) : null}
        </div>
        <p className={`${styles.meta} mono`}>
          Gemini via your proxy · the assistant is told this case:{" "}
          <span className={styles.badge} data-band={caseContext.band}>
            {caseContext.groupLabel} · {pctText}% success ({caseContext.band})
          </span>
        </p>
      </header>

      {!configured ? (
        <div className={styles.notice}>
          Chat assistant not configured. Set <code>VITE_PROXY_URL</code> to your deployed
          proxy to enable it — see <code>proxy/README.md</code>. The risk estimate and
          everything else on this page work without it.
        </div>
      ) : (
        <>
          <div className={styles.list} ref={listRef}>
            {messages.map((turn, i) => (
              <ChatMessage
                key={i}
                turn={turn}
                pending={loading && i === messages.length - 1}
              />
            ))}
          </div>

          {!started ? (
            <div className={styles.starters}>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.starter}
                  disabled={loading}
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className="no-print">
            <ChatComposer onSend={send} loading={loading} onStop={stop} />
          </div>
        </>
      )}
    </section>
  );
}
