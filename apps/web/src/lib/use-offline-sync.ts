"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isOnline, getPendingSales, syncPendingSales } from "./offline-pos";

export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const sales = await getPendingSales();
      setPendingCount(sales.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const trySync = useCallback(async () => {
    if (!isOnline() || syncing) return;
    setSyncing(true);
    try {
      await syncPendingSales();
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [syncing, refreshCount]);

  useEffect(() => {
    setOnline(isOnline());
    void refreshCount();

    const goOnline = () => {
      setOnline(true);
      void trySync();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    intervalRef.current = setInterval(() => {
      if (isOnline()) void trySync();
    }, 30_000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [trySync, refreshCount]);

  return { online, pendingCount, syncing, trySync, refreshCount };
}
