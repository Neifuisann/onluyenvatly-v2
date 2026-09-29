/**
 * A tiny stand-in for Supabase Storage in E2E (S5-05): signs uploads,
 * accepts the browser's PUT, serves public objects and lists what arrived
 * (`GET /__uploads`). S7-04 adds the private `imports` bucket and the calls
 * the server makes itself (read, upload, list, remove). In memory;
 * test-only, never deployed.
 *
 *   node tests/e2e/fake-storage.ts   (port FAKE_STORAGE_PORT, default 54330)
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const FAKE_STORAGE_PORT = Number(process.env.FAKE_STORAGE_PORT ?? 54330);
export const FAKE_STORAGE_URL = `http://localhost:${FAKE_STORAGE_PORT}`;
export const FAKE_STORAGE_KEY = "e2e-service-key";

type Stored = {
  contentType: string;
  body: Buffer;
  cacheControl: string;
  createdAt: string;
};

function main() {
  const tokens = new Map<string, string>();
  /** Keyed by `bucket/path`. */
  const objects = new Map<string, Stored>();
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, POST, DELETE, OPTIONS",
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
    const authorized =
      req.headers.authorization === `Bearer ${FAKE_STORAGE_KEY}`;
    const store = (key: string) =>
      objects.set(key, {
        contentType: req.headers["content-type"] ?? "",
        cacheControl: String(req.headers["cache-control"] ?? ""),
        body,
        createdAt: new Date().toISOString(),
      });

    if (req.method === "OPTIONS") return send(204, "");
    const sign = url.pathname.match(
      /^\/storage\/v1\/object\/upload\/sign\/(media|imports)\/(.+)$/,
    );
    if (sign && req.method === "POST") {
      if (!authorized) return send(403, { error: "bad key" });
      const token = randomUUID();
      const key = `${sign[1]}/${sign[2]}`;
      tokens.set(token, key);
      return send(200, {
        url: `/object/upload/sign/${key}?token=${token}`,
      });
    }
    if (sign && req.method === "PUT") {
      const key = `${sign[1]}/${sign[2]}`;
      const token = url.searchParams.get("token") ?? "";
      if (tokens.get(token) !== key) return send(403, { error: "bad token" });
      if (objects.has(key)) return send(409, { error: "exists" });
      tokens.delete(token);
      store(key);
      return send(200, { Key: key });
    }
    const pub = url.pathname.match(
      /^\/storage\/v1\/object\/public\/media\/(.+)$/,
    );
    if (pub && req.method === "GET") {
      const o = objects.get(`media/${decodeURIComponent(pub[1] ?? "")}`);
      return o
        ? send(200, o.body, o.contentType)
        : send(404, { error: "not found" });
    }
    const list = url.pathname.match(/^\/storage\/v1\/object\/list\/(\w+)$/);
    if (list && req.method === "POST") {
      if (!authorized) return send(403, { error: "bad key" });
      const { prefix = "" } = JSON.parse(body.toString() || "{}") as {
        prefix?: string;
      };
      const folder = `${list[1]}/${prefix.replace(/\/$/, "")}/`;
      return send(
        200,
        [...objects]
          .filter(
            ([k]) =>
              k.startsWith(folder) && !k.slice(folder.length).includes("/"),
          )
          .map(([k, o]) => ({
            name: k.slice(folder.length),
            id: k,
            created_at: o.createdAt,
          })),
      );
    }
    const bucket = url.pathname.match(
      /^\/storage\/v1\/object\/(media|imports)$/,
    );
    if (bucket && req.method === "DELETE") {
      if (!authorized) return send(403, { error: "bad key" });
      const { prefixes = [] } = JSON.parse(body.toString() || "{}") as {
        prefixes?: string[];
      };
      for (const p of prefixes) objects.delete(`${bucket[1]}/${p}`);
      return send(
        200,
        prefixes.map((name) => ({ name })),
      );
    }
    const object = url.pathname.match(
      /^\/storage\/v1\/object\/(media|imports)\/(.+)$/,
    );
    if (object && (req.method === "GET" || req.method === "POST")) {
      if (!authorized) return send(403, { error: "bad key" });
      const key = `${object[1]}/${decodeURIComponent(object[2] ?? "")}`;
      if (req.method === "POST") {
        if (objects.has(key)) return send(409, { error: "exists" });
        store(key);
        return send(200, { Key: key });
      }
      const o = objects.get(key);
      return o
        ? send(200, o.body, o.contentType)
        : send(400, { error: "not found" });
    }
    if (url.pathname === "/__uploads")
      return send(
        200,
        [...objects]
          .filter(([k]) => k.startsWith("media/"))
          .map(([key, o]) => ({
            path: key.slice("media/".length),
            contentType: o.contentType,
            cacheControl: o.cacheControl,
            bytes: o.body.byteLength,
          })),
      );
    if (url.pathname === "/__imports")
      return send(
        200,
        [...objects]
          .filter(([k]) => k.startsWith("imports/"))
          .map(([key, o]) => ({
            path: key.slice("imports/".length),
            contentType: o.contentType,
            bytes: o.body.byteLength,
          })),
      );
    if (url.pathname === "/health") return send(200, { ok: true });
    return send(404, { error: "no route" });
  }).listen(FAKE_STORAGE_PORT, "localhost");
}

// `pathToFileURL`, not `file://${argv[1]}`: that never matches a Windows path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
