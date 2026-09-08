import { useCallback, useEffect, useRef, useState } from "react";
import {
  proxyConfigured,
  streamChat,
  type CaseContext,
  type ChatTurn,
} from "../lib/geminiClient";

const SEED: ChatTurn = {
  role: "assistant",
  content:
    "Ask me about this case — I can explain the estimate, the risk drivers, or the protocol evidence. I don't give treatment orders.",
};

const REACH_ERROR = "— could not reach the assistant —";

export interface UseChat {
  messages: ChatTurn[];
  send: (text: string) => void;
  stop: () => void;
  loading: boolean;
  error: string | null;
  configured: boolean;
}

export function useChat(caseContext: CaseContext): UseChat {
  const [messages, setMessages] = useState<ChatTurn[]>([SEED]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so the async `send` closure always sees the latest values without
  // being re-created (and going stale) on every render.
  const contextRef = useRef(caseContext);
  const messagesRef = useRef<ChatTurn[]>(messages);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    contextRef.current = caseContext;
  }, [caseContext]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const send = useCallback((text: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const outgoing: ChatTurn[] = [
      ...messagesRef.current,
      { role: "user", content: text },
    ];

    setError(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    const appendChunk = (chunk: string) => {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + chunk };
        }
        return next;
      });
    };

    const fillIfEmpty = (marker: string) => {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          next[next.length - 1] = { ...last, content: marker };
        }
        return next;
      });
    };

    void (async () => {
      let received = false;
      try {
        for await (const chunk of streamChat({
          messages: outgoing,
          caseContext: contextRef.current,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break;
          received = true;
          appendChunk(chunk);
        }
        if (!controller.signal.aborted && !received) fillIfEmpty(REACH_ERROR);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Chat failed.");
        fillIfEmpty(REACH_ERROR);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();
  }, []);

  return {
    messages,
    send,
    stop,
    loading,
    error,
    configured: proxyConfigured(),
  };
}
