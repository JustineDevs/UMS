/**
 * Shared auth utilities used by both storefront and admin NextAuth configurations.
 * Provides common Google provider setup, JWT/session callback builders,
 * and session validation helpers for SSO alignment.
 */
/**
 * Reads and validates Google OAuth credentials from environment.
 * Logs a dev warning when credentials are missing.
 */
export function loadGoogleCredentials(appLabel) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
    const configured = Boolean(clientId && clientSecret);
    if (process.env.NODE_ENV === "development" && !configured) {
        console.warn(`[${appLabel} auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is empty. Google sign-in will not work. Check root .env.local.`);
    }
    return { clientId, clientSecret, configured };
}
/**
 * Standard JWT callback that maps user fields into the token.
 * Both apps share the same core fields: email, name, image.
 */
export function buildSharedJwtCallback() {
    return async function jwtCallback({ token, user, account, }) {
        if (user) {
            if (user.id)
                token.id = user.id;
            if (user.email)
                token.email = user.email;
            if (user.name !== undefined)
                token.name = user.name;
            if (user.image !== undefined)
                token.picture = user.image;
            if (user.role)
                token.role = user.role;
        }
        if (!token.id && account?.providerAccountId) {
            token.id = account.providerAccountId;
        }
        return token;
    };
}
/**
 * Standard session callback that hydrates session.user from the JWT token.
 * Admin extends this with RBAC lookup; storefront uses as-is.
 */
export function buildSharedSessionCallback() {
    return async function sessionCallback({ session, token, }) {
        if (session.user) {
            session.user.id =
                token.id ?? token.sub ?? session.user.id;
            session.user.email = token.email ?? undefined;
            session.user.name = token.name ?? undefined;
            session.user.image = token.picture ?? undefined;
            if (token.role) {
                session.user.role = token.role;
            }
        }
        return session;
    };
}
/**
 * Validates that a session has a signed-in user with an email.
 * Returns the normalized email or null for unauthenticated requests.
 */
export function extractSessionEmail(session) {
    const raw = session?.user?.email?.trim().toLowerCase();
    if (!raw || !raw.includes("@"))
        return null;
    return raw;
}
/**
 * Checks whether a session user has a role that grants staff-level access.
 * This is a lightweight check shared between admin and storefront.
 */
export function isSessionStaff(session) {
    const role = session?.user?.role;
    return role === "admin" || role === "staff";
}
/**
 * Normalizes email for consistent lookup/cache across both apps.
 */
export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1zaGFyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdXRoLXNoYXJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUg7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHFCQUFxQixDQUFDLFFBQWdCO0lBS3BELE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQzVELE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3BFLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksWUFBWSxDQUFDLENBQUM7SUFFckQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxhQUFhLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxRCxPQUFPLENBQUMsSUFBSSxDQUNWLElBQUksUUFBUSxnSEFBZ0gsQ0FDN0gsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsQ0FBQztBQUNoRCxDQUFDO0FBV0Q7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQjtJQUNwQyxPQUFPLEtBQUssVUFBVSxXQUFXLENBQUMsRUFDaEMsS0FBSyxFQUNMLElBQUksRUFDSixPQUFPLEdBV1I7UUFDQyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1QsSUFBSSxJQUFJLENBQUMsRUFBRTtnQkFBRSxLQUFLLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDaEMsSUFBSSxJQUFJLENBQUMsS0FBSztnQkFBRSxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDekMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVM7Z0JBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3BELElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO2dCQUFFLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUN6RCxJQUFJLElBQUksQ0FBQyxJQUFJO2dCQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN4QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksT0FBTyxFQUFFLGlCQUFpQixFQUFFLENBQUM7WUFDNUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUM7UUFDdkMsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSwwQkFBMEI7SUFDeEMsT0FBTyxLQUFLLFVBQVUsZUFBZSxDQUFDLEVBQ3BDLE9BQU8sRUFDUCxLQUFLLEdBSU47UUFDQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ1osS0FBSyxDQUFDLEVBQXlCLElBQUssS0FBSyxDQUFDLEdBQTBCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDM0YsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUksS0FBSyxDQUFDLEtBQTRCLElBQUksU0FBUyxDQUFDO1lBQ3RFLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFJLEtBQUssQ0FBQyxJQUEyQixJQUFJLFNBQVMsQ0FBQztZQUNwRSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBSSxLQUFLLENBQUMsT0FBOEIsSUFBSSxTQUFTLENBQUM7WUFDeEUsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQWMsQ0FBQztZQUMzQyxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQ2pDLE9BQW9EO0lBRXBELE1BQU0sR0FBRyxHQUFHLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3ZELElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzVDLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQzVCLE9BQTRDO0lBRTVDLE1BQU0sSUFBSSxHQUFHLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ2pDLE9BQU8sSUFBSSxLQUFLLE9BQU8sSUFBSSxJQUFJLEtBQUssT0FBTyxDQUFDO0FBQzlDLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsS0FBYTtJQUMxQyxPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNwQyxDQUFDIn0=