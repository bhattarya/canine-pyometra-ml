import { useEffect, useRef } from "react";
import styles from "./ChatPanel.module.css";
import { ChatMessage } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { useChat } from "../../hooks/useChat";
import type { CaseContext } from "../../lib/geminiClient";

interface Props {
  caseContext: CaseContext;
}

export function ChatPanel({ caseContext }: Props) {
  const { messages, send, stop, loading, error, configured } = useChat(caseContext);
  const listRef = useRef<HTMLDivElement>(null);

  const lastContent = messages[messages.length - 1]?.content ?? "";
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContent]);

  return (
    <section className={styles.panel} aria-label="Case assistant">
      <header className={styles.head}>
        <h3 className={styles.title}>Ask about this case</h3>
        <p className={`${styles.meta} mono`}>
          powered by Gemini · proxied — case data goes to the proxy you configured
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
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className="no-print">
            <ChatComposer onSend={send} loading={loading} onStop={stop} />
          </div>
        </>
      )}
    </section>
  );
}
