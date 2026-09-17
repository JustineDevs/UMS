import type { ProductQaRow } from "@/lib/product-qa";

export function ProductQaSection({ entries }: { entries: ProductQaRow[] }) {
  if (entries.length === 0) return null;
  return (
    <section
      className="mt-16 border-t border-outline-variant/20 pt-12 sm:pt-16"
      aria-labelledby="qa-heading"
    >
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/60 p-6 shadow-sm sm:p-8 md:p-10 dark:bg-surface-container-lowest/30">
        <h2
          id="qa-heading"
          className="font-headline text-xl font-bold uppercase tracking-wider text-primary sm:text-2xl"
        >
          Questions &amp; answers
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Official answers from our team. Have another question? Use the contact
          page and reference this product.
        </p>
        <ul className="mt-8 space-y-6">
          {entries.map((q) => (
            <li key={q.id}>
              <article className="rounded-xl border border-outline-variant/15 bg-surface/40 px-5 py-5 sm:px-6 dark:bg-surface/25">
                <p className="text-sm font-semibold text-primary">Q: {q.question}</p>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  {q.answer}
                </p>
                <time
                  className="mt-3 block text-xs text-on-surface-variant/80"
                  dateTime={q.created_at}
                >
                  {new Date(q.created_at).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
