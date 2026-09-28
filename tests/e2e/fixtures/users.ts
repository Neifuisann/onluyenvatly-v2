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

export function e2eStudent(key: E2eStudentKey) {
  const s = e2eStudents.find((x) => x.key === key);
  if (!s) throw new Error(`No e2e student ${key}`);
  return s;
}
