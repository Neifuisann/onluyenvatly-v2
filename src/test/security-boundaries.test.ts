import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve("src");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}
const sources = new Map(
  files(root).map((path) => [path, readFileSync(path, "utf8")]),
);
const directive = (text: string, name: string) =>
  new RegExp(`^[\\s]*["']${name}["'];?`).test(text);

describe("server and secret boundaries", () => {
  it("marks every query and service as server-only", () => {
    const missing = [...sources]
      .filter(
        ([path, text]) =>
          /(?:^|[-\\/])(queries|service)\.ts$/.test(path) &&
          !/import\s+["']server-only["']/.test(text),
      )
      .map(([path]) => relative(root, path));
    expect(missing).toEqual([]);
  });

  it("keeps server modules and Node builtins out of transitive client imports", () => {
    const violations = new Set<string>();
    for (const [start, text] of sources) {
      if (!directive(text, "use client")) continue;
      const seen = new Set<string>();
      const visit = (path: string) => {
        if (seen.has(path)) return;
        seen.add(path);
        const source = sources.get(path);
        if (!source || directive(source, "use server")) return;
        const tree = ts.createSourceFile(
          path,
          source,
          ts.ScriptTarget.Latest,
          true,
        );
        const dependencies: string[] = [];
        const walk = (node: ts.Node) => {
          if (
            ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const clause = node.importClause;
            const named = clause?.namedBindings;
            const typeOnly =
              clause?.isTypeOnly ||
              (named &&
                ts.isNamedImports(named) &&
                !clause?.name &&
                named.elements.every((e) => e.isTypeOnly));
            if (!typeOnly) dependencies.push(node.moduleSpecifier.text);
          } else if (
            ts.isExportDeclaration(node) &&
            !node.isTypeOnly &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            dependencies.push(node.moduleSpecifier.text);
          } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
          ) {
            dependencies.push(node.arguments[0].text);
          }
          ts.forEachChild(node, walk);
        };
        walk(tree);
        for (const dep of dependencies) {
          if (dep === "server-only" || dep.startsWith("node:")) {
            violations.add(
              `${relative(root, start)} -> ${relative(root, path)} -> ${dep}`,
            );
            continue;
          }
          const base = dep.startsWith("@/")
            ? resolve(root, dep.slice(2))
            : dep.startsWith(".")
              ? resolve(dirname(path), dep)
              : undefined;
          if (base) {
            const target = [
              base,
              `${base}.ts`,
              `${base}.tsx`,
              join(base, "index.ts"),
              join(base, "index.tsx"),
            ].find((candidate) => sources.has(candidate));
            if (target) visit(target);
          }
        }
      };
      visit(start);
    }
    expect([...violations]).toEqual([]);
  });

  it("reads runtime secrets only through env.server", () => {
    const exceptions = new Set([
      "lib/env.server.ts",
      "lib/env.client.ts",
      "proxy.ts",
      "instrumentation.ts",
    ]);
    const violations = [...sources]
      .filter(
        ([path, text]) =>
          /\bprocess\.env\b/.test(text) &&
          !exceptions.has(relative(root, path).replaceAll("\\", "/")),
      )
      .map(([path]) => relative(root, path));
    expect(violations).toEqual([]);
    // Proxy's NODE_ENV is a build constant, not a secret (Edge-compatible).
    expect(
      sources.get(resolve(root, "proxy.ts"))?.match(/process\.env\.\w+/g),
    ).toEqual(["process.env.NODE_ENV"]);
    expect(
      new Set(
        sources
          .get(resolve(root, "instrumentation.ts"))
          ?.match(/process\.env\.\w+/g),
      ),
    ).toEqual(new Set(["process.env.NEXT_RUNTIME"]));
    expect(
      sources
        .get(resolve(root, "lib/env.client.ts"))
        ?.match(/process\.env\.\w+/g),
    ).toEqual([
      "process.env.NEXT_PUBLIC_SENTRY_DSN",
      "process.env.NEXT_PUBLIC_MEDIA_BASE_URL",
    ]);
  });
});
