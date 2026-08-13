import assert from "node:assert/strict";
import test from "node:test";
import { calculatePosReconciliation, countCash, validateFiscalProfile, validateTerminalCertification } from "./pos-enterprise.js";

test("POS enterprise controls calculate cashier variance", () => assert.equal(calculatePosReconciliation({ openingCash: 100, cashSales: 500, cashRefunds: 20, payouts: 30, countedCash: 540 }).variance, -10));
test("POS enterprise controls count denominations", () => { assert.equal(countCash([{ denomination: 100, quantity: 2 }, { denomination: 5, quantity: 1 }]), 205); assert.throws(() => countCash([{ denomination: 1, quantity: -1 }])); });
test("POS enterprise controls validate fiscal and terminal records", () => { assert.equal(validateFiscalProfile({ jurisdiction: "ph", registrationNumber: "TIN-1", invoicePrefix: "UVS", enabled: true }).jurisdiction, "PH"); assert.equal(validateTerminalCertification({ provider: "Acme", model: "T1", firmware: "1.0", certificationId: "CERT-1" }).provider, "Acme"); });
