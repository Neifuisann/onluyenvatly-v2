import { describe, expect, it } from "vitest";
import { BulkIdsSchema } from "./input";

const A = "3f2b8c1e-6a4d-4e0b-9c57-1d2e3f4a5b6c";
const B = "8a1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("BulkIdsSchema", () => {
  it("takes 1–200 distinct uuids", () => {
    expect(BulkIdsSchema.safeParse({ ids: [A, B] }).success).toBe(true);
    expect(BulkIdsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: [A, A] }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: ["1; drop table"] }).success).toBe(
      false,
    );
    expect(BulkIdsSchema.safeParse({ ids: [A], extra: 1 }).success).toBe(false);
    const many = Array.from(
      { length: 201 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(BulkIdsSchema.safeParse({ ids: many }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: many.slice(0, 200) }).success).toBe(
      true,
    );
  });
});
