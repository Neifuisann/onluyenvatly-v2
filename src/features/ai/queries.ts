import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { explanationVotes, questionExplanations } from "@/db/schema";
import type { Vote } from "./domain/explain";

export type ReviewExplanation = {
  hash: string;
  contentMd: string;
  reviewed: boolean;
  votesUp: number;
  votesDown: number;
  /** This student's vote. */
  vote: Vote;
};

/**
 * Stored explanations for the questions of one result page, with my vote
 * (per user, uncached): one primary-key lookup per question hash. Only
 * called once the page may show answers.
 */
export async function getReviewExplanations(
  userId: string,
  hashes: readonly string[],
): Promise<Map<string, ReviewExplanation>> {
  if (hashes.length === 0) return new Map();
  const rows = await db
    .select({
      hash: questionExplanations.questionHash,
      contentMd: questionExplanations.contentMd,
      reviewedAt: questionExplanations.reviewedAt,
      votesUp: questionExplanations.votesUp,
      votesDown: questionExplanations.votesDown,
      up: explanationVotes.up,
    })
    .from(questionExplanations)
    .leftJoin(
      explanationVotes,
      and(
        eq(explanationVotes.questionHash, questionExplanations.questionHash),
        eq(explanationVotes.userId, userId),
      ),
    )
    .where(inArray(questionExplanations.questionHash, [...new Set(hashes)]));
  return new Map(
    rows.map((r) => [
      r.hash,
      {
        hash: r.hash,
        contentMd: r.contentMd,
        reviewed: r.reviewedAt !== null,
        votesUp: r.votesUp,
        votesDown: r.votesDown,
        vote: r.up === null ? null : r.up ? "up" : "down",
      },
    ]),
  );
}
