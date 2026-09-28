/**
 * A tiny stand-in for Supabase Storage in E2E (S5-05): signs uploads,
 * accepts the browser's PUT, serves public objects and lists what arrived
 * (`GET /__uploads`). In memory; test-only, never deployed.
 *
 *   node tests/e2e/fake-storage.ts   (port FAKE_STORAGE_PORT, default 54330)
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

export const FAKE_STORAGE_PORT = Number(process.env.FAKE_STORAGE_PORT ?? 54330);
export const FAKE_STORAGE_URL = `http://localhost:${FAKE_STORAGE_PORT}`;
export const FAKE_STORAGE_KEY = "e2e-service-key";

type Stored = { contentType: string; body: Buffer; cacheControl: string };

function main() {
  const tokens = new Map<string, string>();
  const objects = new Map<string, Stored>();
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, POST, OPTIONS",
    "access-control-allow-headers":
      "content-type, cache-control, x-upsert, authorization, apikey",
  };

  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", FAKE_STORAGE_URL);
    const send = (status: number, body: unknown, type = "application/json") => {
      res.writeHead(status, { ...cors, "content-type": type });
      res.end(
        typeof body === "string" || Buffer.isBuffer(body)
          ? body
          : JSON.stringify(body),
      );
    };
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);

    if (req.method === "OPTIONS") return send(204, "");
    const sign = url.pathname.match(
      /^\/storage\/v1\/object\/upload\/sign\/media\/(.+)$/,
    );
    if (sign && req.method === "POST") {
      if (req.headers.authorization !== `Bearer ${FAKE_STORAGE_KEY}`)
        return send(403, { error: "bad key" });
      const token = randomUUID();
      tokens.set(token, sign[1] ?? "");
      return send(200, {
        url: `/object/upload/sign/media/${sign[1]}?token=${token}`,
      });
    }
    if (sign && req.method === "PUT") {
      const path = sign[1] ?? "";
      const token = url.searchParams.get("token") ?? "";
      if (tokens.get(token) !== path) return send(403, { error: "bad token" });
      if (objects.has(path)) return send(409, { error: "exists" });
      tokens.delete(token);
      objects.set(path, {
        contentType: req.headers["content-type"] ?? "",
        cacheControl: String(req.headers["cache-control"] ?? ""),
        body,
      });
      return send(200, { Key: `media/${path}` });
    }
    const pub = url.pathname.match(
      /^\/storage\/v1\/object\/public\/media\/(.+)$/,
    );
    if (pub && req.method === "GET") {
      const o = objects.get(decodeURIComponent(pub[1] ?? ""));
      return o
        ? send(200, o.body, o.contentType)
        : send(404, { error: "not found" });
    }
    if (url.pathname === "/__uploads")
      return send(
        200,
        [...objects].map(([path, o]) => ({
          path,
          contentType: o.contentType,
          cacheControl: o.cacheControl,
          bytes: o.body.byteLength,
        })),
      );
    if (url.pathname === "/health") return send(200, { ok: true });
    return send(404, { error: "no route" });
  }).listen(FAKE_STORAGE_PORT, "localhost");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
