import "server-only";
import { asc, inArray, sql } from "drizzle-orm";
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
  role: "student" | "teacher" | "admin";
  status: "pending" | "active" | "rejected" | "disabled";
  lastLoginAt: Date | null;
};

/** Every teacher and admin account (B-03), in accent-free name order. */
export async function getAdmins(): Promise<AdminAccountRow[]> {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(inArray(users.role, ["teacher", "admin"]))
    .orderBy(sql`lower(immutable_unaccent(${users.fullName}))`, asc(users.id))
    .limit(200);
}
