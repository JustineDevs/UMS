"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@universal-music-store/ui";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export function AdminProfilePreferencesDialog() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(session?.user?.name ?? "");
      setError(null);
    }
  }, [open, session?.user?.name]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      await update({ name: name.length > 0 ? name : null });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [name, update]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-slate-200"
        >
          <div
            className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-container-high bg-no-repeat"
            role="img"
            aria-label={`${session?.user?.name || session?.user?.email || "Staff"} avatar`}
            style={{
              backgroundImage: `url('/api/admin/profile/avatar?seed=${encodeURIComponent(session?.user?.email ?? "staff")}')`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="flex min-w-0 flex-col overflow-hidden">
            <span className="truncate text-xs font-bold text-primary">
              {session?.user?.email ?? "Staff"}
            </span>
            <span className="truncate text-[10px] capitalize text-slate-500">
              {session?.user?.role ?? "staff"}
            </span>
            <span className="mt-0.5 text-[10px] text-slate-400">Profile and account</span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">Preferences</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Your account details for this back office. Email and role come from sign-in and access
            control.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="pref-email" className="text-xs font-semibold uppercase text-slate-500">
              Email
            </Label>
            <Input
              id="pref-email"
              readOnly
              value={session?.user?.email ?? ""}
              className="mt-1 bg-slate-50"
            />
          </div>
          <div>
            <Label htmlFor="pref-role" className="text-xs font-semibold uppercase text-slate-500">
              Role
            </Label>
            <Input
              id="pref-role"
              readOnly
              value={session?.user?.role ?? ""}
              className="mt-1 bg-slate-50 capitalize"
            />
          </div>
          <div>
            <Label htmlFor="pref-name" className="text-xs font-semibold uppercase text-slate-500">
              Display name
            </Label>
            <Input
              id="pref-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1"
              autoComplete="name"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-xs text-slate-500">
          <Link
            href="/admin/settings/preferences"
            className="font-medium text-primary underline"
            onClick={() => setOpen(false)}
          >
            Workspace UI settings
          </Link>{" "}
          (density and table defaults) apply in the browser only.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
