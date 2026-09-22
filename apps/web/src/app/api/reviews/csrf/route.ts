import { NextResponse } from "next/server";
import { createReviewCsrfToken, reviewCsrfCookieName } from "@/lib/review-csrf";
import { reviewCsrfResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function GET() {
  const token = createReviewCsrfToken();
  const response = NextResponse.json(reviewCsrfResponseSchema.parse({ token }));
  response.cookies.set(reviewCsrfCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
    path: "/",
  });
  return response;
}
