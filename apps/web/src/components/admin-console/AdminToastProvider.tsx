"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: string; message: string; tone: "success" | "error" | "info" };

const Ctx = createContext<{
  push: (_message: string, _tone?: Toast["tone"]) => void;
} | null>(null);

export function useAdminToast() {
  const v = useContext(Ctx);
  if (!v) {
    return { push: () => {} };
  }
  return v;
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-0 left-72 right-0 z-[60] flex flex-col items-end gap-2 p-4 pb-20 lg:pb-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : t.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
