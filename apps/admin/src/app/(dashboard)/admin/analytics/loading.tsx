export default function AnalyticsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading analytics">
      <div className="h-10 w-64 animate-pulse rounded bg-surface-container-low" />
      <div className="grid gap-4 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}
