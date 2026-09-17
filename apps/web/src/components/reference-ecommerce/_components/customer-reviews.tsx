import { ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomerReviews() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Reviews</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          No review summary
        </CardDescription>
        <CardAction>
          <Button aria-label="Open product reviews" asChild size="icon-sm" variant="ghost">
            <Link href="/admin/reviews">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex min-h-[7.5rem] items-center justify-center text-center">
            <div className="max-w-xs">
              <div aria-hidden="true" className="mb-3 flex justify-center gap-0.5 text-muted-foreground">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star className="size-3.5" key={index} />
                ))}
              </div>
              <div className="font-medium text-sm">No recent review loaded</div>
              <div className="mt-1 text-muted-foreground text-sm">
                Approved or pending reviews can be managed from the reviews workspace.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
          <div className="min-w-0">
            <div className="font-medium text-sm">Review moderation available</div>
            <div className="line-clamp-2 min-h-[3em] text-muted-foreground text-xs">Open product reviews to view live customer submissions.</div>
          </div>

          <Button asChild size="sm" variant="outline">
            <Link href="/admin/reviews">Open</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
