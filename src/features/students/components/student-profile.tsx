import { TierBadge } from "@/features/rating/components/tier-badge";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import type { StudentDetail } from "../admin-queries";
import { studentsCopy as t } from "../messages";
import { StatusBadge } from "./status-badge";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

/** Profile fields (admins may see the phone and birth date) and the rating. */
export function StudentProfile({ student }: { student: StudentDetail }) {
  const { rating } = student;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        aria-labelledby="student-profile"
        className="rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
      >
        <h2 id="student-profile" className="mb-3 font-semibold">
          {t.profile}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label={t.phone}>{student.phone ?? "—"}</Field>
          <Field label={t.status}>
            <StatusBadge status={student.status} />
            {student.mustChangePassword && (
              <span className="mt-1 block text-muted-foreground text-xs">
                {t.mustChange}
              </span>
            )}
          </Field>
          <Field label={t.dateOfBirth}>
            {student.dateOfBirth ? formatDateOnly(student.dateOfBirth) : "—"}
          </Field>
          <Field label={t.class}>
            {[student.className, student.grade && t.gradeShort(student.grade)]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Field>
          <Field label={t.registered}>
            {formatDateTime(student.createdAt)}
          </Field>
          <Field label={t.approvedAt}>
            {student.approvedAt ? formatDateTime(student.approvedAt) : "—"}
          </Field>
          <Field label={t.lastLoginAt}>
            {student.lastLoginAt
              ? formatDateTime(student.lastLoginAt)
              : t.neverLoggedIn}
          </Field>
        </dl>
      </section>

      <section
        aria-labelledby="student-rating"
        className="rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
      >
        <h2 id="student-rating" className="mb-3 font-semibold">
          {t.ratingSection}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label={t.ratingNow}>
            {rating ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-lg tabular-nums">
                  {rating.rating}
                </span>
                <TierBadge rating={rating.rating} />
              </span>
            ) : (
              t.unrated
            )}
          </Field>
          <Field label={t.ratingPeak}>{rating ? rating.peak : "—"}</Field>
          <Field label={t.ratedAttempts}>
            {rating ? rating.ratedAttempts : 0}
          </Field>
          <Field label={t.attemptTotal}>{student.attemptTotal}</Field>
        </dl>
      </section>
    </div>
  );
}
