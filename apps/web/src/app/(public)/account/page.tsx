import { redirect } from "next/navigation";

/**
 * Keep the account root canonical. The profile route owns the account shell;
 * this entry point exists for bookmarks and global account links.
 */
export default function AccountIndexPage() {
  redirect("/account/profile");
}
