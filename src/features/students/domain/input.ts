/**
 * Zod schemas of the student admin actions (S6-01), shared by the actions
 * and the forms. Ids are checked here so nothing else reaches SQL.
 */
import { z } from "zod";
import { BULK_LIMIT } from "./list";

export const StudentIdSchema = z.uuid();

export const BulkIdsSchema = z.strictObject({
  ids: z
    .array(StudentIdSchema)
    .min(1)
    .max(BULK_LIMIT)
    .refine((ids) => new Set(ids).size === ids.length),
});
