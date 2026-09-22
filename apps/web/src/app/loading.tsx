export default function RootLoading() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-[40vh] p-6">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-surface-container-high" />
        <div className="h-4 w-96 max-w-full rounded bg-surface-container" />
        <div className="h-40 rounded-xl bg-surface-container" />
      </div>
      <span className="sr-only">Loading page</span>
    </main>
  );
}
