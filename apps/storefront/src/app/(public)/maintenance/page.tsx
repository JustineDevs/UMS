import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="storefront-page-shell flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-headline text-2xl font-bold text-primary sm:text-3xl">
        We will be right back
      </h1>
      <p className="mt-4 max-w-md text-sm text-on-surface-variant leading-relaxed">
        The shop is temporarily unavailable while we perform updates. Please try
        again in a few minutes.
      </p>
    </main>
  );
}
