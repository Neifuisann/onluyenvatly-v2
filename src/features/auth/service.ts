import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSettings } from "@/features/settings/queries";
import { fieldMessages } from "@/lib/messages";
import { rateLimitAll } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { parseIdentifier, type Role, statusError } from "./core/login-policy";
import { hashPassword, verifyPassword } from "./core/password";
import type { LoginInput, RegisterInput } from "./schemas";
import { createSession, revokeUserSessions, type SessionMeta } from "./session";

/** 06 §4. Tune here only; the integration tests read these values. */
export const AUTH_LIMITS = {
  loginPerIp: [20, "10m"],
  loginPerIdentifierMinute: [5, "1m"],
  loginPerIdentifierHour: [20, "1h"],
  registerPerIp: [3, "1h"],
} as const;

/** Rate-limit keys never hold a raw phone number. */
const keyOf = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

export async function loginWithPassword(
  input: Pick<LoginInput, "identifier" | "password">,
  meta: SessionMeta,
  now = new Date(),
): Promise<Result<{ token: string; role: Role }>> {
  const identifier = parseIdentifier(input.identifier);
  const idKey = keyOf(
    identifier?.value ?? input.identifier.trim().toLowerCase(),
  );
  const limit = await rateLimitAll(
    [
      ...(meta.ip
        ? [[`login:ip:${meta.ip}`, ...AUTH_LIMITS.loginPerIp] as const]
        : []),
      [`login:id:${idKey}`, ...AUTH_LIMITS.loginPerIdentifierMinute],
      [`login:id:${idKey}`, ...AUTH_LIMITS.loginPerIdentifierHour],
    ],
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");

  const user = identifier
    ? await db.query.users.findFirst({
        columns: { id: true, role: true, status: true, passwordHash: true },
        where:
          identifier.kind === "phone"
            ? eq(users.phone, identifier.value)
            : eq(users.username, identifier.value),
      })
    : undefined;

  // Same message and roughly the same time for "no such user" and "wrong password".
  const valid = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !valid) return err("INVALID_CREDENTIALS");

  const blocked = statusError(user.status);
  if (blocked) return err(blocked);

  const { singleSession } = await getSettings();
  const token = await db.transaction(async (tx) => {
    if (singleSession) await revokeUserSessions(user.id, undefined, tx);
    const session = await createSession(user.id, meta, now, tx);
    await tx
      .update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, user.id));
    return session.token;
  });
  return ok({ token, role: user.role });
}

export async function registerStudent(
  input: RegisterInput,
  meta: SessionMeta,
  now = new Date(),
): Promise<Result<{ id: string }>> {
  if (meta.ip) {
    const limit = await rateLimitAll(
      [[`register:ip:${meta.ip}`, ...AUTH_LIMITS.registerPerIp]],
      now,
    );
    if (!limit.ok) return err("RATE_LIMITED");
  }

  const { registrationOpen } = await getSettings();
  if (!registrationOpen) return err("REGISTRATION_CLOSED");

  const phoneTaken = () =>
    err("CONFLICT", { fieldErrors: { phone: fieldMessages.phoneTaken } });
  const existing = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.phone, input.phone),
  });
  if (existing) return phoneTaken();

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({
      role: "student",
      status: "pending",
      fullName: input.fullName,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      grade: input.grade,
      className: input.className,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: users.phone })
    .returning({ id: users.id });
  // Lost a race with a parallel registration for the same phone.
  if (!created) return phoneTaken();
  return ok({ id: created.id });
}
