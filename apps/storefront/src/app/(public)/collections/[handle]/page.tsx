import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ locale?: string }>;
};

/** Canonical collection URL: forwards to shop category filter. Locale drives CMS category row. */
export default async function CollectionByHandlePage({ params, searchParams }: Props) {
  const { handle } = await params;
  const sp = await searchParams;
  const locale = (sp.locale ?? "en").trim() || "en";
  const h = handle.trim();
  if (!h) redirect("/shop");
  redirect(`/shop?category=${encodeURIComponent(h)}&locale=${encodeURIComponent(locale)}`);
}
