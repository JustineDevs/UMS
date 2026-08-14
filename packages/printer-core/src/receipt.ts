export type ReceiptLine =
  | { kind: "text"; value: string; bold?: boolean }
  | { kind: "separator" }
  | { kind: "keyValue"; key: string; value: string };

/**
 * Vendor-neutral receipt job sent from the POS UI to the local terminal agent.
 * The agent encodes ESC/POS (or other adapters) and sends bytes to hardware.
 */
export type ReceiptPayload = {
  title: string;
  orderRef: string;
  /** When true, receipt header shows OFFLINE (queued sale). */
  offline?: boolean;
  lines: ReceiptLine[];
  subtotalLabel?: string;
  subtotal: string;
  taxLabel?: string;
  tax: string;
  totalLabel?: string;
  total: string;
  footer?: string;
};

export type PrinterAdapterId =
  | "escpos-tcp"
  | "node-escpos-network"
  | "mock"
  | "http-relay"
  | "qz-tray"
  | "star-cloudprnt"
  | "epson-epos";

export type PrinterAdapterCapabilities = {
  id: PrinterAdapterId;
  label: string;
  /** True when this adapter is wired in the current agent build. */
  available: boolean;
};
