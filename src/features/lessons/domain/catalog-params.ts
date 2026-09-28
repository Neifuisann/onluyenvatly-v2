/** Untrusted `/lessons` search params → CatalogFilters (server side, Zod). */
import { z } from "zod";
import { CATALOG_SORTS, type CatalogFilters, MAX_PAGE } from "./catalog.ts";

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.normalize("NFC").replace(/\s+/g, " ").trim();

const text = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .catch(null)
    .transform((s) => s || null);

const FiltersSchema = z.object({
  q: text(80),
  grade: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(11), z.literal(12)]))
    .nullable()
    .catch(null),
  chapter: text(100),
  tag: text(50),
  sort: z.enum(CATALOG_SORTS).catch("order"),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});

/** Never throws: anything invalid falls back to its default. */
export function parseCatalogParams(params: RawParams): CatalogFilters {
  const pick = (k: string) => first(params[k]) || null;
  return FiltersSchema.parse({
    q: pick("q"),
    grade: pick("grade"),
    chapter: pick("chapter"),
    tag: pick("tag"),
    sort: pick("sort") ?? "order",
    page: pick("page") ?? 1,
  }) as CatalogFilters;
}
