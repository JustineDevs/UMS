import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsEntryPage() {
  await requirePagePermission("content:read");
  redirect("/admin/cms/builder");
}
