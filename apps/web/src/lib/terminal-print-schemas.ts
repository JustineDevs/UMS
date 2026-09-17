import { z } from "zod";

const receiptLineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    value: z.string().max(500),
    bold: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("separator") }),
  z.object({
    kind: z.literal("keyValue"),
    key: z.string().max(200),
    value: z.string().max(200),
  }),
]);

const posReceiptPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  orderRef: z.string().min(1).max(200),
  offline: z.boolean().optional(),
  lines: z.array(receiptLineSchema).max(100),
  subtotalLabel: z.string().max(40).optional(),
  subtotal: z.string().max(40),
  taxLabel: z.string().max(60).optional(),
  tax: z.string().max(40),
  totalLabel: z.string().max(40).optional(),
  total: z.string().max(40),
  footer: z.string().max(500).optional(),
});

const printerOverrideSchema = z.object({
  host: z.string().max(200),
  port: z.number().int().min(1).max(65535),
});

export const terminalPrintBodySchema = z.object({
  receipt: posReceiptPayloadSchema,
  adapter: z.string().max(64).optional(),
  printer: printerOverrideSchema.optional(),
});

const productLabelPayloadSchema = z.object({
  productName: z.string().min(1).max(200),
  sku: z.string().max(120),
  barcode: z.string().max(64).optional(),
  size: z.string().max(80).optional(),
  color: z.string().max(80).optional(),
  priceDisplay: z.string().min(1).max(40),
});

export const terminalPrintLabelBodySchema = z.object({
  label: productLabelPayloadSchema,
  adapter: z.string().max(64).optional(),
  printer: printerOverrideSchema.optional(),
});
