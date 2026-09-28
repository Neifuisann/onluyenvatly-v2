import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
    // Test-only values. Integration tests replace `@/db/client` with PGlite.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      SESSION_PEPPER: "test-pepper-test-pepper-test-pepper-0000",
    },
    // PGlite boots in ~1 s per file.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/features/**", "src/lib/**"],
      exclude: ["**/*.test.*", "**/components/**", "**/*.tsx"],
      thresholds: {
        "src/features/lessons/domain/**": {
          lines: 95,
          functions: 95,
          branches: 85,
          statements: 95,
        },
        // Grading and attempt building decide scores (11 §1: ≥ 95 %).
        "src/features/grading/domain/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        "src/features/attempts/domain/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        "src/features/rating/domain/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        "src/features/auth/core/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
      },
    },
  },
});
