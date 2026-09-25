import Link from "next/link";

const linkClass =
  "font-body text-[10px] xs:text-[11px] sm:text-xs tracking-wide text-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap transition-colors";

export function StorefrontUtilityBar() {
  return (
    <div className="relative z-10 isolate pointer-events-none border-b border-white/15 bg-black text-white [&_a]:pointer-events-auto">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-end gap-x-3 overflow-x-auto px-[clamp(0.75rem,3vw,2rem)] py-1 sm:gap-x-4">
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
