export default function ProductLoading() {
  return (
    <main className="storefront-page-shell storefront-pdp-shell w-full">
      <div className="mb-6 flex items-center gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-surface-container-high" />
        <div className="h-3 w-2 animate-pulse rounded bg-surface-container-high" />
        <div className="h-3 w-16 animate-pulse rounded bg-surface-container-high" />
        <div className="h-3 w-2 animate-pulse rounded bg-surface-container-high" />
        <div className="h-3 w-32 animate-pulse rounded bg-surface-container-high" />
      </div>
      <div className="grid w-full grid-cols-1 items-start gap-10 xl:grid-cols-2 xl:gap-16">
        <div className="aspect-square w-full animate-pulse rounded-xl bg-surface-container-high" />
        <div className="space-y-6">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-container-high" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-surface-container-high" />
          <div className="h-4 w-20 animate-pulse rounded bg-surface-container-high" />
          <div className="h-8 w-32 animate-pulse rounded bg-surface-container-high" />
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-10 animate-pulse rounded-full bg-surface-container-high" />
            ))}
          </div>
          <div className="h-12 w-full animate-pulse rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
