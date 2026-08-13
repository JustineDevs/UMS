import { redirect } from "next/navigation";

/** Compatibility redirect; the builder is the single CMS workspace. */
export default function CmsOverviewRedirect() {
  redirect("/admin/cms/builder");
}
