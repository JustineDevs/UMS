"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";

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

export function EmployeesPageClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
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
    const res = await fetch("/api/admin/employees");
    if (res.ok) {
      const { data } = await res.json();
      setEmployees(data ?? []);
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
      title="Employees"
      subtitle="Manage staff, assign roles, and configure PINs."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Employees" }]}
        />
      }
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Add Employee
        </button>
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      {loading ? (
        <div className="text-center py-20 text-on-surface-variant text-sm">Loading...</div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="text-left px-6 py-4">Name</th>
                <th className="text-left px-6 py-4">Email</th>
                <th className="text-left px-6 py-4">Role</th>
                <th className="text-center px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{emp.full_name}</td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{emp.email ?? "-"}</td>
                  <td className="px-6 py-4">
                    <span className="bg-surface-container-high px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${emp.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openEdit(emp)} className="text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => toggleActive(emp)} className="text-xs text-on-surface-variant hover:underline">
                      {emp.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => setPinModal({ id: emp.id, name: emp.full_name })} className="text-xs text-secondary hover:underline">
                      Set PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteModal({ id: emp.id, name: emp.full_name });
                      }}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-on-surface-variant">
                    No employees found. Add your first employee above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">{editId ? "Edit Employee" : "Add Employee"}</h2>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Full Name</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
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
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Delete employee</h2>
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
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteError(null);
                }}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteEmployee()}
                className="bg-red-700 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
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
              <button type="button" onClick={() => { setPinModal(null); setPinValue(""); }} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">Save PIN</button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
