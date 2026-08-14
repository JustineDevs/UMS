import type { ReactNode } from "react";

export type AdminEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

/**
 * Shared empty state for list pages (orders, queue, workflow).
 */
export function AdminEmptyState({ title, description, action, icon }: AdminEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center sm:p-10">
      {icon ? <div className="mb-4 flex justify-center text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export type AdminErrorStateProps = {
  title: string;
  detail?: string;
  onRetry?: () => void;
};

export function AdminErrorState({ title, detail, onRetry }: AdminErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-foreground"
    >
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-2 text-muted-foreground">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export type AdminLoadingStateProps = {
  label?: string;
};

export function AdminLoadingState({ label = "Loading" }: AdminLoadingStateProps) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
      <span
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
