import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { SOLVES_PER_HOUR } from "./domain/solve";
import { solveCopy } from "./messages";
import { solveImport } from "./solve-service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const PATH = "2026/10/0b5f2d4e-8c1a-4f7e-9d3b-2a6c8e1f0a9b.pdf";
const PDF = new TextEncoder().encode("%PDF-1.7\nfake");
const solver = {
  url: "https://solver.test/v1",
  key: "k",
  model: "m",
  effort: "high" as const,
};
const storage = { url: "https://storage.test", serviceKey: "key" };
const TEXT = "Câu 1: Hỏi\nA. x\nB. y\n\nCâu 2: Tính\nAnswer:";
const REPLY = '{"answers":[{"q":1,"choice":"B"},{"q":2,"value":"2.8"}]}';

/** The solver streams REPLY in two SSE chunks; Storage serves the PDF. */
function fakeFetch(reply = REPLY, status = 200) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://storage.test"))
        return url.endsWith(PATH)
          ? new Response(PDF)
          : new Response("{}", { status: 400 });
      sent.push({ url, body: JSON.parse(String(init?.body)) });
      const half = Math.ceil(reply.length / 2);
      const sse = [reply.slice(0, half), reply.slice(half)]
        .map(
          (c) =>
            `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`,
        )
        .join("");
      return new Response(`${sse}data: [DONE]\n\n`, { status });
    },
  );
  return { fetchFn: fetchFn as unknown as typeof fetch, sent };
}

let admin: { id: string };
const open = async () => ({ ok: true }) as const;

beforeEach(async () => {
  await resetDb(tdb);
  const [u] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Giáo viên",
      username: "gv",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  admin = { id: u?.id ?? "" };
});

describe("solveImport", () => {
  it("sends the text and the PDF, then fills the answers", async () => {
    const { fetchFn, sent } = fakeFetch();
    const result = await solveImport(
      admin,
      { text: TEXT, path: PATH },
      { solver, storage, gate: open, now: NOW, fetchFn, log: () => {} },
    );
    expect(result).toEqual({
      ok: true,
      data: {
        text: "Câu 1: Hỏi\nA. x\n*B. y\n\nCâu 2: Tính\nAnswer: 2,8",
        filled: [1, 2],
      },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://solver.test/v1/chat/completions");
    const body = sent[0]?.body as {
      model: string;
      reasoning_effort: string;
      messages: { role: string; content: unknown }[];
    };
    expect(body.model).toBe("m");
    expect(body.reasoning_effort).toBe("high");
    const user = body.messages[1]?.content as {
      type: string;
      file?: { file_data: string };
      text?: string;
    }[];
    expect(user[0]?.type).toBe("file");
    expect(user[0]?.file?.file_data).toMatch(/^data:application\/pdf;base64,/);
    expect(user[1]?.text).toContain("Hãy giải các câu: 1, 2.");
  });

  it("solves from the text alone when the file is gone", async () => {
    const { fetchFn, sent } = fakeFetch();
    const result = await solveImport(
      admin,
      { text: TEXT, path: PATH.replace("0b5f", "1b5f") },
      { solver, storage, gate: open, now: NOW, fetchFn, log: () => {} },
    );
    expect(result.ok).toBe(true);
    const user = (
      sent[0]?.body.messages as { content: { type: string }[] }[]
    )[1]?.content;
    expect(user?.map((p) => p.type)).toEqual(["text"]);
  });

  it("does nothing when every question has an answer", async () => {
    const { fetchFn, sent } = fakeFetch();
    const text = "Câu 1: Hỏi\n*A. x\nB. y";
    expect(
      await solveImport(admin, { text }, { solver, fetchFn, gate: open }),
    ).toEqual({ ok: true, data: { text, filled: [] } });
    expect(sent).toHaveLength(0);
  });

  it("is unavailable without a solver, closed gate or a bad reply", async () => {
    const { fetchFn } = fakeFetch("Xin lỗi, tôi không giải được.");
    const deps = { storage: null, now: NOW, fetchFn, log: () => {} };
    expect(
      await solveImport(admin, { text: TEXT }, { ...deps, solver: null }),
    ).toMatchObject({ ok: false, message: solveCopy.unavailable });
    expect(
      await solveImport(
        admin,
        { text: TEXT },
        {
          ...deps,
          solver,
          gate: async () => ({
            ok: false,
            code: "AI_QUOTA",
            reason: "budget",
          }),
        },
      ),
    ).toMatchObject({ ok: false, code: "AI_QUOTA", message: solveCopy.quota });
    expect(
      await solveImport(admin, { text: TEXT }, { ...deps, solver, gate: open }),
    ).toMatchObject({ ok: false, message: solveCopy.failed });
  });

  it("reports an overloaded model and limits solves per hour", async () => {
    const { fetchFn } = fakeFetch("{}", 429);
    const deps = {
      solver,
      storage: null,
      gate: open,
      now: NOW,
      fetchFn,
      log: () => {},
    };
    expect(await solveImport(admin, { text: TEXT }, deps)).toMatchObject({
      ok: false,
      code: "AI_QUOTA",
      message: solveCopy.busy,
    });
    for (let i = 1; i < SOLVES_PER_HOUR; i++)
      await solveImport(admin, { text: TEXT }, deps);
    expect(await solveImport(admin, { text: TEXT }, deps)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
    });
  });
});
