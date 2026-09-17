export default function CheckoutLoading() {
  return (
    <main className="storefront-page-shell motion-surface max-w-4xl">
      <div className="mb-6 h-10 w-40 animate-pulse rounded bg-surface-container-high" />
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-2 flex-1 animate-pulse rounded-full bg-surface-container-high" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-surface-container-high" />
        ))}
      </div>
    </main>
  );
}
