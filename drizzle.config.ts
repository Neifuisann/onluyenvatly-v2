import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local dev reads .env.local; CI passes env vars directly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// `pnpm db:generate` needs no database. `pnpm db:migrate` uses the direct
// (session) URL, never the transaction pooler.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
