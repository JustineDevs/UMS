import { AdminDashboardChrome } from "@/components/AdminDashboardChrome";
import { SupabaseSessionProvider } from "@/components/SupabaseSessionProvider";
import { adminCommandPaletteEnabled } from "@/lib/flags";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const commandPaletteEnabled = await adminCommandPaletteEnabled();
  const localAuthBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  return (
    <SupabaseSessionProvider>
      <NuqsAdapter>
        <AdminDashboardChrome
          commandPaletteEnabled={commandPaletteEnabled}
          localAuthBypass={localAuthBypass}
        >
          {children}
        </AdminDashboardChrome>
      </NuqsAdapter>
    </SupabaseSessionProvider>
  );
}
