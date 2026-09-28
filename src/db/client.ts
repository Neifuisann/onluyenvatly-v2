import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env.server";
import * as schema from "./schema";

/**
 * One pool per function instance, through the Supavisor transaction pooler
 * (:6543). Transaction mode doesn't support prepared statements, hence
 * `prepare: false`. `max: 5` keeps 100 concurrent students well inside the
 * Supabase Free connection limit (08).
 */
function createClient() {
  return postgres(env.DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Reuse the pool across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof createClient>;
};
const client = globalForDb.pgClient ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle({ client, schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Pass a transaction (or the db) to helpers that may run inside one. */
export type Executor = Db | Tx;
