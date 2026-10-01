/** Compare databases, including shared Supabase poolers and Neon aliases. */
export function databaseIdentity(connection: string) {
  const url = new URL(connection);
  const database = decodeURIComponent(url.pathname || "/postgres");
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  if (direct) return `supabase:${direct[1]}:${database}`;
  if (url.hostname.endsWith(".pooler.supabase.com")) {
    const project = decodeURIComponent(url.username).split(".").at(-1);
    if (!url.username.includes(".") || !project || !/^[a-z0-9]+$/.test(project))
      throw new Error("Supabase pooler must identify a project.");
    return `supabase:${project}:${database}`;
  }
  const host = url.hostname.endsWith(".neon.tech")
    ? url.hostname.replace("-pooler.", ".")
    : ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ? "loopback"
      : url.hostname;
  return `${host}:${url.port || "5432"}:${database}`;
}
