import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const segmentColors = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)"] as const;

export function TopProducts({
  products = [],
}: {
  products?: { name: string; category: string; share: number; stock: number }[];
}) {
  const hasProducts = products.length > 0;
  const summary = hasProducts ? `${products.reduce((sum, product) => sum + product.stock, 0).toLocaleString()} units tracked` : "No stock leaders yet";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Stocked Products</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {summary}
        </CardDescription>
        <CardAction>
          <Button aria-label="Open catalog" asChild size="icon-sm" variant="ghost">
            <Link href="/admin/catalog">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {hasProducts ? (
          <>
            <div className="flex flex-col gap-2">
              <div aria-label="Stock share by product" className="flex h-2 gap-1 overflow-hidden bg-muted" role="img">
                {products.map((product, index) => (
                  <div
                    aria-hidden="true"
                    key={product.name}
                    className="rounded-md"
                    style={{
                      backgroundColor: segmentColors[index % segmentColors.length],
                      width: `${product.share}%`,
                    }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                {products.map((product, index) => (
                  <div className="flex items-center gap-1" key={product.name}>
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ backgroundColor: segmentColors[index % segmentColors.length] }}
                    />
                    <span className="text-muted-foreground text-xs">{product.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
              <div className="text-muted-foreground text-xs">Products</div>
              <div className="text-muted-foreground text-xs">Share</div>
              <div className="text-muted-foreground text-xs">Stock</div>

              {products.map((product) => (
                <div className="contents text-sm" key={product.name}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{product.name}</div>
                    <div className="text-muted-foreground text-xs">{product.category}</div>
                  </div>
                  <div className="self-center text-muted-foreground tabular-nums">{product.share}%</div>
                  <div className="self-center font-medium tabular-nums">{product.stock.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-43 items-center justify-center rounded-lg border border-dashed text-center">
            <div className="max-w-xs px-6">
              <div className="font-medium text-sm">No inventory distribution</div>
              <div className="mt-1 text-muted-foreground text-sm">
                Stock leaders will appear after product variants report available quantities.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
