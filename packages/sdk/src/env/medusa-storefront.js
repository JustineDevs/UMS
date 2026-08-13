import { getMedusaPublishableKey, getMedusaRegionId, getMedusaSalesChannelId, getMedusaSecretApiKey, getMedusaStoreBaseUrl, } from "../medusa-env.js";
const STOREFRONT_DEPLOY_ENV_HINT = "Configure these on the host (Vercel/Render env UI), not only local .env.local files. See repo docs for the Medusa storefront env checklist.";
export function listMissingMedusaStorefrontEnv() {
    const missing = [];
    if (!getMedusaPublishableKey()) {
        missing.push("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (or MEDUSA_PUBLISHABLE_API_KEY)");
    }
    if (!getMedusaRegionId()) {
        missing.push("NEXT_PUBLIC_MEDUSA_REGION_ID (or MEDUSA_REGION_ID)");
    }
    if (process.env.NODE_ENV === "production") {
        const base = getMedusaStoreBaseUrl().toLowerCase();
        if (base.includes("localhost") || base.includes("127.0.0.1")) {
            missing.push("NEXT_PUBLIC_MEDUSA_URL / MEDUSA_BACKEND_URL must be a public HTTPS origin in production (not localhost)");
        }
        if (!getMedusaSalesChannelId()) {
            missing.push("NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID (or MEDUSA_SALES_CHANNEL_ID) so listings, carts, and Medusa seed use the same channel");
        }
        if (!getMedusaSecretApiKey()) {
            missing.push("MEDUSA_SECRET_API_KEY (or MEDUSA_ADMIN_API_SECRET) for server-side checkout, totals, and inventory checks against Medusa Admin API");
        }
    }
    return missing;
}
export function assertMedusaStorefrontEnvProduction() {
    if (process.env.NODE_ENV !== "production") {
        return;
    }
    const missing = listMissingMedusaStorefrontEnv();
    if (missing.length > 0) {
        throw new Error(`Medusa storefront: required env missing: ${missing.join("; ")}. ${STOREFRONT_DEPLOY_ENV_HINT}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkdXNhLXN0b3JlZnJvbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtZWR1c2Etc3RvcmVmcm9udC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsdUJBQXVCLEVBQ3ZCLGlCQUFpQixFQUNqQix1QkFBdUIsRUFDdkIscUJBQXFCLEVBQ3JCLHFCQUFxQixHQUN0QixNQUFNLGtCQUFrQixDQUFDO0FBRTFCLE1BQU0sMEJBQTBCLEdBQzlCLDZJQUE2SSxDQUFDO0FBRWhKLE1BQU0sVUFBVSw4QkFBOEI7SUFDNUMsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQzdCLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLENBQUM7UUFDL0IsT0FBTyxDQUFDLElBQUksQ0FDVixvRUFBb0UsQ0FDckUsQ0FBQztJQUNKLENBQUM7SUFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sQ0FBQyxJQUFJLENBQUMsb0RBQW9ELENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBQ0QsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUUsQ0FBQztRQUMxQyxNQUFNLElBQUksR0FBRyxxQkFBcUIsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25ELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDN0QsT0FBTyxDQUFDLElBQUksQ0FDVix5R0FBeUcsQ0FDMUcsQ0FBQztRQUNKLENBQUM7UUFDRCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxDQUFDO1lBQy9CLE9BQU8sQ0FBQyxJQUFJLENBQ1YsMkhBQTJILENBQzVILENBQUM7UUFDSixDQUFDO1FBQ0QsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEVBQUUsQ0FBQztZQUM3QixPQUFPLENBQUMsSUFBSSxDQUNWLG9JQUFvSSxDQUNySSxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsTUFBTSxVQUFVLG1DQUFtQztJQUNqRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRSxDQUFDO1FBQzFDLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsOEJBQThCLEVBQUUsQ0FBQztJQUNqRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FDYiw0Q0FBNEMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSywwQkFBMEIsRUFBRSxDQUNoRyxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUMifQ==