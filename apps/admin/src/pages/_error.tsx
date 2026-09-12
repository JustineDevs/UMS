import type { NextPageContext } from "next";

type AdminErrorProps = {
  statusCode?: number;
};

export default function AdminError({ statusCode }: AdminErrorProps) {
  const status = statusCode ?? 500;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-5xl font-extrabold text-primary">{status}</h1>
        <p className="text-sm text-on-surface-variant">
          This admin page is unavailable, or the address may have changed.
        </p>
        <a
          href="/admin"
          className="mt-8 inline-block rounded bg-primary px-6 py-3 text-sm font-medium text-on-primary"
        >
          Back to dashboard
        </a>
      </div>
    </main>
  );
}

AdminError.getInitialProps = ({ res, err }: NextPageContext): AdminErrorProps => ({
  statusCode: res?.statusCode ?? err?.statusCode ?? 500,
});
