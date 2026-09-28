import "katex/dist/katex.min.css";
import { cacheLife } from "next/cache";
import { cn } from "@/lib/utils";
import { renderMathText } from "./render";

/**
 * Question text renderer (07 §4): Markdown-lite + server-side KaTeX. Server
 * component, cached per text (the output only depends on its input), so a
 * burst of students opening the same test renders each formula once per
 * instance.
 */
export async function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  "use cache";
  cacheLife("max");
  return (
    <div className={cn("math-text", className)}>{renderMathText(text)}</div>
  );
}
