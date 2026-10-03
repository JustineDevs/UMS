import { redirect } from "next/navigation";

export default async function CmsBuilderPage() {
  redirect("/admin/build");
}
