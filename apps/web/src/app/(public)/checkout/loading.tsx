import Image from "next/image";

export default function CheckoutLoading() {
  return (
    <main className="storefront-page-shell motion-surface max-w-6xl">
      <header className="mb-10 border-b border-outline-variant/20 pb-8">
        <div className="flex items-start gap-3">
          <Image src="/brand/uvs-logo-mark.png" alt="" width={38} height={38} className="mt-1 size-9 object-contain" />
          <div>
            <div className="h-3 w-44 animate-pulse rounded bg-surface-container-high" />
            <div className="mt-4 h-12 w-52 animate-pulse rounded bg-surface-container-high" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded bg-surface-container-high" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-outline-variant/20 bg-surface-container-lowest" />
          ))}
        </div>
        <div className="h-[34rem] animate-pulse rounded-2xl border border-outline-variant/20 bg-surface-container-lowest" />
      </div>
    </main>
  );
}
