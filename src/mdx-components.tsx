import type { MDXComponents } from "mdx/types";
import {
  Callout,
  Formula,
  MdxLink,
  Table,
} from "@/features/materials/components/mdx";

/**
 * Required by @next/mdx (App Router). The theory pages (S8-02) may use these
 * components; everything else is plain Markdown.
 */
const components: MDXComponents = { Callout, Formula, Table, a: MdxLink };

export function useMDXComponents(): MDXComponents {
  return components;
}
