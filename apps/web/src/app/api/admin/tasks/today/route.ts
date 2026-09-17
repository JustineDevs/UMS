import { NextResponse } from "next/server";
import { getPaymentPlatformMetrics } from "@universal-music-store/platform-data";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";

type TaskItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  link: string;
  count?: number;
};

export async function GET() {
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const tasks: TaskItem[] = [];
  const sup = adminSupabaseOr503("tasks-today");

  try {
    if ("client" in sup) {
      const metrics = await getPaymentPlatformMetrics(sup.client);
      if (metrics) {
        if (metrics.paymentAttemptsStaleFinalize > 0) {
          tasks.push({
            id: "stale-payment-attempts",
            type: "pending_review",
            title: "Stale payment sessions",
            description: `${metrics.paymentAttemptsStaleFinalize} checkout attempts need recovery or finalization review`,
            urgency: metrics.paymentAttemptsStaleFinalize > 5 ? "high" : "medium",
            link: "/admin/payments",
            count: metrics.paymentAttemptsStaleFinalize,
          });
        }
        if (metrics.paymentAttemptsNeedsReview > 0) {
          tasks.push({
            id: "payment-needs-review",
            type: "pending_review",
            title: "Payment attempts need review",
            description: `${metrics.paymentAttemptsNeedsReview} payment rows are already marked for operator review`,
            urgency: metrics.paymentAttemptsNeedsReview > 5 ? "high" : "medium",
            link: "/admin/payments",
            count: metrics.paymentAttemptsNeedsReview,
          });
        }
      }
    }
  } catch (err) {
    console.error("[tasks/today] Failed to fetch payment metrics:", err);
  }

  tasks.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return NextResponse.json({ tasks });
}
