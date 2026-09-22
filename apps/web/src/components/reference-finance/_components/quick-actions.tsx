import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QuickActions() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="font-normal">Payment operations</CardTitle></CardHeader>
        <CardContent>
          <Button asChild variant="outline"><Link href="/admin/payments">Open payment attempts <ExternalLink data-icon="inline-end" /></Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-normal">Shortcuts</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">Connect a merchant account to enable payment actions.</p></CardContent>
      </Card>
    </div>
  );
}
