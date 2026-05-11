export default function AccountLoading() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <div className="mb-6 h-9 w-32 animate-pulse rounded bg-surface-container-high" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-surface-container-high" />
        ))}
      </div>
    </main>
  );
}
