export type SubscriptionInterval = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";

export type SubscriptionPlan = {
  id: string;
  name: string;
  productId: string;
  interval: SubscriptionInterval;
  priceMinor: number;
  currencyCode: string;
  trialDays: number;
  maxCycles?: number;
  status: "active" | "inactive" | "archived";
};

export type CustomerSubscription = {
  id: string;
  customerId: string;
  planId: string;
  status: "trialing" | "active" | "past_due" | "paused" | "cancelled" | "expired";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  providerSubscriptionId?: string;
  provider: string;
};

export type InstallmentPlan = {
  id: string;
  orderId: string;
  totalMinor: number;
  currencyCode: string;
  installmentCount: number;
  intervalDays: number;
  paidInstallments: number;
  nextPaymentDate: string;
  status: "active" | "completed" | "defaulted" | "cancelled";
};

export function computeInstallmentSchedule(
  totalMinor: number,
  installmentCount: number,
  intervalDays: number,
  startDate: Date,
): Array<{ dueDate: string; amountMinor: number; installmentNumber: number }> {
  const baseAmount = Math.floor(totalMinor / installmentCount);
  const remainder = totalMinor - baseAmount * installmentCount;
  const schedule: Array<{ dueDate: string; amountMinor: number; installmentNumber: number }> = [];

  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + intervalDays * i);
    schedule.push({
      installmentNumber: i + 1,
      dueDate: dueDate.toISOString(),
      amountMinor: i === 0 ? baseAmount + remainder : baseAmount,
    });
  }
  return schedule;
}

export function isSubscriptionRenewable(sub: CustomerSubscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

export function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
