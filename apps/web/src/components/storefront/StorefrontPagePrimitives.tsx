import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type PageWidth = "narrow" | "standard" | "wide";

const pageWidths: Record<PageWidth, string> = {
  narrow: "max-w-3xl",
  standard: "max-w-5xl",
  wide: "max-w-[1440px]",
};

export function StorefrontPageFrame({
  children,
  width = "standard",
  className,
}: {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "storefront-page-shell storefront-content-wide",
        pageWidths[width],
        className,
      )}
    >
      {children}
    </main>
  );
}

export function StorefrontPageHeader({
  eyebrow,
  title,
  description,
  aside,
  className,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-outline-variant/25 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {description}
          </div>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function StorefrontField({
  label,
  id,
  hint,
  className: inputClassName,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  label: string;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-[0.14em] text-primary"
      >
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={cn(
          "min-h-11 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/15",
          inputClassName,
        )}
      />
      {hint ? (
        <p className="text-xs leading-5 text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

export function StorefrontPolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-headline text-lg font-bold leading-6 text-primary sm:text-xl">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StorefrontCard({
  children,
  className,
  as = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
} & Omit<ComponentPropsWithoutRef<"section">, "children" | "className">) {
  const Component = as;
  return (
    <Component
      className={cn(
        "rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-7",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

const actionClasses = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary:
    "border border-outline-variant/30 text-primary hover:bg-surface-container-low",
  quiet:
    "border border-outline-variant/30 text-on-surface-variant hover:border-error hover:text-error",
};

export function StorefrontLinkButton({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof actionClasses;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
        actionClasses[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function StorefrontActionButton({
  children,
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof actionClasses;
}) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        actionClasses[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StorefrontStatus({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variant === "success" && "bg-emerald-50 text-emerald-800",
        variant === "warning" && "bg-amber-50 text-amber-900",
        variant === "neutral" && "bg-surface-container-low text-primary",
      )}
    >
      {children}
    </span>
  );
}
