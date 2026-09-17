import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TrafficSources() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Traffic Sources</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          No attribution data
        </CardDescription>
        <CardAction>
          <Button aria-label="Open channels" asChild size="icon-sm" variant="ghost">
            <Link href="/admin/channels">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="flex h-54 items-center justify-center rounded-lg border border-dashed text-center">
          <div className="max-w-sm px-6">
            <div className="font-medium text-sm">Channel attribution is empty</div>
            <div className="mt-1 text-muted-foreground text-sm">
              Connect channel analytics before traffic source shares are shown.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
