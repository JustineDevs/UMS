import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderReturnForm, type ReturnLine } from "@/components/OrderReturnForm";
import { getStorefrontSession } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";

export const metadata: Metadata = {
  title: "Request a return",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type OrderRow = {
  id?: string;
  email?: string | null;
  items?: Array<{
    id?: string;
    title?: string | null;
    quantity?: number;
    returned_quantity?: number;
  }>;
};

export default async function OrderReturnPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await getStorefrontSession();
  const userEmail = session?.user?.email?.trim().toLowerCase();
  if (!userEmail) {
    redirect(`/sign-in?callbackUrl=/account/orders/${encodeURIComponent(orderId)}/return`);
  }

  if (!orderId?.startsWith("order_")) {
    notFound();
  }

  const res = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=id,email,*items,*items.id,*items.title,*items.quantity,*items.returned_quantity`,
  );
  if (!res.ok) {
    notFound();
  }
  const json = (await res.json()) as { order?: OrderRow };
  const order = json.order;
  if (!order?.id) {
    notFound();
  }
  const orderEmail = order.email?.trim().toLowerCase();
  if (!orderEmail || orderEmail !== userEmail) {
    notFound();
  }

  const lines: ReturnLine[] = (order.items ?? [])
    .map((it) => ({
      id: String(it.id ?? ""),
      title: String(it.title ?? "Item"),
      quantity:
        typeof it.quantity === "number" && Number.isFinite(it.quantity)
          ? Math.max(0, Math.floor(it.quantity))
          : 0,
      returnedQuantity:
        typeof it.returned_quantity === "number" &&
        Number.isFinite(it.returned_quantity)
          ? Math.max(0, Math.floor(it.returned_quantity))
          : 0,
    }))
    .filter((l) => l.id.length > 0);

  return (
    <main className="storefront-page-shell max-w-2xl">
      <p className="text-sm text-on-surface-variant mb-2">
        <Link href="/account" className="text-primary hover:underline">
          Account
        </Link>
        <span className="mx-2">/</span>
        <Link href="/account" className="text-primary hover:underline">
          Orders
        </Link>
      </p>
      <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-primary mb-2">
        Request a return
      </h1>
      <p className="font-body text-on-surface-variant mb-8 text-sm">
        Order {orderId}. Choose quantities to return. Staff will follow your store
        policy.
      </p>
      <OrderReturnForm orderId={order.id} lines={lines} />
    </main>
  );
}
