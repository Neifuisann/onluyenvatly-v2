import "server-only";
import { headers } from "next/headers";

/**
 * Client IP and user agent for rate limits and the sessions list.
 * On Vercel the first `x-forwarded-for` entry is the client.
 */
export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  return {
    ip: parseClientIp(h.get("x-forwarded-for") ?? h.get("x-real-ip")),
    userAgent: h.get("user-agent"),
  };
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

/** Returns a value safe for an `inet` column, or null. */
export function parseClientIp(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first) return null;
  if (IPV4.test(first) && first.split(".").every((n) => Number(n) <= 255))
    return first;
  if (first.includes(":") && IPV6.test(first) && first.length <= 45)
    return first;
  return null;
}
