import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function tryCmsRedirect(request: NextRequest): Promise<NextResponse | null> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return null;
  const rest = `${url.replace(/\/$/, "")}/rest/v1/cms_redirects?from_path=eq.${encodeURIComponent(pathname)}&active=eq.true&select=to_path,status_code,preserve_query&limit=1`;
  try {
    const res = await fetch(rest, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      to_path: string;
      status_code: number;
      preserve_query?: boolean;
    }[];
    if (!rows?.length) return null;
    const { to_path, status_code, preserve_query: preserveQuery } = rows[0];
    const base = to_path.startsWith("http")
      ? new URL(to_path)
      : new URL(to_path.startsWith("/") ? to_path : `/${to_path}`, request.url);
    if (preserveQuery && request.nextUrl.search) {
      const incoming = new URLSearchParams(request.nextUrl.search);
      incoming.forEach((v, k) => {
        if (!base.searchParams.has(k)) base.searchParams.set(k, v);
      });
    }
    return NextResponse.redirect(
      base.toString(),
      status_code >= 300 && status_code < 400 ? status_code : 301,
    );
  } catch {
    return null;
  }
}
