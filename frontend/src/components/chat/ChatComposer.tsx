import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import styles from "./ChatComposer.module.css";

interface Props {
  onSend: (text: string) => void;
  loading: boolean;
  onStop: () => void;
}

const MAX_H = 160;

export function ChatComposer({ onSend, loading, onStop }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  };

  const reset = () => {
    setValue("");
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
    }
  };

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    reset();
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    grow(e.target);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const empty = value.trim().length === 0;

  return (
    <div className={styles.wrap}>
      <textarea
        ref={ref}
        className={`${styles.input} mono`}
        rows={1}
        value={value}
        placeholder="Ask about this case…"
        aria-label="Message the assistant"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      {loading ? (
        <button type="button" className={styles.btn} onClick={onStop}>
          Stop
        </button>
      ) : (
        <button
          type="button"
          className={styles.btn}
          onClick={submit}
          disabled={empty}
          aria-label="Send message"
        >
          Send
        </button>
      )}
    </div>
  );
}
