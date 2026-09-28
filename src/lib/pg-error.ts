/**
 * The Postgres/driver error code of a failed query (`23503` foreign key,
 * `28P01` bad password, `ENOTFOUND`…), or null. Drizzle wraps driver errors
 * in `DrizzleQueryError` with the original as `cause`. Log codes, never
 * messages: those can echo connection details or row data.
 */
export function pgErrorCode(error: unknown): string | null {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.cause?.code ?? e?.code;
  return typeof code === "string" ? code : null;
}

export const FOREIGN_KEY_VIOLATION = "23503";
