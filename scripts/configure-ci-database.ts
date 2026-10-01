/** Never print the connection. GitHub masks it before later steps can use it. */
import { appendFile } from "node:fs/promises";
import { sessionConnection } from "./lib/session-connection.ts";

const input = process.env.DATABASE_URL_DIRECT;
if (!input || !process.env.GITHUB_ENV)
  throw new Error("CI database configuration is missing.");
const connection = sessionConnection(
  input,
  process.env.SUPABASE_SESSION_POOLER_HOST,
);
if (/[\r\n]/.test(connection)) throw new Error("Invalid connection value.");
console.log(`::add-mask::${connection}`);
await appendFile(process.env.GITHUB_ENV, `DATABASE_URL_DIRECT=${connection}\n`);
