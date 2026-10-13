import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { renderMathText } from "./render";

/**
 * Question text renderer (07 §4): Markdown-lite + server-side KaTeX. Server
 * component; each formula is rendered once per instance (`renderTex`).
 */
export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn("math-text", className)}>{renderMathText(text)}</div>
  );
}
