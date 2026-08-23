import Link from "next/link";

const linkClass =
  "font-body text-[10px] xs:text-[11px] sm:text-xs tracking-wide text-on-primary/90 hover:text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary whitespace-nowrap transition-colors";

export function StorefrontUtilityBar() {
  return (
    <div className="border-b border-on-primary/15 bg-primary text-on-primary">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-[clamp(0.75rem,3vw,2rem)] py-1 sm:justify-end sm:gap-x-4 sm:gap-y-0">
        <span className="sr-only">Utility links</span>
        <Link href="/track" className={linkClass}>
          Track order
        </Link>
        <Link href="/help" className={linkClass}>
          Help
        </Link>
        <Link href="/faq" className={linkClass}>
          FAQ
        </Link>
        <Link href="/contact" className={linkClass}>
          Contact
        </Link>
        <Link href="/search" className={linkClass}>
          Search
        </Link>
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
        <Link href="/preferences" className={linkClass}>
          Local preferences
        </Link>
      </div>
    </div>
  );
}
