import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UpcomingTransactions() {
  return (
    <Card>
      <CardHeader><CardTitle className="font-normal">Upcoming Bills &amp; Payments</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
          <CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Upcoming merchant payouts and bills are not available from the payment ledger yet.</p>
        </div>
      </CardContent>
    </Card>
  );
}
