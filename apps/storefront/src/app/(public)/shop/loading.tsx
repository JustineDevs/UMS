export default function ShopLoading() {
  return (
    <main className="storefront-page-shell">
      <div className="mb-8 h-9 w-40 animate-pulse rounded bg-surface-container-high" />
      <div className="flex gap-8">
        <div className="hidden w-56 shrink-0 space-y-6 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-20 animate-pulse rounded bg-surface-container-high" />
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="h-3 w-32 animate-pulse rounded bg-surface-container-high" />
              ))}
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-surface-container-high" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-container-high" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
