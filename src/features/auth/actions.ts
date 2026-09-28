"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { tags } from "@/lib/cache-tags";
import { env } from "@/lib/env.server";
import { getRequestMeta } from "@/lib/request";
import { err, type FormState } from "@/lib/result";
import { SESSION_COOKIE, sessionCookieOptions } from "./core/cookie";
import { landingPath } from "./core/login-policy";
import { safeNextPath } from "./core/next-path";
import { getCurrentUser } from "./queries";
import { fieldErrorsOf, LoginSchema, RegisterSchema } from "./schemas";
import { loginWithPassword, registerStudent } from "./service";
import { revokeSession, revokeUserSessions } from "./session";

/**
 * Auth actions (05 §2). Login and register are public, so rate limiting is
 * their guard. They take `(prevState, formData)` so the forms work with
 * `useActionState` and without JavaScript.
 */

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
};

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { identifier: text(formData, "identifier") ?? "" };
  const parsed = LoginSchema.safeParse({
    identifier: text(formData, "identifier"),
    password: text(formData, "password"),
    next: text(formData, "next"),
  });
  if (!parsed.success)
    return {
      ...err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) }),
      values,
    };

  const result = await loginWithPassword(parsed.data, await getRequestMeta());
  if (!result.ok) return { ...result, values };

  (await cookies()).set(
    SESSION_COOKIE,
    result.data.token,
    sessionCookieOptions(env.NODE_ENV === "production"),
  );
  redirect(landingPath(result.data.role, safeNextPath(parsed.data.next)));
}

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    fullName: text(formData, "fullName") ?? "",
    phone: text(formData, "phone") ?? "",
    dateOfBirth: text(formData, "dateOfBirth") ?? "",
    grade: text(formData, "grade") ?? "",
    className: text(formData, "className") ?? "",
  };
  const parsed = RegisterSchema.safeParse({
    ...values,
    password: text(formData, "password"),
  });
  if (!parsed.success)
    return {
      ...err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) }),
      values,
    };

  const result = await registerStudent(parsed.data, await getRequestMeta());
  if (!result.ok) return { ...result, values };
  // The admin nav badge counts pending students.
  updateTag(tags.pendingStudents);
  redirect("/register/pending");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await revokeSession(user.sessionId);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function logoutAll(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await revokeUserSessions(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
