import React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Input } from "./input";
import { MdEmail, MdArrowOutward } from "react-icons/md";

interface Newsletter3Props {
  badgeText?: string;
  heading?: string;
  description?: string;
  placeholder?: string;
  privacyPrefix?: string;
  privacyLinkText?: string;
  privacyLinkHref?: string;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

const Newsletter3: React.FC<Newsletter3Props> = ({
  badgeText = "Newsletter",
  heading = "Get the latest, stay inspired",
  description = "Get new instrument drops, restocks, exclusive offers, and studio notes from Universal Music Store.",
  placeholder = "Type your email here...",
  privacyPrefix = "We respect your privacy —",
  privacyLinkText = "learn more",
  privacyLinkHref = "#",
  onSubmit,
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <section className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white py-16 md:py-24 lg:py-32 dark:bg-neutral-950">
      <div className="relative z-10 container mx-auto flex max-w-3xl flex-col items-center px-4 text-center md:px-6">
        {badgeText && (
          <Badge className="mb-2 rounded-full border-none px-4 py-1.5 text-sm font-medium">
            {badgeText}
          </Badge>
        )}

        <h2 className="mb-6 text-3xl font-semibold tracking-tight text-neutral-950 md:text-5xl lg:text-6xl dark:text-neutral-50">
          {heading}
        </h2>

        <p className="mb-10 max-w-2xl text-base leading-relaxed text-neutral-600 md:text-lg lg:text-xl dark:text-neutral-400">
          {description}
        </p>

        <div className="mx-auto flex w-full max-w-lg flex-col items-center">
          <form
            onSubmit={handleSubmit}
            className="group relative mb-5 flex w-full items-center rounded-2xl border border-neutral-200 bg-neutral-100 p-1.5 shadow-sm transition-all hover:shadow-md focus-within:border-neutral-950 focus-within:ring-2 focus-within:ring-neutral-950/20 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-within:border-neutral-100 dark:focus-within:ring-neutral-100/20"
          >
              <div className="pointer-events-none flex items-center justify-center pr-3 pl-4 text-neutral-600 transition-colors group-focus-within:text-neutral-950 dark:text-neutral-400 dark:group-focus-within:text-neutral-100">
              <MdEmail className="h-5 w-5" />
            </div>

            <Input
              name="email"
              type="email"
              aria-label="Email address"
              placeholder={placeholder}
              required
              className="h-12 flex-1 border-none bg-transparent px-0 text-base text-neutral-950 shadow-none placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-lg dark:text-neutral-50 dark:placeholder:text-neutral-400"
            />

            <Button
              type="submit"
              className="ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-neutral-50 shadow-sm transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
              aria-label="Subscribe"
            >
              <MdArrowOutward className="h-5 w-5" />
            </Button>
          </form>

          <p className="text-sm text-neutral-600 md:text-base dark:text-neutral-400">
            {privacyPrefix}
            <a
              href={privacyLinkHref}
              className="font-medium text-neutral-950 underline-offset-4 transition-colors hover:underline dark:text-neutral-50"
            >
              {privacyLinkText}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter3;
