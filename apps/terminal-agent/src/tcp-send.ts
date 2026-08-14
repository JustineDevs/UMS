import net from "node:net";

export async function sendTcpRaw(
  host: string,
  port: number,
  data: Uint8Array,
  timeoutMs = 8000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(Buffer.from(data), (err) => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });
    const t = setTimeout(() => {
      socket.destroy(new Error(`TCP timeout ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    socket.on("close", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
