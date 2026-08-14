"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AdminBreadcrumbs,
  AdminErrorState,
  AdminEmptyState,
  AdminPageShell,
  AuditTimeline,
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

export function UsersPageClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
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
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchEmployees(); }, [fetchEmployees]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
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
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editId ? `/api/admin/employees/${editId}` : "/api/admin/employees";
    const method = editId ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    void fetchEmployees();
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/admin/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !emp.is_active }),
    });
    void fetchEmployees();
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinModal) return;
    await fetch(`/api/admin/employees/${pinModal.id}/pin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinValue }),
    });
    setPinModal(null);
    setPinValue("");
  }

  async function confirmDeleteEmployee() {
    if (!deleteModal) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/employees/${deleteModal.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
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
      inspector={<AuditTimeline title="Recent activity" />}
    >
      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading...</div>
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
                    <span className={`inline-block w-2 h-2 rounded-full ${emp.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                    <Button variant="link" size="sm" onClick={() => openEdit(emp)}>Edit</Button>
                    <Button variant="link" size="sm" onClick={() => toggleActive(emp)}>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">{editId ? "Edit User" : "Add User"}</h2>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Full Name</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Email</label>
                <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40">
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Hired Date</label>
                <input type="date" value={form.hired_at} onChange={(e) => setForm({ ...form, hired_at: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Delete user</h2>
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
        </div>
      )}

      {pinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSetPin} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Set PIN for {pinModal.name}</h2>
            <p className="text-sm text-on-surface-variant">Enter a 4-8 digit PIN for POS operations.</p>
            <input
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
              <Button type="submit">Save PIN</Button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
