import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export const dynamic = "force-dynamic";

type JntCsvRow = {
  orderNumber: string;
  consigneeName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  weightKg: string;
  codAmount: string;
  remarks: string;
};

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function buildCsvRow(row: JntCsvRow): string {
  return [
    row.orderNumber,
    row.consigneeName,
    row.phone,
    row.address,
    row.city,
    row.province,
    row.postalCode,
    row.weightKg,
    row.codAmount,
    row.remarks,
  ]
    .map(escapeCsv)
    .join(",");
}

/**
 * POST /api/admin/orders/export-jnt-csv
 * Body: { orderIds: string[] }
 *
 * Fetches each order's shipping address from Medusa and returns a J&T Express
 * bulk upload CSV. The CSV format follows J&T Philippines import template:
 * Order No. | Consignee | Phone | Address | City | Province | Postal Code |
 * Weight (kg) | COD Amount | Remarks
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(body.orderIds)
    ? (body.orderIds as unknown[]).filter((id) => typeof id === "string").slice(0, 200)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });
  }

  const rows: JntCsvRow[] = [];
  const errors: string[] = [];

  await Promise.all(
    (orderIds as string[]).map(async (orderId) => {
      try {
        const res = await medusaAdminFetch(
          `/admin/orders/${encodeURIComponent(orderId)}?fields=id,display_id,email,total,payment_status,metadata,*shipping_address,*items`,
        );
        if (!res.ok) {
          errors.push(`${orderId}: HTTP ${res.status}`);
          return;
        }
        const json = (await res.json()) as {
          order?: {
            id?: string;
            display_id?: number;
            total?: number;
            payment_status?: string;
            shipping_address?: {
              first_name?: string;
              last_name?: string;
              phone?: string;
              address_1?: string;
              address_2?: string;
              city?: string;
              province?: string;
              postal_code?: string;
            } | null;
            items?: Array<{
              quantity?: number;
              variant?: { weight?: number } | null;
            }> | null;
          };
        };

        const o = json.order;
        if (!o) {
          errors.push(`${orderId}: no order in response`);
          return;
        }

        const addr = o.shipping_address;
        const firstName = addr?.first_name?.trim() ?? "";
        const lastName = addr?.last_name?.trim() ?? "";
        const consigneeName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
        const phone = addr?.phone?.trim() ?? "";
        const addressLine = [addr?.address_1, addr?.address_2]
          .map((a) => a?.trim())
          .filter(Boolean)
          .join(", ");
        const city = addr?.city?.trim() ?? "";
        const province = addr?.province?.trim() ?? "";
        const postalCode = addr?.postal_code?.trim() ?? "";

        const totalWeightG = (o.items ?? []).reduce((sum, item) => {
          const itemWeight = item.variant?.weight ?? 500;
          return sum + itemWeight * (item.quantity ?? 1);
        }, 0);
        const weightKg = (totalWeightG / 1000).toFixed(2);

        const isCod = o.payment_status === "not_paid" || o.payment_status === "awaiting";
        const codAmount = isCod ? ((o.total ?? 0) / 100).toFixed(2) : "0.00";

        rows.push({
          orderNumber: o.display_id != null ? `#${o.display_id}` : orderId,
          consigneeName,
          phone,
          address: addressLine,
          city,
          province,
          postalCode,
          weightKg,
          codAmount,
          remarks: `Maharlika Apparel Order ${o.display_id ?? orderId}`,
        });
      } catch (err) {
        errors.push(`${orderId}: ${err instanceof Error ? err.message : "error"}`);
      }
    }),
  );

  const header =
    "Order No.,Consignee Name,Phone,Address,City,Province,Postal Code,Weight (kg),COD Amount,Remarks";
  const csvLines = [header, ...rows.map(buildCsvRow)];
  const csv = csvLines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jnt-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Export-Rows": String(rows.length),
      ...(errors.length > 0 ? { "X-Export-Errors": errors.slice(0, 5).join("; ") } : {}),
    },
  });
}
