import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  it("passes calls through in closed state", async () => {
    const cb = new CircuitBreaker({ name: "test", failureThreshold: 3 });
    const result = await cb.call(async () => 42);
    expect(result).toBe(42);
    expect(cb.currentState).toBe("closed");
  });

  it("opens after reaching failure threshold", async () => {
    const cb = new CircuitBreaker({ name: "test", failureThreshold: 2, resetTimeoutMs: 60_000 });
    const fail = async () => { throw new Error("boom"); };

    await expect(cb.call(fail)).rejects.toThrow("boom");
    await expect(cb.call(fail)).rejects.toThrow("boom");
    await expect(cb.call(async () => "ok")).rejects.toThrow("Circuit breaker [test] is OPEN");
  });

  it("resets failure count on success", async () => {
    const cb = new CircuitBreaker({ name: "test", failureThreshold: 3 });
    const fail = async () => { throw new Error("fail"); };

    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    await cb.call(async () => "ok");
    expect(cb.currentState).toBe("closed");
  });

  it("manual reset closes circuit", async () => {
    const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 60_000 });
    await expect(cb.call(async () => { throw new Error("x"); })).rejects.toThrow();
    expect(cb.currentState).toBe("open");
    cb.reset();
    expect(cb.currentState).toBe("closed");
  });
});
