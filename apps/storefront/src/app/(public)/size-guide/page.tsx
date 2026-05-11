import type { Metadata } from "next";
import Link from "next/link";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Find your perfect fit with our comprehensive size guide for tops, bottoms, and outerwear.",
  alternates: { canonical: canonicalUrl("/size-guide") },
};

const TOPS = [
  { size: "XS", chest: "32–33", waist: "26–27", hip: "34–35" },
  { size: "S", chest: "34–35", waist: "28–29", hip: "36–37" },
  { size: "M", chest: "36–37", waist: "30–31", hip: "38–39" },
  { size: "L", chest: "38–40", waist: "32–34", hip: "40–42" },
  { size: "XL", chest: "41–43", waist: "35–37", hip: "43–45" },
  { size: "2XL", chest: "44–46", waist: "38–40", hip: "46–48" },
  { size: "3XL", chest: "47–49", waist: "41–43", hip: "49–51" },
];

const BOTTOMS = [
  { size: "26", waist: "26", hip: "34–35", inseam: "30" },
  { size: "28", waist: "28", hip: "36–37", inseam: "30" },
  { size: "30", waist: "30", hip: "38–39", inseam: "30–32" },
  { size: "32", waist: "32", hip: "40–41", inseam: "31–32" },
  { size: "34", waist: "34", hip: "42–43", inseam: "31–32" },
  { size: "36", waist: "36", hip: "44–45", inseam: "31–32" },
  { size: "38", waist: "38", hip: "46–47", inseam: "31–32" },
];

export default function SizeGuidePage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Size Guide
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        All measurements are in inches. For the best fit, measure yourself and compare to the chart below.
        When between sizes, we recommend sizing up.{" "}
        <Link href="/contact" className="underline text-primary">
          Contact us
        </Link>{" "}
        if you need help.
      </p>

      <section className="mt-10">
        <h2 className="font-headline text-xl font-bold text-on-surface mb-4">
          How to measure
        </h2>
        <ul className="space-y-2 text-sm text-on-surface-variant list-disc pl-5">
          <li><strong>Chest:</strong> Measure around the fullest part of your chest, keeping the tape parallel to the floor.</li>
          <li><strong>Waist:</strong> Measure around the narrowest part of your waist, usually about one inch above the navel.</li>
          <li><strong>Hip:</strong> Measure around the fullest part of your hips, about 7–9 inches below the waist.</li>
          <li><strong>Inseam:</strong> Measure from the crotch seam to the bottom of the ankle.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-headline text-xl font-bold text-on-surface mb-4">
          Tops and outerwear
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-on-surface">
                <th className="text-left px-4 py-3 font-semibold">Size</th>
                <th className="text-left px-4 py-3 font-semibold">Chest</th>
                <th className="text-left px-4 py-3 font-semibold">Waist</th>
                <th className="text-left px-4 py-3 font-semibold">Hip</th>
              </tr>
            </thead>
            <tbody>
              {TOPS.map((row, i) => (
                <tr
                  key={row.size}
                  className={i % 2 === 0 ? "bg-surface" : "bg-surface-container-lowest"}
                >
                  <td className="px-4 py-2.5 font-medium text-primary">{row.size}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.chest}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.waist}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.hip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-headline text-xl font-bold text-on-surface mb-4">
          Bottoms
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-on-surface">
                <th className="text-left px-4 py-3 font-semibold">Size (Waist)</th>
                <th className="text-left px-4 py-3 font-semibold">Waist</th>
                <th className="text-left px-4 py-3 font-semibold">Hip</th>
                <th className="text-left px-4 py-3 font-semibold">Inseam</th>
              </tr>
            </thead>
            <tbody>
              {BOTTOMS.map((row, i) => (
                <tr
                  key={row.size}
                  className={i % 2 === 0 ? "bg-surface" : "bg-surface-container-lowest"}
                >
                  <td className="px-4 py-2.5 font-medium text-primary">{row.size}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.waist}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.hip}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{row.inseam}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-xl bg-surface-container-low px-6 py-5">
        <h2 className="font-headline text-base font-bold text-on-surface mb-2">
          Need help with sizing?
        </h2>
        <p className="text-sm text-on-surface-variant">
          For custom prints, bulk orders, or uniform sizing, reach out to our team directly.{" "}
          <Link href="/contact" className="underline text-primary">
            Contact us
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
