import {
  emailFromCartRow,
  emailFromCustomerRow,
  needsCustomerEmailLookup,
} from "../loyalty-resolve-email";

describe("loyalty-resolve-email", () => {
  it("uses customer.email when present", () => {
    expect(
      emailFromCartRow({
        customer: { email: "A@Example.com" },
        email: "other@x.com",
      }),
    ).toBe("a@example.com");
  });

  it("falls back to cart email", () => {
    expect(emailFromCartRow({ email: "B@Example.com" })).toBe("b@example.com");
  });

  it("requests customer lookup when email missing but customer_id set", () => {
    const { lookupCustomerId } = needsCustomerEmailLookup({
      customer_id: "cus_123",
      email: "",
    });
    expect(lookupCustomerId).toBe("cus_123");
  });

  it("does not lookup when customer email exists", () => {
    const { lookupCustomerId } = needsCustomerEmailLookup({
      customer_id: "cus_123",
      customer: { email: "x@y.com" },
    });
    expect(lookupCustomerId).toBeNull();
  });

  it("normalizes customer row email", () => {
    expect(emailFromCustomerRow({ email: "C@TEST.org" })).toBe("c@test.org");
  });
});
