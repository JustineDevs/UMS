import type { Metadata } from "next";
import { buildJsonLdOrganization, buildPageMetadata, serializeJsonLd, SITE_NAME } from "@/lib/seo";
import Link from "next/link";

export const metadata: Metadata = buildPageMetadata({
  title: `About | ${SITE_NAME}`,
  description: "The Universal Music Store profile, services, and promise to working musicians.",
  path: "/about",
});

const statistics = [["01", "Since", "2020"], ["02", "Local reach", "Philippines"], ["03", "Focus", "Working musicians"]] as const;
const services = ["Instruments selected for real playing and recording", "Clear product information before you buy", "Delivery support across the Philippines", "Order tracking, returns, and post-purchase help"] as const;

export default function AboutPage() {
  const organizationJsonLd = buildJsonLdOrganization();

  return (
    <main className="storefront-page-shell max-w-[1280px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }} />
      <section className="border-b border-outline-variant/25 pb-16 pt-8 sm:pb-24 sm:pt-14">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-on-surface-variant">// ABOUT UNIVERSAL MUSIC STORE</p>
        <h1 className="mt-8 max-w-5xl font-headline text-5xl font-bold leading-[1.08] tracking-[-0.07em] text-primary sm:mt-10 sm:text-7xl">Gear for the work.<span className="mt-1 block text-on-surface-variant sm:mt-2">Music for the long run.</span></h1>
      </section>
      <section className="grid gap-12 border-b border-outline-variant/25 py-16 sm:py-24 lg:grid-cols-[0.75fr_1.25fr]">
        <dl className="divide-y divide-outline-variant/25 border-y border-outline-variant/25">
          {statistics.map(([index, label, value]) => <div key={index} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-5"><dt className="font-mono text-xs text-on-surface-variant">{index}</dt><dd className="text-sm text-on-surface-variant">{label}</dd><dd className="text-right text-sm font-semibold text-primary">{value}</dd></div>)}
        </dl>
        <div className="space-y-6 text-base leading-8 text-on-surface-variant"><p>Universal Music Store exists for people who make music part of their everyday life—not just a weekend hobby.</p><p>We bring instruments, studio essentials, and accessories together with the product detail and support needed to choose confidently.</p><p>From the first order to the next release, our job is to make the gear side of music feel straightforward.</p></div>
      </section>
      <section className="grid gap-12 border-b border-outline-variant/25 py-16 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div><p className="font-mono text-xs font-semibold tracking-[0.2em] text-on-surface-variant">// WHAT WE DO</p><h2 className="mt-6 max-w-md font-headline text-3xl font-bold leading-[1.08] tracking-[-0.05em] text-primary sm:mt-8 sm:text-5xl">A better place to find your next sound.</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">{services.map((service) => <div key={service} className="flex gap-3 border-t border-outline-variant/25 pt-4 text-sm leading-6 text-primary"><span aria-hidden="true" className="text-primary">✓</span><span>{service}</span></div>)}</div>
      </section>
      <section className="flex flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-24">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-on-surface-variant">// KEEP GOING</p>
          <h2 className="mt-4 max-w-xl font-headline text-3xl font-bold leading-tight tracking-[-0.05em] text-primary sm:text-4xl">Find the gear for your next session.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/shop" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96]">Browse the shop</Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/50 px-5 text-sm font-semibold text-primary transition-[background-color,border-color,transform] duration-150 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96]">Contact support</Link>
        </div>
      </section>
    </main>
  );
}
