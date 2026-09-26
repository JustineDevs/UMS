"use client";

import Image from "next/image";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { PaymentProviderLogo } from "@/components/PaymentProviderLogo";

type FooterColumn = { title: string; links: { label: string; href: string }[] };
type FooterLink = { label: string; href: string };

export function StorefrontFooterClient({
  columns,
  bottomLinks,
  socialLinks,
  copyright,
}: {
  columns: FooterColumn[];
  bottomLinks: FooterLink[];
  socialLinks: FooterLink[];
  copyright: string;
}) {
  return (
    <footer
      className="w-full border-t border-neutral-200 bg-white text-neutral-900"
      data-cms-id="storefront-footer"
      data-cms-label="Storefront footer"
    >
      <div className="mx-auto w-full max-w-[1440px] px-6 py-14 sm:px-10 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(220px,1.25fr)_2fr] lg:gap-20">
          <div className="space-y-8">
            <Link href="/" className="inline-flex items-center" aria-label="Universal Music Store, home">
              <Image
                src="/brand/universal-music-store-logo-landscape.png"
                alt="Universal Music Store"
                width={960}
                height={240}
                className="h-auto w-full max-w-[300px] object-contain object-left"
              />
            </Link>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Our store</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-neutral-600">
                Your source for instruments, studio gear, and accessories across the Philippines.
              </p>
              <p className="mt-3 text-sm font-medium text-neutral-900">Online store · Philippines</p>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">{column.title}</h2>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <a href={link.href} className="text-sm text-neutral-600 transition-colors hover:text-neutral-950">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-neutral-200 pt-6 text-sm text-neutral-600 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap items-center gap-3"
            aria-label="Accepted payment methods"
            data-cms-id="storefront-payment-methods"
            data-cms-label="Accepted payment methods"
          >
            <span className="mr-1 font-medium text-neutral-900">Payments</span>
            <span className="inline-flex h-9 items-center"><PaymentProviderLogo providerKey="STRIPE" label="Stripe" /></span>
            <span className="inline-flex h-9 items-center"><PaymentProviderLogo providerKey="PAYPAL" label="PayPal" /></span>
            <span className="inline-flex h-9 items-center"><PaymentProviderLogo providerKey="XENDIT" label="Xendit" /></span>
            <span className="inline-flex h-9 items-center gap-1 text-neutral-800" title="Cash on delivery">
              <Banknote className="size-5" aria-hidden="true" />
              <span className="text-sm">Cash on delivery</span>
            </span>
          </div>
          {socialLinks.length > 0 ? (
            <div className="flex items-center gap-4" aria-label="Social links">
              {socialLinks.map((link) => (
                <a key={`${link.href}-${link.label}`} href={link.href} aria-label={link.label} className="transition-colors hover:text-neutral-950">
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          {bottomLinks.length > 0 ? (
            <nav aria-label="Footer secondary" className="flex flex-wrap gap-x-4 gap-y-2">
              {bottomLinks.map((link) => (
                <a key={`${link.href}-${link.label}`} href={link.href} className="hover:text-neutral-900 hover:underline">
                  {link.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
