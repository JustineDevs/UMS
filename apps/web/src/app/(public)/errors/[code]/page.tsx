import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HttpErrorPage } from "@/components/HttpErrorPage";
import {
  HTTP_ERROR_CODES,
  getHttpErrorCopy,
  isHttpErrorCode,
} from "@/lib/http-error-copy";

type Props = { params: Promise<{ code: string }> };

export function generateStaticParams() {
  return HTTP_ERROR_CODES.map((code) => ({ code: String(code) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code: raw } = await params;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isHttpErrorCode(n)) {
    return { title: "Error" };
  }
  const copy = getHttpErrorCopy(n);
  return {
    title: copy ? `${n} ${copy.title}` : `Error ${n}`,
    description: copy?.description,
    robots: { index: false, follow: true },
  };
}

export default async function HttpErrorCodePage({ params }: Props) {
  const { code: raw } = await params;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !isHttpErrorCode(n)) {
    notFound();
  }
  return <HttpErrorPage code={n} />;
}
