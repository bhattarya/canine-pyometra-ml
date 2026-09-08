import { Fragment, type ReactNode } from "react";
import styles from "./ChatMessage.module.css";
import type { ChatTurn } from "../../lib/geminiClient";

interface Props {
  turn: ChatTurn;
  /** True when this is the last turn and a stream is still in flight. */
  pending?: boolean;
}

/** Inline **bold** and `code` — builds React nodes, never HTML. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={k++}>{m[1]}</strong>);
    else nodes.push(<code key={k++} className={styles.code}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Very small block renderer: paragraphs, "- " / "* " bullet lists, hard breaks. */
function renderContent(content: string): ReactNode {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === "");
    if (isList && lines.some((l) => l.trim())) {
      return (
        <ul key={bi} className={styles.ul}>
          {lines
            .filter((l) => l.trim())
            .map((l, li) => (
              <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
            ))}
        </ul>
      );
    }
    return (
      <p key={bi} className={styles.para}>
        {lines.map((line, li) => (
          <Fragment key={li}>
            {inline(line)}
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
          renderContent(turn.content)
        )}
      </div>
    </div>
  );
}
