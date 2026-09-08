import { Fragment } from "react";
import styles from "./ChatMessage.module.css";
import type { ChatTurn } from "../../lib/geminiClient";

interface Props {
  turn: ChatTurn;
  /** True when this is the last turn and a stream is still in flight. */
  pending?: boolean;
}

function renderParagraphs(content: string) {
  return content.split(/\n\n+/).map((para, pi) => {
    const lines = para.split("\n");
    return (
      <p key={pi} className={styles.para}>
        {lines.map((line, li) => (
          <Fragment key={li}>
            {line}
            {li < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>
    );
  });
}

export function ChatMessage({ turn, pending = false }: Props) {
  const isUser = turn.role === "user";
  const showDots = pending && turn.role === "assistant" && turn.content === "";

  return (
    <div className={isUser ? styles.rowUser : styles.rowBot}>
      <span className={`${styles.tag} mono`}>{isUser ? "you" : "assistant"}</span>
      <div className={isUser ? styles.bubbleUser : styles.bubbleBot}>
        {showDots ? (
          <span className={styles.dots} aria-label="Assistant is typing">
            <span>·</span>
            <span>·</span>
            <span>·</span>
          </span>
        ) : (
          renderParagraphs(turn.content)
        )}
      </div>
    </div>
  );
}
