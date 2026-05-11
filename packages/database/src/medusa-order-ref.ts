/**
 * Runtime assertion helpers that enforce the medusa_order_id integrity rule
 * documented in docs/data-ownership.md and enforced by migration
 * 030_require_medusa_order_id_receipts_voids.sql.
 *
 * Use assertMedusaOrderRef before inserting rows into:
 *   - public.digital_receipts
 *   - public.pos_voids
 *
 * Any insert that carries an order reference MUST provide the medusa_order_id.
 */
export class MissingMedusaOrderRefError extends Error {
  constructor(table: string, orderId: string) {
    super(
      `[${table}] medusa_order_id is required when order_id is set. ` +
        `order_id="${orderId}" was provided without a medusa_order_id. ` +
        `Resolve the Medusa order id before inserting.`,
    );
    this.name = "MissingMedusaOrderRefError";
  }
}

/**
 * Throws if the payload supplies an order_id but omits or blanks medusa_order_id.
 *
 * @param table   Table name for the error message (e.g. "digital_receipts").
 * @param payload Row payload before insert.
 */
export function assertMedusaOrderRef(
  table: string,
  payload: {
    order_id?: string | null;
    medusa_order_id?: string | null;
  },
): void {
  const orderId = payload.order_id?.trim();
  const medusaOrderId = payload.medusa_order_id?.trim();
  if (orderId && !medusaOrderId) {
    throw new MissingMedusaOrderRefError(table, orderId);
  }
}
