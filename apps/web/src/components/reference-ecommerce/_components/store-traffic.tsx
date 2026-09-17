import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreTraffic() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Store Traffic</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          No live traffic feed
        </CardDescription>
        <CardAction>
          <Button aria-label="Open analytics" asChild size="icon-sm" variant="ghost">
            <Link href="/admin/analytics">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="flex h-54 items-center justify-center rounded-lg border border-dashed text-center">
          <div className="max-w-xs px-6">
            <div className="font-medium text-sm">Traffic analytics not connected</div>
            <div className="mt-1 text-muted-foreground text-sm">
              Connect a storefront analytics source before visitor charts are shown here.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
