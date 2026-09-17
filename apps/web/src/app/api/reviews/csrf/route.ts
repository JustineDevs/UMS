import { NextResponse } from "next/server";
import { createReviewCsrfToken, reviewCsrfCookieName } from "@/lib/review-csrf";

export const dynamic = "force-dynamic";

export function GET() {
  const token = createReviewCsrfToken();
  const response = NextResponse.json({ token });
  response.cookies.set(reviewCsrfCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
    path: "/",
  });
  return response;
}
