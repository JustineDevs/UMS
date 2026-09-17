import type { Product } from "@universal-music-store/types";

export function ProductAudioHub({ product }: { product: Product }) {
  if (product.audioDemos.length === 0) return null;

  return (
    <section className="border-y border-outline-variant/20 py-6" aria-labelledby="audio-hub-title">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Listen before you choose</p>
        <h2 id="audio-hub-title" className="mt-1 text-lg font-bold">Audio demos</h2>
      </div>
      <div className="space-y-4">
        {product.audioDemos.map((demo) => (
          <div key={`${demo.url}:${demo.title}`} className="rounded-xl bg-surface-container-low/50 p-4">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h3 className="text-sm font-semibold">{demo.title}</h3>
              {demo.durationSeconds != null ? (
                <span className="text-xs text-on-surface-variant">{Math.round(demo.durationSeconds)} sec</span>
              ) : null}
            </div>
            {demo.description ? <p className="mb-3 text-xs text-on-surface-variant">{demo.description}</p> : null}
            <audio className="w-full" controls preload="none" src={demo.url} aria-label={demo.title} />
          </div>
        ))}
      </div>
    </section>
  );
}
