import Link from "next/link";
import { AccountRouteNav } from "./AccountRouteNav";

export function AccountRouteFrame({
  eyebrow = "My Account",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="storefront-page-shell storefront-content-wide max-w-[1320px]">
      <div className="grid min-w-0 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start lg:sticky lg:top-28">
          <Link href="/account/profile" className="mb-6 flex items-center gap-3 rounded-xl p-2 hover:bg-surface-container-low">
            <span className="grid size-11 place-items-center rounded-full bg-surface-container-low text-primary">
              <span className="text-lg font-semibold">U</span>
            </span>
            <span>
              <span className="block text-sm font-semibold text-primary">My account</span>
              <span className="mt-0.5 block text-xs text-on-surface-variant">Manage your profile</span>
            </span>
          </Link>
          <AccountRouteNav />
        </aside>

        <div className="min-w-0">
          <header className="mb-6 border-b border-outline-variant/15 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p> : null}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}

export function AccountSignInState({ message = "Sign in to manage this part of your account." }: { message?: string }) {
  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <h2 className="font-headline text-xl font-bold text-primary">Sign in required</h2>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{message}</p>
      <Link href="/login?callbackUrl=%2Faccount%2Fprofile" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90">
        Sign in
      </Link>
    </section>
  );
}

export function AccountUnavailableState({ title, message, actionHref, actionLabel }: { title: string; message: string; actionHref?: string; actionLabel?: string }) {
  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      <h2 className="font-headline text-xl font-bold text-primary">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{message}</p>
      {actionHref && actionLabel ? <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-outline-variant/30 px-5 py-3 text-sm font-semibold text-primary hover:bg-surface-container-low">{actionLabel}</Link> : null}
    </section>
  );
}
