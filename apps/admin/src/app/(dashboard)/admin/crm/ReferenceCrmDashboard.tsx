"use client";

import { useEffect, useMemo, useState } from "react";

import { KpiCards } from "./reference-crm/_components/kpi-cards";
import { OpportunitiesSection } from "./reference-crm/_components/opportunities-section";
import { PipelineActivity } from "./reference-crm/_components/pipeline-activity";
import { TaskReminders } from "./reference-crm/_components/task-reminders";

type Deal = {
  id: string;
  title: string;
  stage: string;
  value: number;
  customer_email: string;
  probability: number;
  updated_at: string;
};

type Activity = {
  id: string;
  subject: string;
  activity_type: string;
  customer_email: string;
  due_at: string | null;
  completed_at: string | null;
  occurred_at: string;
};

type Goal = {
  period_start: string;
  period_end: string;
  target_deals: number;
};

type OperationsResponse = {
  deals: Deal[];
  activities: Activity[];
  goals: Goal[];
};

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function healthFor(probability: number) {
  if (probability >= 0.6) return "On Track";
  if (probability >= 0.3) return "Needs Review";
  return "At Risk";
}

export function ReferenceCrmDashboard() {
  const [operations, setOperations] = useState<OperationsResponse>({ deals: [], activities: [], goals: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/crm/operations")
      .then(async (response) => {
        if (!response.ok) throw new Error("CRM data unavailable");
        const payload = (await response.json()) as { data?: Partial<OperationsResponse> };
        if (!cancelled) {
          setOperations({
            deals: Array.isArray(payload.data?.deals) ? payload.data.deals : [],
            activities: Array.isArray(payload.data?.activities) ? payload.data.activities : [],
            goals: Array.isArray(payload.data?.goals) ? payload.data.goals : [],
          });
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dashboard = useMemo(() => {
    const now = new Date();
    const openDeals = operations.deals.filter((deal) => !["won", "lost"].includes(deal.stage.toLowerCase()));
    const qualifiedDeals = operations.deals.filter((deal) => ["qualified", "proposal", "negotiation"].includes(deal.stage.toLowerCase()));
    const wonDeals = operations.deals.filter((deal) => deal.stage.toLowerCase() === "won");
    const monthlyQualified = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
      const key = monthKey(date);
      return operations.deals.filter((deal) => monthKey(new Date(deal.updated_at)) === key && ["qualified", "proposal", "negotiation"].includes(deal.stage.toLowerCase())).length;
    });
    const currentGoal = operations.goals.find((goal) => goal.period_start <= now.toISOString().slice(0, 10) && goal.period_end >= now.toISOString().slice(0, 10));
    return {
      kpis: {
        pipelineValue: openDeals.reduce((sum, deal) => sum + deal.value, 0),
        openOpportunities: openDeals.length,
        qualifiedRate: operations.deals.length ? (qualifiedDeals.length / operations.deals.length) * 100 : 0,
        leadToDealRate: operations.deals.length ? (wonDeals.length / operations.deals.length) * 100 : 0,
        previousPipelineValue: null,
      },
      monthlyQualified,
      discoveryCallsBooked: operations.activities.filter((activity) => activity.activity_type === "meeting" && !activity.completed_at).length,
      activities: operations.activities.filter((activity) => !activity.completed_at).slice(0, 4),
      proposalSent: operations.deals.filter((deal) => deal.stage.toLowerCase() === "proposal").length,
      proposalGoal: currentGoal?.target_deals ?? 0,
      opportunities: operations.deals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        account: deal.customer_email,
        stage: stageLabel(deal.stage),
        priority: Math.max(1, Math.round((1 - deal.probability) * 3)),
        health: healthFor(deal.probability),
        value: currency.format(deal.value / 100),
        probability: deal.probability,
      })),
    };
  }, [operations]);

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-label="Loading CRM" />;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <KpiCards data={dashboard.kpis} />
      <PipelineActivity monthlyQualified={dashboard.monthlyQualified} discoveryCallsBooked={dashboard.discoveryCallsBooked} />
      <TaskReminders activities={dashboard.activities} proposalSent={dashboard.proposalSent} proposalGoal={dashboard.proposalGoal} />
      <OpportunitiesSection opportunities={dashboard.opportunities} />
    </div>
  );
}
