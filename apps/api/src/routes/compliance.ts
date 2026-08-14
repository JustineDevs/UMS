import { Router } from "express";
import {
  createSupabaseClient,
  exportDataSubjectByEmail,
  anonymizeStaleOrderAddresses,
} from "@universal-music-store/database";
import { complianceEmailParamSchema } from "@universal-music-store/validation";

import {
  deleteMedusaCustomerByEmail,
  fetchMedusaOrdersForComplianceEmail,
} from "../lib/medusa-compliance-fetch.js";

export const complianceRouter: ReturnType<typeof Router> = Router();

complianceRouter.get("/export", async (req, res, next) => {
  try {
    const emailRaw =
      typeof req.query.email === "string" ? req.query.email.trim() : "";
    const emailParsed = complianceEmailParamSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      res.status(400).json({
        error: "valid email query required",
        code: "MISSING_EMAIL",
        details: emailParsed.error.flatten(),
      });
      return;
    }
    const email = emailParsed.data;
    const supabase = createSupabaseClient();
    const bundle = await exportDataSubjectByEmail(supabase, email);
    if (!bundle) {
      res.status(404).json({ error: "subject not found", code: "NOT_FOUND" });
      return;
    }
    const medusa = await fetchMedusaOrdersForComplianceEmail(email);
    res.json({
      ...bundle,
      medusa_orders: medusa.orders,
      medusa_error: medusa.error,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Erasure: Supabase platform user row + Medusa customer (commerce of record).
 * Requires INTERNAL_API_KEY + service role in env.
 */
complianceRouter.post("/erasure", async (req, res, next) => {
  try {
    const emailRaw =
      typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const emailParsed = complianceEmailParamSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      res.status(400).json({
        error: "valid email required",
        code: "MISSING_EMAIL",
        details: emailParsed.error.flatten(),
      });
      return;
    }
    const email = emailParsed.data;
    const supabase = createSupabaseClient();
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    if (uErr) throw uErr;
    const medusaDel = await deleteMedusaCustomerByEmail(email);
    let supabaseDeleted = false;
    if (user && typeof (user as { id?: string }).id === "string") {
      const uid = (user as { id: string }).id;
      const { error: dErr } = await supabase.from("users").delete().eq("id", uid);
      if (dErr) throw dErr;
      supabaseDeleted = true;
    }
    res.json({
      ok: true,
      email,
      supabase_user_deleted: supabaseDeleted,
      medusa_customer_deleted: medusaDel.deleted,
      medusa_error: medusaDel.error,
    });
  } catch (e) {
    next(e);
  }
});

complianceRouter.post(
  "/retention/anonymize-addresses",
  async (req, res, next) => {
    try {
      const days = Math.min(
        parseInt(
          String(req.body?.days ?? process.env.DATA_RETENTION_DAYS ?? "730"),
          10,
        ) || 730,
        365 * 10,
      );
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const supabase = createSupabaseClient();
      const out = await anonymizeStaleOrderAddresses(
        supabase,
        cutoff.toISOString(),
      );
      res.json({ ...out, cutoff: cutoff.toISOString(), days });
    } catch (e) {
      next(e);
    }
  },
);
