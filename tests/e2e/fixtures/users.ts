/**
 * Test-only accounts for the `e2e` seed profile (11 §3). Shared by
 * `scripts/seed.ts` and the Playwright specs. These credentials exist only in
 * local/CI test databases; the seed refuses to write them anywhere else.
 */
export const E2E_PASSWORD = "e2e-Test-2026";

export const e2eAdmin = {
  username: "e2e-admin",
  fullName: "Giáo viên E2E",
} as const;

/**
 * One admin per admin spec and Playwright project: logging in revokes the
 * account's other sessions (single-session policy), so parallel specs must
 * never share an admin.
 */
export const E2E_SPEC_ADMINS = [
  "lessons",
  "editor",
  "publish",
  "media",
  "students",
  "settings",
  "results",
  "stats",
  "explanations",
] as const;
export type E2eSpecAdmin = (typeof E2E_SPEC_ADMINS)[number];
export const e2eSpecAdminUsername = (spec: E2eSpecAdmin, project: string) =>
  `e2e-${spec}-${project === "mobile" ? "m" : "d"}`;
export const e2eSpecAdminUsernames = E2E_SPEC_ADMINS.flatMap((spec) =>
  ["chromium", "mobile"].map((p) => e2eSpecAdminUsername(spec, p)),
);

export const e2eStudents = [
  {
    key: "active",
    phone: "0900000001",
    fullName: "Học Sinh Một",
    status: "active",
    grade: 12,
  },
  {
    key: "active2",
    phone: "0900000002",
    fullName: "Học Sinh Hai",
    status: "active",
    grade: 11,
  },
  {
    key: "active3",
    phone: "0900000003",
    fullName: "Học Sinh Ba",
    status: "active",
    grade: 10,
  },
  // One per Playwright project, so parallel runner specs never share an attempt.
  {
    key: "runner",
    phone: "0900000006",
    fullName: "Học Sinh Làm Bài",
    status: "active",
    grade: 12,
  },
  {
    key: "runner2",
    phone: "0900000007",
    fullName: "Học Sinh Làm Bài Hai",
    status: "active",
    grade: 12,
  },
  // S4-07 profile spec, one per Playwright project.
  {
    key: "profile",
    phone: "0900000008",
    fullName: "Học Sinh Hồ Sơ",
    status: "active",
    grade: 12,
  },
  {
    key: "profile2",
    phone: "0900000009",
    fullName: "Học Sinh Hồ Sơ Hai",
    status: "active",
    grade: 12,
  },
  // S5-04 publish journey, one per Playwright project.
  {
    key: "publish",
    phone: "0900000010",
    fullName: "Học Sinh Xuất Bản",
    status: "active",
    grade: 12,
  },
  {
    key: "publish2",
    phone: "0900000011",
    fullName: "Học Sinh Xuất Bản Hai",
    status: "active",
    grade: 12,
  },
  // S6 student admin spec, one set per Playwright project. The seed resets
  // their status, password and sessions, so the spec can run again.
  {
    key: "queueA",
    phone: "0900000012",
    fullName: "Học Sinh Hàng Đợi A",
    status: "pending",
    grade: 12,
  },
  {
    key: "queueA2",
    phone: "0900000013",
    fullName: "Học Sinh Hàng Đợi A Hai",
    status: "pending",
    grade: 12,
  },
  {
    key: "queueB",
    phone: "0900000014",
    fullName: "Học Sinh Hàng Đợi B",
    status: "pending",
    grade: 11,
  },
  {
    key: "queueB2",
    phone: "0900000015",
    fullName: "Học Sinh Hàng Đợi B Hai",
    status: "pending",
    grade: 11,
  },
  {
    key: "manage",
    phone: "0900000016",
    fullName: "Học Sinh Quản Lý",
    status: "active",
    grade: 12,
  },
  {
    key: "manage2",
    phone: "0900000017",
    fullName: "Học Sinh Quản Lý Hai",
    status: "active",
    grade: 12,
  },
  // Disabled, enabled and logged out by the spec (its own students: five
  // logins a minute per account is the limit).
  {
    key: "access",
    phone: "0900000020",
    fullName: "Học Sinh Truy Cập",
    status: "active",
    grade: 12,
  },
  {
    key: "access2",
    phone: "0900000021",
    fullName: "Học Sinh Truy Cập Hai",
    status: "active",
    grade: 12,
  },
  // Deleted by the spec; the seed inserts them again.
  {
    key: "remove",
    phone: "0900000018",
    fullName: "Học Sinh Sẽ Xóa",
    status: "active",
    grade: 10,
  },
  {
    key: "remove2",
    phone: "0900000019",
    fullName: "Học Sinh Sẽ Xóa Hai",
    status: "active",
    grade: 10,
  },
  // S6-04 results spec, one per Playwright project: the seed gives each the
  // submitted attempts of fixtures/results.ts (grade 10, so the leaderboard
  // spec's grade 11 board is unchanged).
  {
    key: "results",
    phone: "0900000022",
    fullName: "Trần Kết Quả",
    status: "active",
    grade: 10,
  },
  {
    key: "results2",
    phone: "0900000023",
    fullName: "Lê Kết Quả",
    status: "active",
    grade: 10,
  },
  // S7-06 review journey (journey 6), one per Playwright project.
  {
    key: "review",
    phone: "0900000024",
    fullName: "Học Sinh Ôn Tập",
    status: "active",
    grade: 12,
  },
  {
    key: "review2",
    phone: "0900000025",
    fullName: "Học Sinh Ôn Tập Hai",
    status: "active",
    grade: 12,
  },
  {
    key: "pending",
    phone: "0900000004",
    fullName: "Học Sinh Chờ",
    status: "pending",
    grade: 12,
  },
  {
    key: "rejected",
    phone: "0900000005",
    fullName: "Học Sinh Từ Chối",
    status: "rejected",
    grade: 12,
  },
] as const;

export type E2eStudentKey = (typeof e2eStudents)[number]["key"];

/** Each Playwright project takes its own copy of a per-project student. */
export function projectStudentKey(
  base:
    | "queueA"
    | "queueB"
    | "manage"
    | "access"
    | "remove"
    | "results"
    | "review",
  project: string,
): E2eStudentKey {
  return project === "mobile" ? (`${base}2` as E2eStudentKey) : base;
}

/**
 * Username prefix of the admins `admin-settings.spec` creates (one per run and
 * project); the seed removes them.
 */
export const CREATED_ADMIN_PREFIX = "e2e-new-";

/** Name prefix of the students the student spec registers; the seed removes them. */
export const REGISTERED_NAME_PREFIX = "Học Sinh Đăng Ký";

export function e2eStudent(key: E2eStudentKey) {
  const s = e2eStudents.find((x) => x.key === key);
  if (!s) throw new Error(`No e2e student ${key}`);
  return s;
}

/**
 * Rating fixtures (S4-05/07), reset on every seed: a rating plus one change a
 * day ago and, with `earlier`, one more 10 days ago (outside the weekly
 * board). Runner students start unrated and earn theirs in the runner specs,
 * so `active` sits well above anything they can reach.
 */
export const e2eRatings: Partial<
  Record<E2eStudentKey, { rating: number; weekDelta: number; earlier?: number }>
> = {
  active: { rating: 2100, weekDelta: -12 },
  active2: { rating: 1650, weekDelta: 150 },
  // Two points, so the profile chart has a line: 1 500 → 1 520 → 1 560.
  profile: { rating: 1560, weekDelta: 40, earlier: 20 },
  profile2: { rating: 1560, weekDelta: 40, earlier: 20 },
  // Not active accounts: never listed, whatever their rating.
  pending: { rating: 2400, weekDelta: 300 },
  rejected: { rating: 2500, weekDelta: 300 },
};
