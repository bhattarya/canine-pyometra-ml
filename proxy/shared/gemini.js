// ESM module — no dependencies. Uses native fetch / ReadableStream / TextEncoder / TextDecoder.
//
// streamGemini() calls the Gemini REST v1beta streamGenerateContent endpoint in
// SSE mode, parses the "data: {json}" events, and re-emits ONLY the assistant
// text into a plain-text ReadableStream<Uint8Array>. No SSE framing on our side.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const APOLOGY =
  "Sorry — the assistant is unavailable right now. Please try again in a moment.";

/**
 * Extract the incremental text from one Gemini streamGenerateContent event object.
 * @param {any} evt
 * @returns {string}
 */
function textFromEvent(evt) {
  try {
    const parts = evt?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return "";
    let out = "";
    for (const p of parts) {
      if (p && typeof p.text === "string") out += p.text;
    }
    return out;
  } catch {
    return "";
  }
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey            Gemini API key (never logged).
 * @param {string} opts.model             e.g. "gemini-flash-latest".
 * @param {string} opts.systemPrompt      System instruction text.
 * @param {Array<{role: "user"|"assistant", content: string}>} opts.messages
 * @param {AbortSignal} [opts.signal]     Forwarded to the upstream fetch.
 * @returns {ReadableStream<Uint8Array>}  Plain-text stream of the answer.
 */
export function streamGemini({ apiKey, model, systemPrompt, messages, signal }) {
  const encoder = new TextEncoder();
  const url =
    `${GEMINI_BASE}/${encodeURIComponent(model)}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1400,
      // Gemini 3.x "flash" thinks by default; a plain grounded summary doesn't
      // need it, and disabling it removes a multi-second first-token delay and
      // stops thinking tokens eating the output budget.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return new ReadableStream({
    async start(controller) {
      const emit = (s) => {
        if (s) controller.enqueue(encoder.encode(s));
      };

      let upstream;
      try {
        upstream = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal,
        });
      } catch (err) {
        if (err && err.name === "AbortError") {
          controller.close();
          return;
        }
        emit(APOLOGY);
        controller.close();
        return;
      }

      if (!upstream.ok || !upstream.body) {
        // Drain and discard the upstream error body so we never surface it or the key.
        try {
          await upstream.text();
        } catch {
          /* ignore */
        }
        emit(APOLOGY);
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleBlock = (block) => {
        // An SSE event block: one or more lines; we care about "data:" lines.
        const dataLines = [];
        for (const raw of block.split("\n")) {
          const line = raw.replace(/\r$/, "");
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).replace(/^ /, ""));
          }
        }
        if (dataLines.length === 0) return;
        const payload = dataLines.join("\n");
        if (payload === "[DONE]") return;
        try {
          emit(textFromEvent(JSON.parse(payload)));
        } catch {
          /* partial or non-JSON keep-alive — ignore */
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // Gemini's SSE uses CRLF line endings; normalise so the blank-line
          // event separator is always "\n\n".
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            handleBlock(block);
          }
        }
        buffer += decoder.decode().replace(/\r\n/g, "\n");
        if (buffer.trim()) handleBlock(buffer);
        controller.close();
      } catch (err) {
        if (err && err.name === "AbortError") {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          controller.close();
          return;
        }
        emit(APOLOGY);
        controller.close();
      }
    },
  });
}

export default streamGemini;
