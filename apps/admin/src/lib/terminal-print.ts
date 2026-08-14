import type { ProductLabelPayload } from "@universal-music-store/printer-core";
import { PH_VAT_RATE } from "@universal-music-store/sdk";

export type PosReceiptPayload = {
  title: string;
  orderRef: string;
  offline?: boolean;
  lines: Array<
    | { kind: "text"; value: string; bold?: boolean }
    | { kind: "separator" }
    | { kind: "keyValue"; key: string; value: string }
  >;
  subtotalLabel?: string;
  subtotal: string;
  taxLabel?: string;
  tax: string;
  totalLabel?: string;
  total: string;
  footer?: string;
};

export function buildPosReceiptPayloadFromCart(
  cart: Array<{ name: string; qty: number; price: number }>,
  orderRef: string,
  subtotal: number,
  tax: number,
  total: number,
  offline?: boolean,
): PosReceiptPayload {
  const lines: PosReceiptPayload["lines"] = [];
  for (const c of cart) {
    lines.push({
      kind: "keyValue",
      key: `${c.name} x${c.qty}`,
      value: `PHP ${(c.price * c.qty).toFixed(2)}`,
    });
  }
  lines.push({ kind: "separator" });
  return {
    title: "Universal Music Store POS",
    orderRef,
    offline,
    lines,
    subtotal: `PHP ${subtotal.toFixed(2)}`,
    tax: `PHP ${tax.toFixed(2)}`,
    total: `PHP ${total.toFixed(2)}`,
    subtotalLabel: "Subtotal",
    taxLabel: `VAT (${(PH_VAT_RATE * 100).toFixed(0)}%)`,
    totalLabel: "TOTAL",
    footer: "Thank you",
  };
}

function terminalAgentBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:17711"
  );
}

function printUsesServerProxy(): boolean {
  return process.env.NEXT_PUBLIC_TERMINAL_PRINT_VIA_API === "true";
}

function printReceiptUrl(): string {
  if (printUsesServerProxy()) {
    return "/api/admin/terminal-print";
  }
  return `${terminalAgentBaseUrl()}/print-receipt`;
}

function printLabelUrl(): string {
  if (printUsesServerProxy()) {
    return "/api/admin/terminal-print-label";
  }
  return `${terminalAgentBaseUrl()}/print-label`;
}

function openDrawerUrl(): string {
  if (printUsesServerProxy()) {
    return "/api/admin/terminal-open-drawer";
  }
  return `${terminalAgentBaseUrl()}/open-drawer`;
}

function printingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TERMINAL_AGENT_ENABLED !== "false";
}

export async function printReceiptToTerminalAgent(
  receipt: PosReceiptPayload,
): Promise<void> {
  if (!printingEnabled()) return;
  const adapter =
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_ADAPTER?.trim() || "escpos-tcp";
  const res = await fetch(printReceiptUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt, adapter }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof j.error === "string" ? j.error : "Receipt print did not complete",
    );
  }
}

export function buildProductLabelPayloadFromLineItem(item: {
  name: string;
  sku: string;
  barcode?: string;
  size: string;
  color: string;
  price: number;
}): ProductLabelPayload {
  return {
    productName: item.name,
    sku: item.sku,
    barcode: item.barcode,
    size: item.size,
    color: item.color,
    priceDisplay: `PHP ${item.price.toFixed(2)}`,
  };
}

export async function printProductLabelToTerminalAgent(
  label: ProductLabelPayload,
): Promise<void> {
  if (!printingEnabled()) return;
  const adapter =
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_ADAPTER?.trim() || "escpos-tcp";
  const res = await fetch(printLabelUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, adapter }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof j.error === "string" ? j.error : "Label print did not complete",
    );
  }
}

export async function openCashDrawerRequest(): Promise<void> {
  if (!printingEnabled()) return;
  const res = await fetch(openDrawerUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof j.error === "string" ? j.error : "Drawer command did not complete",
    );
  }
}

export function fireAndForgetPrint(
  receipt: PosReceiptPayload,
  onError?: (_msg: string) => void,
): void {
  void printReceiptToTerminalAgent(receipt).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "Print did not complete";
    if (onError) onError(msg);
  });
}

export function fireAndForgetPrintLabel(
  label: ProductLabelPayload,
  onError?: (_msg: string) => void,
): void {
  void printProductLabelToTerminalAgent(label).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "Label print did not complete";
    if (onError) onError(msg);
  });
}
