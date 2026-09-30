import { PageHeader } from "@/components/page-header";
import type { Policy } from "@/content/policies";
import { publicCopy } from "@/lib/messages";

/** A short policy (`/privacy`, `/terms`): numbered sections, reading width. */
export function PolicyPage({ policy }: { policy: Policy }) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title={policy.title}
        lead={
          <>
            {policy.lead}
            <span className="mt-2 block text-sm">
              {publicCopy.updated(policy.updated)}
            </span>
          </>
        }
      />
      <ol className="space-y-6">
        {policy.sections.map((section, i) => (
          <li key={section.title}>
            <section
              aria-labelledby={`policy-${i}`}
              className="space-y-2 border-border border-l-2 pl-4"
            >
              <h2 id={`policy-${i}`} className="heading-section">
                {i + 1}. {section.title}
              </h2>
              {section.body.map((p) => (
                <p key={p} className="leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          </li>
        ))}
      </ol>
    </article>
  );
}
