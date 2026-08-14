import { Router } from "express";
import type { Request, Response } from "express";
import {
  internalCustomerDataErasureBodySchema,
  internalCustomerDataExportBodySchema,
} from "@universal-music-store/validation";

const router = Router();

export type DataExportPayload = {
  customerId: string;
  email: string;
  includeOrders: boolean;
  includeReviews: boolean;
  includeAddresses: boolean;
  includePayments: boolean;
};

export type DataErasurePayload = {
  customerId: string;
  email: string;
  confirmationToken: string;
  retainOrderRecords: boolean;
};

router.post("/compliance/data-export", async (req: Request, res: Response) => {
  const parsed = internalCustomerDataExportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid export request",
      details: parsed.error.flatten(),
    });
  }
  const body = parsed.data;

  try {
    const exportData: Record<string, unknown> = {
      customerId: body.customerId,
      email: body.email,
      exportedAt: new Date().toISOString(),
      profile: {},
      orders: [],
      reviews: [],
      addresses: [],
      paymentMethods: [],
    };

    if (body.includeOrders) {
      const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
      const ordersRes = await fetch(
        `${medusaUrl}/admin/orders?customer_id=${body.customerId}&limit=100`,
        {
          headers: {
            "x-medusa-access-token": process.env.MEDUSA_SECRET_API_KEY || "",
          },
        },
      );
      if (ordersRes.ok) {
        const ordersJson = await ordersRes.json();
        exportData.orders = (ordersJson as { orders?: unknown[] }).orders ?? [];
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customer-data-${body.customerId}.json"`,
    );
    return res.status(200).json(exportData);
  } catch (err) {
    console.error("[compliance] data export failed:", err);
    return res.status(500).json({ error: "Export failed" });
  }
});

router.post("/compliance/data-erasure", async (req: Request, res: Response) => {
  const parsed = internalCustomerDataErasureBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid erasure request",
      details: parsed.error.flatten(),
    });
  }
  const body = parsed.data;

  try {
    const results: Record<string, string> = {};

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const tables = ["customer_profiles", "reviews", "qa_entries", "cart_abandonment"];
      for (const table of tables) {
        const deleteRes = await fetch(
          `${supabaseUrl}/rest/v1/${table}?customer_id=eq.${body.customerId}`,
          {
            method: "DELETE",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "return=minimal",
            },
          },
        );
        results[table] = deleteRes.ok ? "erased" : `failed (${deleteRes.status})`;
      }
    }

    if (!body.retainOrderRecords) {
      const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
      const anonymizeRes = await fetch(
        `${medusaUrl}/admin/customers/${body.customerId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-medusa-access-token": process.env.MEDUSA_SECRET_API_KEY || "",
          },
          body: JSON.stringify({
            first_name: "REDACTED",
            last_name: "REDACTED",
            email: `erased-${body.customerId}@redacted.local`,
            phone: "",
          }),
        },
      );
      results.medusa_customer = anonymizeRes.ok ? "anonymized" : `failed (${anonymizeRes.status})`;
    }

    results.erasedAt = new Date().toISOString();
    return res.status(200).json({
      success: true,
      customerId: body.customerId,
      results,
    });
  } catch (err) {
    console.error("[compliance] data erasure failed:", err);
    return res.status(500).json({ error: "Erasure failed" });
  }
});

export default router;
