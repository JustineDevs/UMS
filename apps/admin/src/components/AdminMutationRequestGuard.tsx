"use client";

import { useEffect } from "react";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Keeps first-party browser mutations inside the server idempotency boundary. */
export function AdminMutationRequestGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!mutationMethods.has(method) || !/^\/api\/(admin|integrations)(?:\/|$)/.test(new URL(url, window.location.href).pathname)) {
        return originalFetch(input, init);
      }
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      if (!headers.has("Idempotency-Key")) headers.set("Idempotency-Key", crypto.randomUUID());
      return originalFetch(input, { ...init, headers });
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
