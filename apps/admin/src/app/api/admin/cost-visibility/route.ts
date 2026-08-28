import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";

export type CostLineItem = {
  service: string;
  category: "hosting" | "database" | "cache" | "psp_fees" | "email" | "tracking" | "cdn" | "other";
  monthlyCostPhp: number;
  note: string;
};

export type CostVisibilitySummary = {
  month: string;
  totalMonthlyCostPhp: number;
  items: CostLineItem[];
  breakdown: Record<string, number>;
};

export async function GET() {
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const items: CostLineItem[] = [
    { service: "Vercel (Storefront)", category: "hosting", monthlyCostPhp: 0, note: "Free tier / Pro plan" },
    { service: "Vercel (Admin)", category: "hosting", monthlyCostPhp: 0, note: "Free tier / Pro plan" },
    { service: "Render (Medusa)", category: "hosting", monthlyCostPhp: 0, note: "Starter plan" },
    { service: "Render (API)", category: "hosting", monthlyCostPhp: 0, note: "Starter plan" },
    { service: "Supabase (Database)", category: "database", monthlyCostPhp: 0, note: "Free tier / Pro plan" },
    { service: "Supabase (Auth)", category: "database", monthlyCostPhp: 0, note: "Included" },
    { service: "Redis Cloud", category: "cache", monthlyCostPhp: 0, note: "If used" },
    { service: "Stripe Fees (~2.9%+30c)", category: "psp_fees", monthlyCostPhp: 0, note: "Variable based on volume" },
    { service: "PayPal Fees (~3.49%+49c)", category: "psp_fees", monthlyCostPhp: 0, note: "Variable based on volume" },
    { service: "Resend (Email)", category: "email", monthlyCostPhp: 0, note: "Free tier / usage based" },
    { service: "AfterShip (Tracking)", category: "tracking", monthlyCostPhp: 0, note: "Plan-dependent" },
    { service: "Vercel Edge Network", category: "cdn", monthlyCostPhp: 0, note: "Included with Vercel" },
  ];

  const breakdown: Record<string, number> = {};
  for (const item of items) {
    breakdown[item.category] = (breakdown[item.category] ?? 0) + item.monthlyCostPhp;
  }

  const summary: CostVisibilitySummary = {
    month: new Date().toISOString().slice(0, 7),
    totalMonthlyCostPhp: items.reduce((sum, i) => sum + i.monthlyCostPhp, 0),
    items,
    breakdown,
  };

  return NextResponse.json(summary);
}
