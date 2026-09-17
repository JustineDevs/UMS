import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Wallet() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Wallet</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">No merchant accounts are connected.</p>
        <p className="mt-2 text-muted-foreground text-xs">Connect Stripe, PayPal, or Xendit through the Accounts tab to show balances here.</p>
      </CardContent>
    </Card>
  );
}
