"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CmsPagesManager = dynamic(
  () => import("./CmsPagesManager").then((module) => module.CmsPagesManager),
  { ssr: false },
);

export function CmsBuilderPageClient({
  onClosePath = "/admin",
}: {
  onClosePath?: string;
}) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 min-w-0 overflow-hidden bg-slate-100">
      <CmsPagesManager
        startInBuilder
        onBuilderClose={() => {
          const previousUrl = document.referrer;
          const canReturnToAdmin = (() => {
            if (!previousUrl) return false;
            try {
              const previous = new URL(previousUrl);
              return previous.origin === window.location.origin && previous.pathname.startsWith("/admin");
            } catch {
              return false;
            }
          })();
          if (canReturnToAdmin && window.history.length > 1) router.back();
          else router.push(onClosePath);
        }}
      />
    </div>
  );
}
