/* ------------------------------------------------------------------ *
 *  geminiClient — thin browser client for the chat proxy.
 *  The proxy holds the Gemini key server-side; this module only
 *  streams plain-text chunks back from `${VITE_PROXY_URL}/chat`.
 * ------------------------------------------------------------------ */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CaseContext {
  group: string;
  groupLabel: string;
  values: Record<string, number>;
  probability: number; // 0..1, P(treatment success by day 14) for the chosen protocol
  band: "Unlikely" | "Uncertain" | "Likely";
  observedOnly: boolean; // true for the surgical arm (observed rate, not a model estimate)
  drivers: { label: string; effect: "supports" | "against" }[];
  modelAuc: number;
  disclaimer: string;
}

/** True when a proxy URL has been configured at build time. */
export function proxyConfigured(): boolean {
  return !!import.meta.env.VITE_PROXY_URL;
}

interface StreamArgs {
  messages: ChatTurn[];
  caseContext: CaseContext;
  signal?: AbortSignal;
}

/**
 * Streams the assistant reply as plain-text chunks. The proxy is expected
 * to respond with a raw text stream (no SSE framing).
 */
export async function* streamChat(args: StreamArgs): AsyncGenerator<string> {
  const { messages, caseContext, signal } = args;

  const configured = import.meta.env.VITE_PROXY_URL;
  if (!configured) {
    throw new Error("Chat is not configured (VITE_PROXY_URL is unset).");
  }

  const endpoint = `${configured.replace(/\/$/, "")}/chat`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, caseContext }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Chat proxy error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const dec = new TextDecoder();

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) yield dec.decode(value, { stream: true });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err;
  }
}
