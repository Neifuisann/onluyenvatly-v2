import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * `/admin/settings` reads (S6-03). Per request and uncached: only admins
 * open the page, and a new admin must show at once.
 */

export type AdminAccountRow = {
  id: string;
  fullName: string;
  username: string | null;
  status: "pending" | "active" | "rejected" | "disabled";
  lastLoginAt: Date | null;
};

/** Every admin account (a handful), in accent-free name order. */
export async function getAdmins(): Promise<AdminAccountRow[]> {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(sql`lower(immutable_unaccent(${users.fullName}))`, asc(users.id))
    .limit(200);
}
