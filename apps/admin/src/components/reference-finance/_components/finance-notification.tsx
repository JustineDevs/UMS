import { AlertCircle, ArrowRight } from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

export function FinanceNotification() {
  return (
    <Item className="rounded-xl" variant="outline">
      <ItemMedia variant="icon">
        <AlertCircle />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Payment account status</ItemTitle>
        <ItemDescription>Connect a merchant account to enable payment operations.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button asChild size="sm" variant="outline">
          <Link
            href="/admin/settings/payments?tab=accounts"
            aria-label="Connect a merchant payment account"
          >
            Connect <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
