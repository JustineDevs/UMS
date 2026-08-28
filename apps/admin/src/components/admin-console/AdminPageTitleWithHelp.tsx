"use client";

import { usePathname } from "next/navigation";
import { getAdminPageHelp } from "@/config/admin-page-help";
import { AdminPageHelpTip } from "./AdminPageHelpTip";

export function AdminPageTitleWithHelp({ title }: { title: string }) {
  const pathname = usePathname() ?? "";
  const help = getAdminPageHelp(pathname);

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <h1 className="font-headline text-2xl font-semibold leading-8 tracking-tight text-primary">
        {title}
      </h1>
      {help ? <AdminPageHelpTip purpose={help.purpose} usage={help.usage} /> : null}
    </div>
  );
}
