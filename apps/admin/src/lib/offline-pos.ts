const DB_NAME = "pos_offline_queue";
const STORE_NAME = "pending_sales";
const DB_VERSION = 1;

export type OfflineSalePayload = {
  id: string;
  device_name: string;
  employee_id?: string;
  items: Array<{
    variantId: string;
    quantity: number;
    price: number;
    name: string;
  }>;
  total: number;
  created_at: string;
  shiftId?: string;
  posFeatures?: {
    orderTag?: string;
    eInvoiceRequested?: boolean;
    eInvoiceCustomerEmail?: string;
    eInvoiceCustomerTin?: string;
  };
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeOfflineSale(
  sale: OfflineSalePayload,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales(): Promise<OfflineSalePayload[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineSale(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPendingSales(): Promise<{
  synced: number;
  failed: number;
}> {
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const res = await fetch("/api/pos/medusa/commit-sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `offline-sync-${sale.id}`,
        },
        body: JSON.stringify({
          offlineSaleId: sale.id,
          shiftId: sale.shiftId,
          paymentMethod: "cash",
          receiptReference: `offline:${sale.id}`,
          items: sale.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          posFeatures: sale.posFeatures,
        }),
      });

      if (res.ok) {
        await removeOfflineSale(sale.id);

        await fetch("/api/admin/offline-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_name: sale.device_name,
            employee_id: sale.employee_id,
            payload: sale,
          }),
        })
          .then(async (qRes) => {
            if (qRes.ok) {
              const { data } = await qRes.json();
              if (data?.id) {
                await fetch("/api/admin/offline-queue", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: data.id, action: "synced" }),
                });
              }
            }
          })
          .catch(() => {});

        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
