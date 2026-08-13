/* global jest, describe, it, expect, beforeEach, afterAll */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { POST } from "./route";
import { createClient } from "@supabase/supabase-js";

const mockCreateRun = jest.fn();
const mockDeleteRun = jest.fn();

jest.mock("@medusajs/medusa/core-flows", () => ({
  createReservationsWorkflow: jest.fn(() => ({ run: mockCreateRun })),
  deleteReservationsWorkflow: jest.fn(() => ({ run: mockDeleteRun })),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

function createRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function createReq(body: unknown, options?: { stocked?: number; reserved?: number }) {
  const inventory = {
    listInventoryLevels: jest.fn().mockResolvedValue([
      {
        stocked_quantity: options?.stocked ?? 10,
        reserved_quantity: options?.reserved ?? 3,
      },
    ]),
  };
  const logger = { info: jest.fn() };
  return {
    body,
    headers: {},
    auth_context: { actor_id: "user_1" },
    scope: {
      resolve(token: unknown) {
        if (token === Modules.INVENTORY) return inventory;
        if (token === ContainerRegistrationKeys.LOGGER) return logger;
        throw new Error(`unexpected token ${String(token)}`);
      },
    },
    __inventory: inventory,
    __logger: logger,
  };
}

describe("inventory reservation lifecycle route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };
    mockCreateRun.mockResolvedValue({ result: [{ id: "medusa_res_1" }] });
    mockDeleteRun.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reserves through the ledger before creating the Medusa reservation", async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: { id: "res_1", tenant_id: "org_1", status: "active" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "res_1",
          tenant_id: "org_1",
          status: "active",
          medusa_reservation_id: "medusa_res_1",
        },
        error: null,
      });
    (createClient as jest.Mock).mockReturnValue({ rpc });
    const req = createReq({
      operation: "reserve",
      tenant_id: "org_1",
      location_id: "loc_1",
      inventory_item_id: "item_1",
      quantity: 2,
      idempotency_key: "reserve-key-1",
    });
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(req.__inventory.listInventoryLevels).toHaveBeenCalledWith({
      inventory_item_id: "item_1",
      location_id: "loc_1",
    });
    expect(rpc).toHaveBeenCalledWith(
      "inventory_reservation_lifecycle",
      expect.objectContaining({
        p_operation: "reserve",
        p_tenant_id: "org_1",
        p_available_quantity: 7,
      }),
    );
    expect(mockCreateRun).toHaveBeenCalledWith({
      input: {
        reservations: [
          expect.objectContaining({
            inventory_item_id: "item_1",
            location_id: "loc_1",
            quantity: 2,
          }),
        ],
      },
    });
    expect(res.body).toMatchObject({ medusa_reservation_id: "medusa_res_1" });
  });

  it("reuses idempotent reserve ledger rows without creating duplicate Medusa reservations", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: "res_1",
        tenant_id: "org_1",
        status: "active",
        medusa_reservation_id: "medusa_res_1",
      },
      error: null,
    });
    (createClient as jest.Mock).mockReturnValue({ rpc });
    const req = createReq({
      operation: "reserve",
      tenant_id: "org_1",
      location_id: "loc_1",
      inventory_item_id: "item_1",
      quantity: 2,
      idempotency_key: "reserve-key-1",
    });
    const res = createRes();

    await POST(req as never, res as never);

    expect(mockCreateRun).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ medusa_reservation_id: "medusa_res_1" });
  });

  it("release and commit close the backing Medusa reservation", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: "res_1",
        tenant_id: "org_1",
        status: "released",
        medusa_reservation_id: "medusa_res_1",
      },
      error: null,
    });
    (createClient as jest.Mock).mockReturnValue({ rpc });
    const req = createReq({
      operation: "release",
      tenant_id: "org_1",
      reservation_id: "res_1",
      idempotency_key: "release-key-1",
    });
    const res = createRes();

    await POST(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith(
      "inventory_reservation_lifecycle",
      expect.objectContaining({ p_operation: "release", p_tenant_id: "org_1" }),
    );
    expect(mockDeleteRun).toHaveBeenCalledWith({
      input: { ids: ["medusa_res_1"] },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid requests before inventory mutation", async () => {
    const req = createReq({ operation: "reserve" });
    const res = createRes();

    await POST(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(mockCreateRun).not.toHaveBeenCalled();
  });
});
