import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeEscPosProductLabel,
  encodeEscPosReceipt,
  drawerOpenPulse,
} from "./escpos.js";

describe("encodeEscPosReceipt", () => {
  it("produces non-empty ESC/POS bytes with init and cut", () => {
    const buf = encodeEscPosReceipt({
      title: "TEST",
      orderRef: "ORD-1",
      lines: [{ kind: "text", value: "Item A" }],
      subtotal: "10.00",
      tax: "1.20",
      total: "11.20",
    });
    assert.ok(buf.length > 20);
    assert.equal(buf[0], 0x1b);
    assert.equal(buf[1], 0x40);
  });
});

describe("encodeEscPosProductLabel", () => {
  it("produces ESC/POS bytes with init and cut", () => {
    const buf = encodeEscPosProductLabel({
      productName: "Test Guitar",
      sku: "SKU-001",
      barcode: "4800123456789",
      size: "Standard",
      color: "Black",
      priceDisplay: "PHP 599.00",
    });
    assert.ok(buf.length > 30);
    assert.equal(buf[0], 0x1b);
    assert.equal(buf[1], 0x40);
    assert.ok(Buffer.from(buf).toString("latin1").includes("SKU-001"));
  });
});

describe("drawerOpenPulse", () => {
  it("emits ESC p drawer command", () => {
    const b = drawerOpenPulse();
    assert.equal(b[0], 0x1b);
    assert.equal(b[1], 0x70);
  });
});
