import { redirect } from "next/navigation";

export default async function SignInAliasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = new URLSearchParams();
  const values = await searchParams;
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  redirect(`/login${params.toString() ? `?${params.toString()}` : ""}`);
}
