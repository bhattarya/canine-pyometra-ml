/* ------------------------------------------------------------------ *
 *  aiSummary — optional AI-written case summary.
 *  Calls the serverless proxy (which holds the Gemini key server-side)
 *  in one-shot "summary" mode and streams plain-text back. If no proxy
 *  is configured, the app falls back to the deterministic summary.
 * ------------------------------------------------------------------ */

export interface AiContext {
  groupLabel: string;
  probability: number;
  band: string;
  observedOnly: boolean;
  values: Record<string, { value: number; unit: string; flag: string | null }>;
  drivers: { label: string; effect: string }[];
  protocolObserved: Record<string, { n: number; success_rate: number }>;
  modelAuc: number;
}

export function aiConfigured(): boolean {
  return !!import.meta.env.VITE_PROXY_URL;
}

export async function* streamAiSummary(
  caseContext: AiContext,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const base = import.meta.env.VITE_PROXY_URL;
  if (!base) throw new Error("AI summary is not configured (VITE_PROXY_URL unset).");

  const res = await fetch(`${base.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "summary", caseContext }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Summary service error ${res.status}`);
  }

  const reader = res.body.getReader();
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
