import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { type AttemptItem, lessonVersions } from "@/db/schema";
import type { PublicQuestion } from "@/features/lessons/domain/public-question";
import {
  getLessonForTaking,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import type { Question } from "@/features/lessons/schema";

/**
 * Where each item's question lives. A single-lesson attempt reads one
 * version; a review attempt (S7-06) has no lesson and each item carries its
 * own version (`v`), so the versions' lessons are looked up by primary key
 * (ids only, never content). Content then comes from the shared caches, one
 * entry per version.
 */

type AttemptRef = {
  lessonId: number | null;
  lessonVersionId: number | null;
  items: readonly AttemptItem[];
};

export type ItemSource = { lessonId: number; versionId: number };

/** Aligned with `items`; null if a version is gone or an item has none. */
export async function itemSources(a: AttemptRef): Promise<ItemSource[] | null> {
  const versionOf = (item: AttemptItem) => item.v ?? a.lessonVersionId;
  if (a.lessonId !== null) {
    const lessonId = a.lessonId;
    const out = a.items.map((item) => {
      const versionId = versionOf(item);
      return versionId === null ? null : { lessonId, versionId };
    });
    return out.every((s) => s !== null) ? out : null;
  }
  const ids = [
    ...new Set(a.items.flatMap((i) => (i.v === undefined ? [] : [i.v]))),
  ];
  if (ids.length === 0) return null;
  const rows = await db
    .select({ id: lessonVersions.id, lessonId: lessonVersions.lessonId })
    .from(lessonVersions)
    .where(inArray(lessonVersions.id, ids));
  const lessonOf = new Map(rows.map((r) => [r.id, r.lessonId]));
  const out = a.items.map((item) => {
    const lessonId = item.v === undefined ? undefined : lessonOf.get(item.v);
    return lessonId === undefined || item.v === undefined
      ? null
      : { lessonId, versionId: item.v };
  });
  return out.every((s) => s !== null) ? out : null;
}

async function aligned<Q extends { id: string }>(
  items: readonly AttemptItem[],
  sources: readonly ItemSource[],
  load: (lessonId: number, versionId: number) => Promise<Q[] | null>,
): Promise<Q[] | null> {
  const keys = [
    ...new Map(sources.map((s) => [s.versionId, s.lessonId])).entries(),
  ];
  const versions = new Map(
    await Promise.all(
      keys.map(
        async ([versionId, lessonId]) =>
          [versionId, await load(lessonId, versionId)] as const,
      ),
    ),
  );
  const out: Q[] = [];
  for (const [i, item] of items.entries()) {
    const source = sources[i];
    const q = source
      ? versions.get(source.versionId)?.find((x) => x.id === item.q)
      : undefined;
    if (!q) return null;
    out.push(q);
  }
  return out;
}

/**
 * The questions WITH ANSWERS, aligned with `items`. Server-only: grading,
 * practice feedback, and the result page once answers may be shown.
 */
export async function itemQuestions(
  a: AttemptRef,
  sources?: readonly ItemSource[] | null,
): Promise<Question[] | null> {
  const src = sources ?? (await itemSources(a));
  return src ? aligned(a.items, src, getLessonWithAnswers) : null;
}

/** The answer-free questions, aligned with `items` (options unshuffled). */
export async function itemPublicQuestions(
  a: AttemptRef,
  sources?: readonly ItemSource[] | null,
): Promise<PublicQuestion[] | null> {
  const src = sources ?? (await itemSources(a));
  return src ? aligned(a.items, src, getLessonForTaking) : null;
}
