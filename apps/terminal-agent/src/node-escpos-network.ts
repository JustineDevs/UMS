import Network from "@node-escpos/network-adapter";

/**
 * Sends already-encoded ESC/POS bytes through the maintained node-escpos
 * network adapter. Keeping encoding separate preserves the existing receipt
 * and label contract while delegating socket lifecycle to the driver.
 */
export function sendNodeEscposNetwork(
  host: string,
  port: number,
  bytes: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const device = new Network(host, port);
    device.open((openError) => {
      if (openError) {
        reject(openError);
        return;
      }
      device.write(Buffer.from(bytes), (writeError) => {
        device.close(() => undefined);
        if (writeError) {
          reject(writeError);
          return;
        }
        resolve();
      });
    });
  });
}
