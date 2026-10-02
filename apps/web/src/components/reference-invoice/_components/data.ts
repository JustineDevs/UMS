import { addDays, format } from "date-fns";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTaxOption {
  id: string;
  name: string;
  rate: number;
}

type InvoiceDiscountType = "fixed" | "percent";

export const INVOICE_PAPER_WIDTH = 816;
export const INVOICE_PAPER_HEIGHT = 1056;
export const INVOICE_PAPER_SCALE = 0.6;

interface InvoiceFromDetails {
  name: string;
  email: string;
  phone: string;
  website: string;
  addressLines: string[];
  taxId: string;
  issuerName: string;
}

export interface InvoiceToDetails {
  id: string;
  name: string;
  email: string;
  addressLines: string[];
  taxId: string;
}

export interface InvoiceFormValues {
  referenceNumber: string;
  issuedDate: string;
  paymentDueDate: string;
  from: InvoiceFromDetails;
  to: InvoiceToDetails;
  taxId: string;
  discountType: InvoiceDiscountType;
  discountValue: number;
  items: InvoiceLineItem[];
}

export type InvoiceSubmissionError = {
  field: string;
  message: string;
};

export function getDefaultInvoiceValues(now = new Date()): InvoiceFormValues {
  const today = now;
  return {
  referenceNumber: `INV-${format(today, "yyyyMMdd-HHmmss")}`,
  issuedDate: format(today, "yyyy-MM-dd"),
  paymentDueDate: format(addDays(today, 14), "yyyy-MM-dd"),
  from: {
    name: "Universal Music Store",
    email: "contact@universal-music-store.store",
    phone: "",
    website: "universal-music-store.store",
    addressLines: [],
    taxId: "",
    issuerName: "",
  },
  to: {
    id: "",
    name: "",
    email: "",
    addressLines: [],
    taxId: "",
  },
  taxId: "vat",
  discountType: "fixed",
  discountValue: 0,
  items: [{ id: "item-1", description: "", quantity: 1, unitPrice: 0 }],
  };
}

export const invoiceTaxOptions: InvoiceTaxOption[] = [
  {
    id: "gst",
    name: "GST",
    rate: 18,
  },
  {
    id: "vat",
    name: "VAT",
    rate: 12,
  },
  {
    id: "service-tax",
    name: "Service Tax",
    rate: 10,
  },
  {
    id: "none",
    name: "No Tax",
    rate: 0,
  },
];

export function getLineAmount(item?: InvoiceLineItem) {
  if (!item) return 0;

  const quantity = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? Math.max(item.unitPrice, 0) : 0;

  return quantity * unitPrice;
}

export function getInvoiceItems(invoice: InvoiceFormValues) {
  return invoice.items;
}

export function getInvoiceSubtotal(invoice: InvoiceFormValues) {
  return getInvoiceItems(invoice).reduce((subtotal, item) => subtotal + getLineAmount(item), 0);
}

export function getInvoiceTaxOption(invoice: InvoiceFormValues) {
  return invoiceTaxOptions.find((taxOption) => taxOption.id === invoice.taxId) ?? invoiceTaxOptions[0];
}

export function getInvoiceTax(invoice: InvoiceFormValues) {
  const taxRate = getInvoiceTaxOption(invoice).rate;

  return Math.max(getInvoiceSubtotal(invoice) - getInvoiceDiscount(invoice), 0) * (taxRate / 100);
}

export function getInvoiceDiscount(invoice: InvoiceFormValues) {
  const subtotal = getInvoiceSubtotal(invoice);
  const discountValue = Number.isFinite(invoice.discountValue) ? invoice.discountValue : 0;
  const discount = invoice.discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;

  return Math.min(Math.max(discount, 0), subtotal);
}

export function getInvoiceTotal(invoice: InvoiceFormValues) {
  return Math.max(getInvoiceSubtotal(invoice) - getInvoiceDiscount(invoice), 0) + getInvoiceTax(invoice);
}

export function getInvoiceSubmissionErrors(invoice: InvoiceFormValues): InvoiceSubmissionError[] {
  const errors: InvoiceSubmissionError[] = [];
  if (!invoice.referenceNumber.trim()) errors.push({ field: "referenceNumber", message: "Reference number is required." });
  if (!invoice.to.id || !invoice.to.email.includes("@")) errors.push({ field: "to", message: "Select a valid client before saving the invoice." });
  if (!invoice.items.length) errors.push({ field: "items", message: "Add at least one invoice item." });

  invoice.items.forEach((item, index) => {
    if (!item.description.trim()) errors.push({ field: `items.${index}.description`, message: `Item ${index + 1} needs a description.` });
    if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push({ field: `items.${index}.quantity`, message: `Item ${index + 1} quantity must be at least 1.` });
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) errors.push({ field: `items.${index}.unitPrice`, message: `Item ${index + 1} price cannot be negative.` });
  });

  const issued = Date.parse(invoice.issuedDate);
  const due = Date.parse(invoice.paymentDueDate);
  if (!Number.isFinite(issued) || !Number.isFinite(due)) errors.push({ field: "dates", message: "Enter valid invoice dates." });
  else if (due < issued) errors.push({ field: "paymentDueDate", message: "Due date cannot be before the issued date." });

  if (invoice.discountType === "percent" && invoice.discountValue > 100) errors.push({ field: "discountValue", message: "Percentage discount cannot exceed 100%." });
  if (!Number.isFinite(invoice.discountValue) || invoice.discountValue < 0) errors.push({ field: "discountValue", message: "Discount must be zero or greater." });
  return errors;
}

export function toInvoiceCreatePayload(invoice: InvoiceFormValues) {
  return {
    referenceNumber: invoice.referenceNumber.trim(),
    to: { id: invoice.to.id, email: invoice.to.email.trim() },
    items: invoice.items.map(({ description, quantity, unitPrice }) => ({ description: description.trim(), quantity, unitPrice })),
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    taxRate: getInvoiceTaxOption(invoice).rate,
  };
}
