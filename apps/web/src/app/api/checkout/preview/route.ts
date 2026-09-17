import { handleNativeCheckoutPreview } from "@/lib/native-checkout-preview";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleNativeCheckoutPreview(req);
}
