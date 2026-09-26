import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: `About | ${SITE_NAME}`,
  description: "The Universal Music Store profile, services, and promise to working musicians.",
  path: "/about",
});

const statistics = [["01", "Since", "2020"], ["02", "Local reach", "Philippines"], ["03", "Focus", "Working musicians"]] as const;
const services = ["Instruments selected for real playing and recording", "Clear product information before you buy", "Delivery support across the Philippines", "Order tracking, returns, and post-purchase help"] as const;

export default function AboutPage() {
  return (
    <main className="storefront-page-shell max-w-[1280px]">
      <section className="border-b border-outline-variant/25 pb-16 pt-8 sm:pb-24 sm:pt-14">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-on-surface-variant">// ABOUT UNIVERSAL MUSIC STORE</p>
        <h1 className="mt-7 max-w-5xl font-headline text-5xl font-bold tracking-[-0.07em] text-primary sm:text-7xl">Gear for the work.<span className="block text-on-surface-variant">Music for the long run.</span></h1>
      </section>
      <section className="grid gap-12 border-b border-outline-variant/25 py-16 sm:py-24 lg:grid-cols-[0.75fr_1.25fr]">
        <dl className="divide-y divide-outline-variant/25 border-y border-outline-variant/25">
          {statistics.map(([index, label, value]) => <div key={index} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-5"><dt className="font-mono text-xs text-on-surface-variant">{index}</dt><dd className="text-sm text-on-surface-variant">{label}</dd><dd className="text-right text-sm font-semibold text-primary">{value}</dd></div>)}
        </dl>
        <div className="space-y-6 text-base leading-8 text-on-surface-variant"><p>Universal Music Store exists for people who make music part of their everyday life—not just a weekend hobby.</p><p>We bring instruments, studio essentials, and accessories together with the product detail and support needed to choose confidently.</p><p>From the first order to the next release, our job is to make the gear side of music feel straightforward.</p></div>
      </section>
      <section className="grid gap-12 border-b border-outline-variant/25 py-16 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div><p className="font-mono text-xs font-semibold tracking-[0.2em] text-on-surface-variant">// WHAT WE DO</p><h2 className="mt-5 max-w-md font-headline text-3xl font-bold tracking-[-0.05em] text-primary sm:text-5xl">A better place to find your next sound.</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">{services.map((service) => <div key={service} className="flex gap-3 border-t border-outline-variant/25 pt-4 text-sm leading-6 text-primary"><span aria-hidden="true" className="text-secondary">✓</span><span>{service}</span></div>)}</div>
      </section>
      <section className="grid gap-4 py-16 sm:grid-cols-3 sm:py-24">{["Curated catalog", "Reliable delivery", "Human support"].map((label, index) => <div key={label} className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 sm:p-8"><p className="font-mono text-xs text-on-surface-variant">0{index + 1}</p><p className="mt-14 font-headline text-xl font-bold text-primary">{label}</p></div>)}</section>
      <section className="relative min-h-[28rem] overflow-hidden rounded-2xl bg-primary"><Image src="/brand/uvs-logo-landscape.png" alt="Universal Music Store" fill className="object-contain p-12 opacity-20 sm:p-24" sizes="(max-width: 768px) 100vw, 1200px" /><div className="relative flex min-h-[28rem] items-end p-6 sm:p-12"><div className="max-w-xl text-on-primary"><p className="font-mono text-xs tracking-[0.2em] text-on-primary/65">// KEEP PLAYING</p><h2 className="mt-4 font-headline text-4xl font-bold tracking-[-0.06em] sm:text-6xl">Your sound deserves good tools.</h2><Link href="/shop" className="mt-8 inline-flex rounded-lg bg-on-primary px-5 py-3 text-sm font-bold text-primary">Browse the shop ↗</Link></div></div></section>
    </main>
  );
}
