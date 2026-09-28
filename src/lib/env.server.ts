import "server-only";
import { parseEnv } from "./env";

/** Server-side env. Import this (never `process.env`) from server code. */
export const env = parseEnv(process.env);
