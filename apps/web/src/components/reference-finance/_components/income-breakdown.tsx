import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function IncomeBreakdown({ amount, currency }: { amount: number; currency: string }) {
  const formattedAmount = new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
  const hasIncome = amount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Income sources</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-1 md:grid-cols-3">
        {!hasIncome ? <p className="py-6 text-muted-foreground text-sm md:col-span-3">No settled payment income in the current ledger.</p> : null}
        {hasIncome ? (
          <section className="isolate flex gap-[0.5px] md:col-span-3">
            <Separator orientation="vertical" className="mb-1 h-auto self-auto border-muted-foreground/50 border-l border-dashed bg-transparent" />
            <div className="flex min-h-24 flex-1 flex-col justify-between">
              <div className="flex min-w-0 flex-col gap-1 px-1">
                <p className="wrap-break-word text-muted-foreground text-xs leading-none">Settled payment volume · 100%</p>
                <div className="text-lg leading-none tracking-tight">{formattedAmount}</div>
              </div>
              <div className="-ml-0.5 h-5 rounded-sm bg-chart-3" />
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
