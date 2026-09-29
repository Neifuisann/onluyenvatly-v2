/**
 * A tiny stand-in for the Gemini API in E2E (S7-02), so AI journeys run
 * without a key or quota. The app's SDK points here through GEMINI_BASE_URL.
 * `streamGenerateContent` answers a canned explanation in a few SSE chunks,
 * `generateContent` the same text at once; `GET /__calls` lists the prompts
 * received. In memory; test-only, never deployed.
 *
 *   node tests/e2e/fake-gemini.ts   (port FAKE_GEMINI_PORT, default 54331)
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const FAKE_GEMINI_PORT = Number(process.env.FAKE_GEMINI_PORT ?? 54331);
export const FAKE_GEMINI_URL = `http://localhost:${FAKE_GEMINI_PORT}`;
export const FAKE_GEMINI_KEY = "e2e-gemini-key";
export const FAKE_GEMINI_MODEL = "gemini-e2e";

/** What every generation says; the formula checks server-side KaTeX. */
export const FAKE_EXPLANATION = [
  "## Ý chính\n",
  "Tần số là số dao động trong một giây, ",
  "đo bằng héc: $f = \\frac{1}{T}$.\n",
  "- Mẹo: đừng nhầm với chu kì (giây).",
];

/** Editor helpers (S7-05), recognised by their prompts. */
export const FAKE_DESCRIPTION =
  "Bài ôn tập chu kì và tần số của con lắc lò xo.";
export const FAKE_TAGS = ["con lắc lò xo", "chu kì", "ôn tập"];

/** The canned answer for a prompt, split into stream chunks. */
function replyFor(prompt: string): string[] {
  if (prompt.includes("Viết một đoạn mô tả ngắn")) return [FAKE_DESCRIPTION];
  if (prompt.includes("thẻ ngắn")) return [FAKE_TAGS.join(", ")];
  return FAKE_EXPLANATION;
}

type Call = { model: string; method: string; prompt: string };

function main() {
  const calls: Call[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const chunk = (text: string, last: boolean) => ({
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        ...(last && { finishReason: "STOP" }),
      },
    ],
    ...(last && {
      usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 120 },
    }),
    modelVersion: FAKE_GEMINI_MODEL,
  });

  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", FAKE_GEMINI_URL);
    const parts: Buffer[] = [];
    for await (const c of req) parts.push(c as Buffer);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/__calls") return send(200, { calls });

    const match = url.pathname.match(
      /^\/v1beta\/models\/([^/:]+):(streamGenerateContent|generateContent)$/,
    );
    if (!match || req.method !== "POST") return send(404, { error: "nope" });
    if (req.headers["x-goog-api-key"] !== FAKE_GEMINI_KEY)
      return send(403, { error: { code: 403, message: "bad key" } });
    const body = JSON.parse(Buffer.concat(parts).toString() || "{}") as {
      contents?: { parts?: { text?: string }[] }[];
    };
    const prompt = (body.contents ?? [])
      .flatMap((c) => c.parts ?? [])
      .map((p) => p.text ?? "")
      .join("\n");
    const [, model = "", method = ""] = match;
    calls.push({ model, method, prompt });

    const reply = replyFor(prompt);
    if (method === "generateContent")
      return send(200, chunk(reply.join(""), true));
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const [i, text] of reply.entries()) {
      res.write(
        `data: ${JSON.stringify(chunk(text, i === reply.length - 1))}\n\n`,
      );
      await sleep(150);
    }
    res.end();
  }).listen(FAKE_GEMINI_PORT, () => {
    console.log(`fake gemini on ${FAKE_GEMINI_URL}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
