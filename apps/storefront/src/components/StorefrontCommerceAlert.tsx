import type { CommerceFetchFailure } from "@/lib/catalog-fetch";

type Props = { failure: CommerceFetchFailure };

export function StorefrontCommerceAlert({ failure }: Props) {
  if (failure.kind === "misconfigured") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
      >
        <p className="font-semibold">The shop cannot show products yet</p>
        <p className="mt-1 opacity-90 leading-relaxed">
          This usually means the website is still being connected to your store. Ask whoever
          manages or built this site to finish the connection settings.
        </p>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium opacity-90 select-none">
            Details for technical support
          </summary>
          <p className="mt-2 font-mono whitespace-pre-wrap opacity-90">{failure.detail}</p>
        </details>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-950 dark:text-red-100"
    >
      <p className="font-semibold">Products are temporarily unavailable</p>
      <p className="mt-1 opacity-90 leading-relaxed">
        Please try again in a few minutes. If this keeps happening, contact support.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-medium opacity-90 select-none">
          Details for technical support
        </summary>
        <p className="mt-2 font-mono whitespace-pre-wrap opacity-90">{failure.message}</p>
      </details>
    </div>
  );
}
