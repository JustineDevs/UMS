import { NextResponse } from "next/server";

import { createCartBindToken } from "@/lib/cart-session-boundary";
import { cartBindTokenResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = createCartBindToken();
  const parsed = cartBindTokenResponseSchema.parse({ token });
  const response = NextResponse.json(
    parsed,
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );
  response.cookies.set("cart_bind_nonce", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
