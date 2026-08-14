import { format } from "date-fns";
import { Download, RotateCw, Settings2 } from "lucide-react";
import { listRecentPaymentAttempts } from "@universal-music-store/platform-data";

import { Button } from "@/components/ui/button";
import { AdminPageHeader, AuditTimeline } from "@/components/admin-console";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalanceDistributionCard, type FinanceBalancePoint } from "@/components/reference-finance/_components/balance-distribution-card";
import { FinanceNotification } from "@/components/reference-finance/_components/finance-notification";
import { IncomeBreakdown } from "@/components/reference-finance/_components/income-breakdown";
import { OverviewKpis } from "@/components/reference-finance/_components/overview-kpis";
import { QuickActions } from "@/components/reference-finance/_components/quick-actions";
import { TransactionsOverviewCard, type FinanceTransactionPoint } from "@/components/reference-finance/_components/transactions-overview-card";
import { UpcomingTransactions } from "@/components/reference-finance/_components/upcoming-transactions";
import { Wallet } from "@/components/reference-finance/_components/wallet";
import { NangoPaymentConnect } from "@/components/NangoPaymentConnect";
import { requirePagePermission } from "@/lib/require-page-permission";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  await requirePagePermission("settings:read");
  const requestedTab = (await searchParams)?.tab;
  const activeTab = requestedTab === "accounts" || requestedTab === "transactions" ? requestedTab : "dashboard";
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");
  const supabase = adminSupabaseOr503("payment-settings");
  const attempts = "client" in supabase ? await listRecentPaymentAttempts(supabase.client, 500) : [];
  const successful = attempts.filter((attempt) => ["succeeded", "paid", "authorized", "captured"].includes(attempt.status));
  const processedVolume = successful.reduce((total, attempt) => total + (Number(attempt.amount_minor) || 0), 0) / 100;
  const currency = successful[0]?.currency ?? attempts[0]?.currency ?? "PHP";
  const successRate = attempts.length ? (successful.length / attempts.length) * 100 : 0;
  const now = Date.now();
  const transactionData: FinanceTransactionPoint[] = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = dayStart.getTime() + 24 * 60 * 60 * 1000;
    const dayAttempts = attempts.filter((attempt) => {
      const timestamp = Date.parse(attempt.updated_at || attempt.created_at);
      return timestamp >= dayStart.getTime() && timestamp < nextDay;
    });
    const income = dayAttempts
      .filter((attempt) => successful.includes(attempt))
      .reduce((total, attempt) => total + (Number(attempt.amount_minor) || 0), 0) / 100;
    const expense = dayAttempts
      .filter((attempt) => !successful.includes(attempt))
      .reduce((total, attempt) => total + (Number(attempt.amount_minor) || 0), 0) / 100;
    return { date: dayStart.toISOString(), income, expense };
  });
  const providers = new Map<string, number>();
  for (const attempt of successful) {
    const key = attempt.provider || "Unknown provider";
    providers.set(key, (providers.get(key) ?? 0) + (Number(attempt.amount_minor) || 0) / 100);
  }
  const providerTotal = Array.from(providers.values()).reduce((total, amount) => total + amount, 0);
  const balanceData: FinanceBalancePoint[] = Array.from(providers.entries()).slice(0, 4).map(([account, amount], index) => ({
    account,
    amount,
    key: (["main", "savings", "investment", "reserve"] as const)[index],
    percentage: 0,
  }));
  if (balanceData.length === 0) {
    balanceData.push({ account: "No settled payments", amount: 0, key: "main", percentage: 0 });
  }
  const balanceDataWithPercentages = balanceData.map((item) => ({
    ...item,
    percentage: providerTotal ? Number(((item.amount / providerTotal) * 100).toFixed(1)) : 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title="Personal Finances" subtitle={formattedDate} actions={<div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><RotateCw className="size-4" /><span>Updated {attempts[0]?.updated_at ? format(new Date(attempts[0].updated_at), "MMM d, h:mm a") : "not available"}</span></div>
        <Button asChild size="sm" variant="outline"><a href="/admin/settings"><Settings2 />Settings</a></Button>
        <Button asChild size="sm" variant="outline"><a href="/api/admin/payment-attempts/export"><Download data-icon="inline-start" />Export CSV</a></Button>
      </div>} />
      <Tabs defaultValue={activeTab === "accounts" ? "12-months" : activeTab === "transactions" ? "custom" : "30-days"} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="30-days">Dashboard</TabsTrigger>
            <TabsTrigger value="12-months">Accounts</TabsTrigger>
            <TabsTrigger value="custom">Transactions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="30-days" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-6"><OverviewKpis processedVolume={processedVolume} successfulCount={successful.length} attemptCount={attempts.length} successRate={successRate} currency={currency} /></div>
            <div className="flex flex-col gap-4 xl:col-span-6"><IncomeBreakdown amount={processedVolume} currency={currency} /><FinanceNotification /></div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7"><TransactionsOverviewCard data={transactionData} /></div>
            <div className="xl:col-span-5"><BalanceDistributionCard balanceData={balanceDataWithPercentages} /></div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-4"><Wallet /></div>
            <div className="xl:col-span-4"><UpcomingTransactions /></div>
            <div className="xl:col-span-4"><QuickActions /></div>
          </div>
        </TabsContent>
        <TabsContent value="12-months">
          <div className="flex flex-col gap-4 rounded-xl border border-border border-dashed p-6">
            <div><h2 className="font-medium">Merchant accounts</h2><p className="mt-1 text-sm text-muted-foreground">Connect the store&apos;s payment accounts through OAuth. Secret production keys are never entered here.</p></div>
            <NangoPaymentConnect />
          </div>
        </TabsContent>
        <TabsContent value="custom">
          <div className="flex flex-col gap-3 rounded-xl border border-border border-dashed p-6">
            <h2 className="font-medium">Transactions</h2>
            <p className="text-sm text-muted-foreground">Payment attempts and retry actions are managed in the operational ledger.</p>
            <Button asChild size="sm" variant="outline" className="w-fit"><a href="/admin/payments">Open payment attempts</a></Button>
          </div>
        </TabsContent>
      </Tabs>
      <AuditTimeline title="Recent payment activity" />
    </div>
  );
}
