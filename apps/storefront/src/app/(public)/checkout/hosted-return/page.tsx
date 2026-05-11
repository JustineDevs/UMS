import { HostedCheckoutReturn } from "@/components/HostedCheckoutReturn";
import {
  normalizeHostedReturnProvider,
  normalizeHostedReturnStatus,
} from "@/lib/hosted-payment-return";

export default async function HostedReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string;
    status?: string;
  }>;
}) {
  const sp = await searchParams;
  const provider = normalizeHostedReturnProvider(sp.provider);
  const status = normalizeHostedReturnStatus(sp.status);
  return <HostedCheckoutReturn provider={provider} status={status} />;
}
