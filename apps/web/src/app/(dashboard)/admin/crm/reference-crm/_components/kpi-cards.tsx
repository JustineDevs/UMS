import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export type CrmKpiData = {
  pipelineValue: number;
  openOpportunities: number;
  qualifiedRate: number;
  leadToDealRate: number;
  previousPipelineValue: number | null;
};

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function KpiCards({ data }: { data: CrmKpiData }) {
  const pipelineDelta = data.previousPipelineValue
    ? Math.round(((data.pipelineValue - data.previousPipelineValue) / data.previousPipelineValue) * 100)
    : null;
  const values = [
    ["Lead Pipeline Value", currency.format(data.pipelineValue / 100), pipelineDelta === null ? "No prior period" : `${pipelineDelta >= 0 ? "+" : ""}${pipelineDelta}%`, pipelineDelta !== null && pipelineDelta >= 0 ? TrendingUp : TrendingDown],
    ["Qualified Lead Rate", `${data.qualifiedRate.toFixed(1)}%`, "Live CRM rate", TrendingUp],
    ["Open Opportunities", String(data.openOpportunities), "Live CRM count", TrendingUp],
    ["Lead-to-Deal Rate", `${data.leadToDealRate.toFixed(1)}%`, "Live CRM rate", TrendingUp],
  ] as const;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl tracking-tight">Pipeline Overview</h2>
        <p className="text-muted-foreground text-sm">
          Keep tabs on lead quality, open opportunities, and conversion rates across the current sales cycle.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {values.map(([label, value, detail, Trend]) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">{value}</span>

              <Badge
                variant="outline"
                className="border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
              >
                <Trend />
                {detail}
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{detail}</span>
            </p>
          </CardContent>
        </Card>
        ))}
      </div>
    </section>
  );
}
