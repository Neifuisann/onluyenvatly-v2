import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS } from "./legacy-redirects";

/**
 * A small stand-in for Next's path matching: `:name` is one segment and
 * `:name*` zero or more. Enough for the table, which uses nothing else.
 */
function compile(source: string) {
  const names: string[] = [];
  const pattern = source
    .split("/")
    .map((part) => {
      const star = /^:(\w+)\*$/.exec(part);
      if (star?.[1]) {
        names.push(star[1]);
        return "?(.*)";
      }
      const param = /^:(\w+)$/.exec(part);
      if (param?.[1]) {
        names.push(param[1]);
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}$`), names };
}

/** The destination of the first rule that matches, as Next would pick it. */
function resolve(path: string): string | null {
  for (const rule of LEGACY_REDIRECTS) {
    const { regex, names } = compile(rule.source);
    const match = regex.exec(path);
    if (!match) continue;
    return names.reduce(
      (dest, name, i) =>
        dest.replace(new RegExp(`:${name}\\*?`), match[i + 1] ?? ""),
      rule.destination,
    );
  }
  return null;
}

const APP = join(process.cwd(), "src", "app");

/** Does `src/app` serve this path (a page or route, route groups ignored)? */
function routeExists(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    );
    // Route groups `(x)` don't add a segment.
    for (const group of entries.filter((e) => /^\(.+\)$/.test(e.name)))
      if (walk(join(dir, group.name), rest)) return true;
    if (rest.length === 0)
      return ["page.tsx", "route.ts"].some((f) => existsSync(join(dir, f)));
    const [head, ...tail] = rest;
    const exact = entries.find((e) => e.name === head);
    if (exact && walk(join(dir, exact.name), tail)) return true;
    const dynamic = entries.find((e) => /^\[[^.]+\]$/.test(e.name));
    return dynamic ? walk(join(dir, dynamic.name), tail) : false;
  };
  return walk(APP, segments);
}

describe("LEGACY_REDIRECTS (05 §1)", () => {
  it.each([
    ["/student/login", "/login"],
    ["/admin/login", "/login"],
    ["/student/register", "/register"],
    ["/lesson/1712345678901", "/lessons/by-legacy/1712345678901"],
    ["/lesson/last-incomplete", "/dashboard"],
    ["/share/lesson/1712345678901", "/share/lessons/by-legacy/1712345678901"],
    ["/result/abc-123", "/attempts/by-legacy/abc-123"],
    ["/result", "/profile"],
    ["/student/dashboard", "/dashboard"],
    ["/multiplechoice", "/lessons"],
    ["/truefalse", "/lessons"],
    ["/quizgame", "/lessons"],
    ["/student/profile", "/profile"],
    ["/student/results", "/profile"],
    ["/student/rating", "/leaderboard"],
    ["/study-materials", "/ly-thuyet"],
    ["/review-mistakes", "/review"],
    ["/practice", "/review"],
    ["/history", "/admin/results"],
    ["/admin/new", "/admin/lessons/create"],
    ["/admin/lessons/new", "/admin/lessons/create"],
    ["/admin/edit/1712345678901", "/admin/lessons"],
    ["/admin/configure", "/admin/lessons"],
    ["/admin/configure/1712345678901", "/admin/lessons"],
    ["/admin/lessons/1712345678901/statistics", "/admin/lessons"],
    ["/admin/statistics", "/admin"],
    ["/admin/ai-tools", "/admin/lessons/create?mode=file"],
    ["/admin/import", "/admin/lessons/create?mode=file"],
  ])("%s → %s", (from, to) => {
    expect(resolve(from)).toBe(to);
  });

  it("leaves v2 routes alone", () => {
    for (const path of [
      "/",
      "/login",
      "/lessons",
      "/lessons/12",
      "/attempts/0f8fad5b-d9cb-469f-a165-70867728950e/result",
      "/admin/lessons",
      "/admin/lessons/12/edit",
      "/admin/lessons/12/stats",
      "/admin/lessons/create",
      "/share/lessons/12",
      "/ly-thuyet",
      "/gallery",
      "/profile",
      "/review",
    ])
      expect(resolve(path), path).toBeNull();
  });

  it("points every rule at a route that exists", () => {
    for (const { destination } of LEGACY_REDIRECTS) {
      // A query (`?mode=file`) picks a view of the page, not another route.
      const [path = ""] = destination.replace(/:\w+\*?/g, "x").split("?");
      expect(routeExists(path), destination).toBe(true);
    }
  });

  it("has no duplicate sources and never redirects to itself", () => {
    const sources = LEGACY_REDIRECTS.map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const r of LEGACY_REDIRECTS) expect(r.destination).not.toBe(r.source);
  });
});
