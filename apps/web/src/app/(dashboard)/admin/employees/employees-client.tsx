"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AdminBreadcrumbs,
  AdminErrorState,
  AdminEmptyState,
  AdminLoadingState,
  AdminPageShell,
} from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  hired_at: string | null;
  created_at: string;
};

type FormData = {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  hired_at: string;
};

const EMPTY_FORM: FormData = { full_name: "", email: "", phone: "", role: "staff", hired_at: "" };

function ModalPortal({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

export function UsersPageClient() {
  const pinMutationRef = useRef(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<{ id: string; name: string } | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/employees");
      if (!res.ok) throw new Error("Users could not be loaded.");
      const { data } = await res.json();
      setEmployees(data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    if (!showForm && !deleteModal && !pinModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteModal) {
        setDeleteModal(null);
        setDeleteError(null);
      } else if (pinModal) {
        setPinModal(null);
        setPinValue("");
      } else {
        setShowForm(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteModal, pinModal, showForm]);

  useEffect(() => {
    if (!showForm && !deleteModal && !pinModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteModal, pinModal, showForm]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(emp: Employee) {
    setEditId(emp.id);
    setForm({
      full_name: emp.full_name,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      role: emp.role,
      hired_at: emp.hired_at ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setLoadError(null);
    setFormError(null);
    const url = editId ? `/api/admin/employees/${editId}` : "/api/admin/employees";
    const method = editId ? "PATCH" : "POST";
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(`User save failed (${response.status})`);
      setShowForm(false);
      await fetchEmployees();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "User could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    const key = `active:${emp.id}`;
    if (actionKey || pinMutationRef.current) return;
    pinMutationRef.current = true;
    setActionKey(key);
    try {
      const response = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !emp.is_active }),
      });
      if (!response.ok) throw new Error(`User status update failed (${response.status})`);
      await fetchEmployees();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "User status could not be updated.");
    } finally {
      pinMutationRef.current = false;
      setActionKey(null);
    }
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinModal) return;
    if (actionKey || pinMutationRef.current) return;
    pinMutationRef.current = true;
    setActionKey(`pin:${pinModal.id}`);
    try {
      const response = await fetch(`/api/admin/employees/${pinModal.id}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      if (!response.ok) throw new Error(`PIN update failed (${response.status})`);
      setPinModal(null);
      setPinValue("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "PIN could not be updated.");
    } finally {
      pinMutationRef.current = false;
      setActionKey(null);
    }
  }

  async function confirmDeleteEmployee() {
    if (!deleteModal) return;
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/employees/${deleteModal.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setDeleteError(
          typeof body.error === "string"
            ? body.error
            : `Delete failed (${res.status})`,
        );
        setDeleting(false);
        return;
      }
      if (editId === deleteModal.id) {
        setShowForm(false);
        setEditId(null);
      }
      setDeleteModal(null);
      void fetchEmployees();
    } catch {
      setDeleteError("Network error. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminPageShell
      title="Users"
      subtitle="Manage staff accounts, assign roles, and configure PINs."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Users" }]}
        />
      }
      actions={
        <Button
          size="sm"
          type="button"
          onClick={openCreate}
        >
          Add User
        </Button>
      }
    >
      {loading ? (
        <AdminLoadingState label="Loading users" />
      ) : loadError ? (
        <AdminErrorState title="Users unavailable" detail={loadError} onRetry={() => void fetchEmployees()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.email ?? "-"}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {emp.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${emp.is_active ? "bg-emerald-500" : "bg-slate-300"}`}
                      aria-label={emp.is_active ? "Active" : "Inactive"}
                      role="img"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                    <Button variant="link" size="sm" onClick={() => openEdit(emp)}>Edit</Button>
                    <Button variant="link" size="sm" disabled={actionKey !== null} onClick={() => void toggleActive(emp)}>
                      {emp.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="link" size="sm" onClick={() => setPinModal({ id: emp.id, name: emp.full_name })}>
                      Set PIN
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteModal({ id: emp.id, name: emp.full_name });
                      }}
                    >
                      Delete
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow><TableCell colSpan={5}><AdminEmptyState title="No users found" description="Add your first user to configure staff access and POS operations." action={<Button size="sm" onClick={openCreate}>Add user</Button>} /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {showForm && (
        <ModalPortal>
        <dialog
          open
          tabIndex={-1}
          aria-labelledby="user-form-title"
          aria-describedby="user-form-description"
          className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/50 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (!saving && event.target === event.currentTarget) setShowForm(false);
          }}
          onKeyDown={(event) => { if (event.key === "Escape") setShowForm(false); }}
        >
          <form onSubmit={handleSubmit} className="my-auto flex max-h-[calc(100dvh_-_2rem)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl sm:p-7">
            <div className="space-y-1">
              <h2 id="user-form-title" className="text-xl font-bold font-headline">{editId ? "Edit User" : "Add User"}</h2>
              <p id="user-form-description" className="text-sm text-muted-foreground">Create a staff account and assign its access level.</p>
            </div>
            {formError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{formError}</p> : null}
            <div className="space-y-2">
              <label htmlFor="employee-full-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name</label>
              <input id="employee-full-name" required autoFocus autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="employee-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                <input id="employee-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
              </div>
              <div className="space-y-2">
                <label htmlFor="employee-phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</label>
                <input id="employee-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="employee-role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
                <select id="employee-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30">
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="employee-hired-date" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hired Date</label>
                <input id="employee-hired-date" type="date" value={form.hired_at} onChange={(e) => setForm({ ...form, hired_at: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="sm:min-w-24">
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </dialog>
        </ModalPortal>
      )}

      {deleteModal && (
        <ModalPortal>
        <dialog open aria-labelledby="delete-user-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
          <div className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="delete-user-title" className="text-lg font-bold font-headline">Delete user</h2>
            <p className="text-sm text-on-surface-variant">
              Remove{" "}
              <span className="font-semibold text-on-surface">{deleteModal.name}</span>{" "}
              from the directory? This cannot be undone. Related POS history may keep references
              by id; only remove if you are sure.
            </p>
            {deleteError ? (
              <p className="text-sm text-red-700" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteEmployee()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </dialog>
        </ModalPortal>
      )}

      {pinModal && (
        <ModalPortal>
        <dialog open aria-labelledby="set-pin-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
          <form onSubmit={handleSetPin} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="set-pin-title" className="text-lg font-bold font-headline">Set PIN for {pinModal.name}</h2>
            <p className="text-sm text-on-surface-variant">Enter a 4-8 digit PIN for POS operations.</p>
            <input
              aria-label="POS PIN"
              required
              type="password"
              minLength={4}
              maxLength={8}
              pattern="[0-9]*"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-outline-variant/20 rounded px-3 py-3 text-center text-2xl tracking-[0.5em] focus:ring-1 focus:ring-primary/40"
              placeholder="----"
              autoFocus
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => { setPinModal(null); setPinValue(""); }}>Cancel</Button>
              <Button type="submit" disabled={actionKey !== null}>
                {actionKey ? "Saving…" : "Save PIN"}
              </Button>
            </div>
          </form>
        </dialog>
        </ModalPortal>
      )}
    </AdminPageShell>
  );
}
