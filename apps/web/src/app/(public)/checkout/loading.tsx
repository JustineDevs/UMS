import Image from "next/image";

export default function CheckoutLoading() {
  return (
    <main className="storefront-page-shell motion-surface w-full max-w-none px-4 py-10 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
      <header className="mb-10">
        <div className="flex items-start gap-4">
          <Image src="/brand/uvs-logo-mark.png" alt="" width={28} height={28} className="mt-1 size-7 object-contain" />
          <div>
            <div className="h-3 w-44 animate-pulse rounded bg-surface-container-high" />
            <div className="mt-3 h-10 w-44 animate-pulse rounded bg-surface-container-high" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded bg-surface-container-high" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)] xl:gap-12">
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg border border-outline-variant/20 bg-surface-container-lowest shadow-none" />
          ))}
        </div>
        <div className="h-[34rem] animate-pulse rounded-lg border border-outline-variant/20 bg-surface-container-lowest shadow-none" />
      </div>
    </main>
  );
}
