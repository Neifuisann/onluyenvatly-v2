/** CI's IPv4 session connection; credentials and project identity stay intact. */
export function sessionConnection(url: string, poolerHost?: string) {
  const parsed = new URL(url);
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(parsed.hostname);
  if (!direct || !poolerHost) return url;
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(poolerHost))
    throw new Error("Invalid Supabase session pooler host.");
  if (parsed.username !== "postgres")
    throw new Error("Explicit session credentials required for this role.");
  parsed.hostname = poolerHost;
  parsed.username = `postgres.${direct[1]}`;
  parsed.port = "5432";
  parsed.searchParams.set("sslmode", "require");
  return parsed.toString();
}
