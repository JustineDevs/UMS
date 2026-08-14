type CircuitState = "closed" | "open" | "half-open";

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;
const DEFAULT_HALF_OPEN_ATTEMPTS = 1;

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenAttempts?: number;
  name?: string;
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureAt = 0;
  private halfOpenSuccesses = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenAttempts: number;
  readonly name: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
    this.halfOpenAttempts = opts.halfOpenAttempts ?? DEFAULT_HALF_OPEN_ATTEMPTS;
    this.name = opts.name ?? "unnamed";
  }

  get currentState(): CircuitState {
    if (this.state === "open" && Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
      this.state = "half-open";
      this.halfOpenSuccesses = 0;
    }
    return this.state;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const s = this.currentState;
    if (s === "open") {
      throw new Error(
        `Circuit breaker [${this.name}] is OPEN. Provider is temporarily unavailable. Try again shortly.`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenAttempts) {
        this.state = "closed";
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureAt = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
  }
}

const breakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(
  name: string,
  opts?: Omit<CircuitBreakerOptions, "name">,
): CircuitBreaker {
  let cb = breakers.get(name);
  if (!cb) {
    cb = new CircuitBreaker({ ...opts, name });
    breakers.set(name, cb);
  }
  return cb;
}
