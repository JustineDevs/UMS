export type PosFeatureMapping = {
  key: "order_tag" | "e_invoice" | "receipt" | "customer_attribution";
  label: string;
  description: string;
  destination: "medusa_order_metadata" | "receipt_service" | "crm_bridge";
  adminRoutes: readonly string[];
  providerMappings?: readonly {
    provider: "pancake_pos";
    readEndpoint: string;
    writeEndpoint?: string;
    purpose: string;
  }[];
};

export const POS_FEATURE_MAPPINGS: readonly PosFeatureMapping[] = [
  {
    key: "order_tag",
    label: "Order tag",
    description: "Labels the sale for fulfillment, reporting, and follow-up.",
    destination: "medusa_order_metadata",
    adminRoutes: ["/admin/pos", "/admin/orders", "/admin/analytics"],
    providerMappings: [{
      provider: "pancake_pos",
      readEndpoint: "/shops/{SHOP_ID}/orders/tags",
      writeEndpoint: "/shops/{SHOP_ID}/orders/tags",
      purpose: "Use Pancake order tags for channel and fulfillment labels.",
    }],
  },
  {
    key: "e_invoice",
    label: "E-invoice request",
    description: "Carries the customer's invoice request and tax details with the sale.",
    destination: "medusa_order_metadata",
    adminRoutes: ["/admin/pos", "/admin/orders", "/admin/receipts"],
    providerMappings: [{
      provider: "pancake_pos",
      readEndpoint: "/shops/{SHOP_ID}/list_einvoices/",
      purpose: "Read Pancake e-invoice records alongside local invoice metadata.",
    }],
  },
  {
    key: "receipt",
    label: "Receipt and label printing",
    description: "Sends sale and item details to the connected receipt or label printer.",
    destination: "receipt_service",
    adminRoutes: ["/admin/pos", "/admin/receipts"],
    providerMappings: [{
      provider: "pancake_pos",
      readEndpoint: "/shops/{SHOP_ID}/products/get_logistics_shipping_document",
      purpose: "Use Pancake shipping documents where the connected channel owns the label.",
    }],
  },
  {
    key: "customer_attribution",
    label: "Customer attribution",
    description: "Keeps the staff member, shift, and store context attached to the sale.",
    destination: "crm_bridge",
    adminRoutes: ["/admin/pos", "/admin/crm", "/admin/audit"],
    providerMappings: [{
      provider: "pancake_pos",
      readEndpoint: "/shops/{SHOP_ID}/order_source",
      purpose: "Preserve Pancake page/source and staff context for CRM attribution.",
    }],
  },
] as const;

export type PosSaleFeatureMetadata = {
  orderTag?: string;
  eInvoiceRequested?: boolean;
  eInvoiceCustomerEmail?: string;
  eInvoiceCustomerTin?: string;
};

export function buildPosSaleFeatureMetadata(
  input: PosSaleFeatureMetadata,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = { pos_channel: "in_store" };
  if (input.orderTag?.trim()) metadata.pos_order_tag = input.orderTag.trim().slice(0, 80);
  if (input.eInvoiceRequested) {
    metadata.e_invoice_requested = true;
    if (input.eInvoiceCustomerEmail?.trim()) {
      metadata.e_invoice_customer_email = input.eInvoiceCustomerEmail.trim().slice(0, 320);
    }
    if (input.eInvoiceCustomerTin?.trim()) {
      metadata.e_invoice_customer_tin = input.eInvoiceCustomerTin.trim().slice(0, 40);
    }
  }
  return metadata;
}
