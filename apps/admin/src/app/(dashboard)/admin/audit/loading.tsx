export default function AuditLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading audit log">
      <div className="h-10 w-64 animate-pulse rounded bg-surface-container-low" />
      <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
    </div>
  );
}
