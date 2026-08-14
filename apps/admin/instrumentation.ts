export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const adminNextAuthUrl = process.env.ADMIN_NEXTAUTH_URL?.trim();
  if (adminNextAuthUrl) {
    process.env.NEXTAUTH_URL = adminNextAuthUrl;
  }
  const { assertAdminMedusaEnvProduction } = await import(
    "@universal-music-store/sdk"
  );
  assertAdminMedusaEnvProduction();

  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXTAUTH_SECRET?.trim()) {
      throw new Error("Admin: NEXTAUTH_SECRET is required in production");
    }
    if (
      !process.env.GOOGLE_CLIENT_ID?.trim() ||
      !process.env.GOOGLE_CLIENT_SECRET?.trim()
    ) {
      console.warn(
        "[admin] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — OAuth sign-in will not work",
      );
    }
  }
}
