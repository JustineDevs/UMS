import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Button } from "./button";
import { cn } from "../../lib/utils";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface Faq4Props {
  badge?: string;
  title: string;
  description?: string;
  buttonText?: string;
  buttonHref?: string;
  faqs: FaqItem[];
  className?: string;
}

export function Faq4({
  badge,
  title,
  description,
  buttonText,
  buttonHref,
  faqs,
  className,
}: Faq4Props) {
  const leftFaqs = faqs.filter((_, i) => i % 2 === 0);
  const rightFaqs = faqs.filter((_, i) => i % 2 !== 0);

  return (
    <section
      className={cn("mx-auto w-full max-w-5xl px-4 py-16 md:py-24", className)}
    >
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          {badge && (
            <div className="mb-4 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
              {badge}
            </div>
          )}
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
            {title}
          </h2>
          {description && (
            <p className="text-base text-neutral-600 md:text-lg dark:text-neutral-400">
              {description}
            </p>
          )}
        </div>
        {buttonText && buttonHref && (
          <div className="mb-2 shrink-0 md:mb-0">
            <Button asChild size="lg" className="rounded-full">
              <a href={buttonHref}>{buttonText}</a>
            </Button>
          </div>
        )}
      </div>

      <Accordion type="single" collapsible className="w-full">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {leftFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="rounded-2xl border-none bg-neutral-100/70 px-6 transition-all duration-300 data-[state=open]:bg-neutral-100 data-[state=open]:ring-2 data-[state=open]:ring-neutral-950/20 dark:bg-neutral-900/70 dark:data-[state=open]:bg-neutral-900 dark:data-[state=open]:ring-neutral-100/20"
              >
                <AccordionTrigger className="group py-5 hover:no-underline">
                  <span className="pr-4 text-left text-base font-medium text-neutral-950 dark:text-neutral-50">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-5">
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {rightFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="rounded-2xl border-none bg-neutral-100/70 px-6 transition-all duration-300 data-[state=open]:bg-neutral-100 data-[state=open]:ring-2 data-[state=open]:ring-neutral-950/20 dark:bg-neutral-900/70 dark:data-[state=open]:bg-neutral-900 dark:data-[state=open]:ring-neutral-100/20"
              >
                <AccordionTrigger className="group py-5 hover:no-underline">
                  <span className="pr-4 text-left text-base font-medium text-neutral-950 dark:text-neutral-50">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-5">
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </div>
        </div>
      </Accordion>
    </section>
  );
}
