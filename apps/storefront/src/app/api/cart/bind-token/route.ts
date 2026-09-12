import { NextResponse } from "next/server";

import { createCartBindToken } from "@/lib/cart-session-boundary";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = createCartBindToken();
  const response = NextResponse.json(
    { token },
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
