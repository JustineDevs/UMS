import type { PrinterAdapterCapabilities } from "@universal-music-store/printer-core";

/**
 * Declares hardware paths implemented in this agent build.
 */
export function listAdapterCapabilities(): PrinterAdapterCapabilities[] {
  const devOnlyAdapter: PrinterAdapterCapabilities[] =
    process.env.NODE_ENV === "production"
      ? []
      : [{ id: "mock", label: "Development adapter (stdout / dev file)", available: true }];

  return [
    { id: "escpos-tcp", label: "ESC/POS over TCP (port 9100)", available: true },
    { id: "node-escpos-network", label: "node-escpos network adapter (port 9100)", available: true },
    ...devOnlyAdapter,
    {
      id: "http-relay",
      label: "HTTP relay (POST application/octet-stream)",
      available: true,
    },
    {
      id: "qz-tray",
      label: "QZ Tray relay (HTTP POST to local bridge)",
      available: true,
    },
    {
      id: "star-cloudprnt",
      label: "Star CloudPRNT (poll GET /cloudprnt)",
      available: true,
    },
    {
      id: "epson-epos",
      label: "Epson raw print (HTTP POST octet-stream)",
      available: true,
    },
  ];
}
