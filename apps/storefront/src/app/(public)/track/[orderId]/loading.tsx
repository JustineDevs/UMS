export default function TrackOrderLoading() {
  return (
    <main className="storefront-page-shell max-w-2xl" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading order tracking</p>
      <div className="mb-6 h-9 w-48 animate-pulse rounded bg-surface-container-high" />
      <div className="space-y-4">
        <div className="h-24 w-full animate-pulse rounded-xl bg-surface-container-high" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface-container-high" />
        <div className="h-48 w-full animate-pulse rounded-xl bg-surface-container-high" />
      </div>
    </main>
  );
}
