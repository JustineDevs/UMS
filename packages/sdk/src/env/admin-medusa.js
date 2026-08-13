import { getMedusaAdminBaseUrl, getMedusaSecretApiKey } from "../medusa-env.js";
export function assertAdminMedusaEnvProduction() {
    if (process.env.NODE_ENV !== "production") {
        return;
    }
    if (!getMedusaSecretApiKey()) {
        throw new Error("Admin: MEDUSA_SECRET_API_KEY (or MEDUSA_ADMIN_API_SECRET) is required in production.");
    }
    const base = getMedusaAdminBaseUrl().toLowerCase();
    if (base.includes("localhost") || base.includes("127.0.0.1")) {
        throw new Error("Admin: MEDUSA_BACKEND_URL / NEXT_PUBLIC_MEDUSA_URL must be a public HTTPS origin in production (not localhost).");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRtaW4tbWVkdXNhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWRtaW4tbWVkdXNhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRWhGLE1BQU0sVUFBVSw4QkFBOEI7SUFDNUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUUsQ0FBQztRQUMxQyxPQUFPO0lBQ1QsQ0FBQztJQUNELElBQUksQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FDYixzRkFBc0YsQ0FDdkYsQ0FBQztJQUNKLENBQUM7SUFDRCxNQUFNLElBQUksR0FBRyxxQkFBcUIsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ25ELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7UUFDN0QsTUFBTSxJQUFJLEtBQUssQ0FDYixpSEFBaUgsQ0FDbEgsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDIn0=