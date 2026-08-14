import Image from "next/image";
import { cn } from "../lib/utils";

export type AuthSplitShellProps = {
  children: React.ReactNode;
  /**
   * `admin` adds a visual "Admin" watermark on the left panel (md+) and a small staff badge on mobile.
   */
  variant?: "storefront" | "admin";
  /**
   * When true, reserves vertical space for the storefront fixed header. Use false for full-viewport auth (e.g. admin).
   */
  offsetHeader?: boolean;
};

export function AuthSplitShell({
  children,
  variant = "storefront",
  offsetHeader,
}: AuthSplitShellProps) {
  const isAdmin = variant === "admin";
  const logoSrc = isAdmin
    ? "/brand/uvs-logo-landscape.png"
    : "/UVS/UVS_logo_landscape.png";
  const useHeaderOffset =
    offsetHeader ?? (variant === "storefront" ? true : false);

  const asideMarketing = isAdmin
    ? "Staff workspace for Universal Music Store. Sign in to run orders, inventory, POS, and campaigns in one place."
    : "Music retail for instruments and gear. Sign in to track orders, save details, and check out faster.";

  const mainMinH = useHeaderOffset
    ? "min-h-[calc(100vh-5.5rem)] lg:min-h-[calc(100vh-6rem)]"
    : "min-h-[100dvh]";

  return (
    <main className="w-full min-w-0">
      <div
        className={cn(
          "mx-auto grid w-full max-w-[100vw] md:grid-cols-2",
          mainMinH,
        )}
      >
        <aside className="relative hidden flex-col overflow-hidden border-r border-slate-200/90 bg-slate-50 md:flex dark:border-slate-800 dark:bg-slate-950/40">
          {isAdmin ? (
            <>
              <div
                className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
                aria-hidden
              >
                <span className="font-headline -rotate-12 select-none text-[clamp(3.5rem,15vw,12rem)] font-bold uppercase tracking-[0.25em] text-slate-900/[0.06] dark:text-white/[0.06]">
                  Admin
                </span>
              </div>
              <div className="absolute right-4 top-4 z-[2] rounded border border-slate-200/90 bg-white/90 px-3 py-1.5 font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                Staff console
              </div>
            </>
          ) : null}
          <div className="relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-start gap-6 px-8 pb-12 pt-10 lg:gap-7 lg:px-12 lg:pb-16 lg:pt-14">
            <div className="flex w-full max-w-[min(100%,420px)] shrink-0 justify-center sm:max-w-[min(100%,520px)] lg:max-w-[min(100%,640px)] xl:max-w-[min(100%,720px)]">
              <Image
                src={logoSrc}
                alt="Universal Music Store"
                width={1536}
                height={1024}
                className="pointer-events-none h-auto w-full select-none object-contain object-center"
                priority
                sizes="(max-width: 768px) 0px, min(50vw, 720px)"
                unoptimized
              />
            </div>
            <p className="max-w-md text-center font-body text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {asideMarketing}
            </p>
          </div>
        </aside>
        <section
          className={cn(
            "flex flex-col justify-center bg-surface px-6 py-12 sm:px-10 md:min-h-0 md:py-16 lg:px-14",
            mainMinH,
          )}
        >
          {isAdmin ? (
            <div className="mb-6 md:hidden">
              <span className="inline-block rounded border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                Staff console
              </span>
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
