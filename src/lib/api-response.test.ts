import { describe, expect, it } from "vitest";
import { jsonResult, readJsonBody } from "./api-response";
import { err, ok } from "./result";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://x.vn/api", { method: "POST", body, headers });

describe("jsonResult", () => {
  it("maps results to status codes and never caches", async () => {
    const good = jsonResult(ok({ a: 1 }));
    expect(good.status).toBe(200);
    expect(good.headers.get("cache-control")).toBe("no-store");
    expect(await good.json()).toEqual({ ok: true, data: { a: 1 } });
    expect(jsonResult(err("UNAUTHENTICATED")).status).toBe(401);
    expect(jsonResult(err("ATTEMPT_CLOSED")).status).toBe(409);
    expect(jsonResult(err("ACCOUNT_PENDING")).status).toBe(400);
  });
});

describe("readJsonBody", () => {
  it("parses JSON sent as any content type", async () => {
    expect(
      await readJsonBody(
        post('{"a":[1]}', { "content-type": "text/plain" }),
        100,
      ),
    ).toEqual({ ok: true, data: { a: [1] } });
  });

  it("refuses oversized and malformed bodies", async () => {
    expect(await readJsonBody(post("x".repeat(101)), 100)).toMatchObject({
      code: "VALIDATION",
    });
    expect(
      await readJsonBody(post("{}", { "content-length": "999" }), 100),
    ).toMatchObject({ code: "VALIDATION" });
    expect(await readJsonBody(post("{oops"), 100)).toMatchObject({
      code: "VALIDATION",
    });
  });
});
