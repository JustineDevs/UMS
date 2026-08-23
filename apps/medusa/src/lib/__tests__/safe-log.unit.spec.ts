import { describe, expect, it } from "@jest/globals";
import { safeLogIdentifier } from "../safe-log";

describe("safeLogIdentifier", () => {
  it("is deterministic and does not contain the original identifier", () => {
    const value = "order_123456789";
    const safe = safeLogIdentifier(value);

    expect(safe).toBe(safeLogIdentifier(value));
    expect(safe).toMatch(/^id_[a-f0-9]{16}$/);
    expect(safe).not.toContain(value);
  });

  it("handles empty identifiers without emitting raw input", () => {
    expect(safeLogIdentifier(null)).toBe("unknown");
    expect(safeLogIdentifier(" ")).toBe("unknown");
  });
});
