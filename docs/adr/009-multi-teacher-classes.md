# ADR-009: Multiple teachers, classes and subjects
- **Status:** Proposed
- **Date:** 2026-10-11

## Context
v2 was built for one physics teacher: every admin saw every lesson, every active student saw every published lesson, and new students waited in an approval queue. The owner wants the site to work like Azota for many teachers and subjects: each teacher manages their own classes and lessons, other teachers never see them, students register without approval and only see the lessons of the classes a teacher put them in (several classes per student, several classes per teacher). This is backlog item B-03.

## Options
1. **Tenant per teacher (schema or `tenant_id` on every table).** Strong isolation, but students belong to several teachers' classes, so a student row can't live in one tenant; every query and the rating would need rework. Too much for the free-tier budget and the timeline.
2. **Ownership columns + classes as the only bridge to students (chosen).** `lessons.owner_id`, `classes(owner_id)`, `class_members`, `class_lessons`. Teachers' reads and writes filter by owner in the queries and services; students reach lessons only through class membership. One new indexed read on the lesson page and on start.
3. **Keep one shared catalog and only add classes as a filter.** Cheapest, but teachers would see each other's lessons and results, which the owner ruled out.

## Decision
Option 2.
- **Roles:** `student`, `teacher`, `admin`. A teacher sees and manages only their own lessons, classes, game rooms, and the students of their classes (attempts on their own lessons). An admin is a teacher who also runs the platform: settings and staff accounts, audit, AI explanation review, student account tools (password, sessions, status, deletion), and reaches every teacher's data (as every admin did before). Guards: `requireTeacher()` for the `/admin` workspace, `requireAdmin()` for platform pages and actions.
- **Isolation lives in the data layer:** every teacher query and mutation carries the owner condition (`lessons/ownership.ts`, `classOwnedBy`, `visibleTo`, `hosts`); another teacher's id reads as NOT_FOUND. Tests cover each one with a second teacher.
- **Students:** registration creates an active account and signs it in; with no class the student is told to give their phone number to the teacher. The teacher adds students by phone number (bulk paste). A student may open a lesson iff a non-archived class they are in has it (`canOpenLesson`). `/lessons` becomes `/classes` → `/classes/[id]` (the existing catalog per class, shared-cached per class).
- **Leaderboards** rank one class's members (the rating itself stays global for now).
- **Subjects** are a code list in `src/lib/subjects.ts` stored on lessons and classes (no table, no DB check: adding a subject is a code change).
- **Migration 0017** keeps existing deployments working: lessons get `owner_id = created_by` (else the first admin), pending students are activated, and one class per lesson owner holds every active student and that owner's lessons.

## Consequences
- One extra indexed query per lesson page view and per start for students (membership join over primary keys and `class_members_user_idx`), within the 08 budget. Membership is per-user data, so it is never shared-cached; the class catalog is shared per class (`class:{id}:lessons`).
- `/admin/results` and the dashboard join lessons for the owner filter; fine at current volume, revisit with an index on `attempts(lesson_id, submitted_at)` if a teacher's view gets slow among many teachers.
- The global rating mixes subjects; a per-subject rating is future work.
- Teachers can't share lessons with each other yet (no co-ownership or lesson copy between teachers); grade checks stay 10–12 (THPT).
- Branding ("Ôn Luyện Vật Lý") and the theory pages are still physics-only.
