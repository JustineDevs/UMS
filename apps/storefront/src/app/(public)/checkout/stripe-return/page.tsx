import { HostedCheckoutReturn } from "@/components/HostedCheckoutReturn";

export default function StripeCheckoutReturnPage() {
  return <HostedCheckoutReturn provider="stripe" status="success" />;
}
