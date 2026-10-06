import "server-only";
import { createRng } from "@/features/attempts/domain/random";
import {
  type PublicQuestion,
  withOptionOrder,
} from "@/features/lessons/domain/public-question";
import {
  getLessonForTaking,
  getLessonWithAnswers,
} from "@/features/lessons/queries";
import type { Question } from "@/features/lessons/schema";
import { type BankItem, playerPlan } from "./domain/bank";

/**
 * Bank content from the shared lesson caches (one entry per version), never
 * from the room row: the bank holds references only.
 */

async function aligned<Q extends { id: string }>(
  bank: readonly BankItem[],
  load: (lessonId: number, versionId: number) => Promise<Q[] | null>,
): Promise<Q[] | null> {
  const versions = new Map<number, Promise<Q[] | null>>();
  for (const b of bank)
    if (!versions.has(b.v)) versions.set(b.v, load(b.l, b.v));
  const out = await Promise.all(
    bank.map(async (b) => (await versions.get(b.v))?.find((q) => q.id === b.q)),
  );
  return out.every((q) => q !== undefined) ? (out as Q[]) : null;
}

/** Answer-free questions aligned with the bank. */
export function bankPublicQuestions(bank: readonly BankItem[]) {
  return aligned<PublicQuestion>(bank, getLessonForTaking);
}

/** Questions WITH keys aligned with the bank: the host's report only. */
export function bankQuestions(bank: readonly BankItem[]) {
  return aligned<Question>(bank, getLessonWithAnswers);
}

/**
 * The questions a player still has to answer, in their order and with their
 * option shuffles, answer-free.
 */
export function remainingQuestions(
  publicQuestions: readonly PublicQuestion[],
  seed: number,
  answered: number,
) {
  const plan = playerPlan(
    publicQuestions.map((q) => (q.type === "mcq" ? q.options.length : 0)),
    createRng(seed),
  );
  return plan.order.slice(answered).map((bankIndex) =>
    withOptionOrder(
      publicQuestions[bankIndex] as PublicQuestion,
      plan.options[bankIndex],
    ),
  );
}
