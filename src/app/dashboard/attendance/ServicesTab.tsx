"use client";

import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ServiceDto } from "./types";

const emptyForm = { name: "", dayOfWeek: "", time: "", location: "" };

function fmtTime(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t)) return t || "—";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function ServicesTab({
  services,
  onChanged,
}: {
  services: ServiceDto[] | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ServiceDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: ServiceDto) {
    setEditing(s);
    setForm({ name: s.name, dayOfWeek: s.dayOfWeek, time: s.time, location: s.location });
    setModalOpen(true);
  }

  const set =
    (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/attendance/services/${editing._id}`, { method: "PATCH", json: form });
        toast.success(`Updated ${form.name}.`);
      } else {
        await api("/api/attendance/services", { method: "POST", json: form });
        toast.success(`Added ${form.name}.`);
      }
      setModalOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the service.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: ServiceDto) {
    setTogglingId(s._id);
    try {
      await api(`/api/attendance/services/${s._id}`, {
        method: "PATCH",
        json: { active: !s.active },
      });
      toast.success(`${s.name} ${s.active ? "deactivated" : "activated"}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the service.");
    } finally {
      setTogglingId(null);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/attendance/services/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.name} — it's in the Recycle Bin.`);
      setDeleting(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          The recurring gatherings you take attendance for. Deactivate one to hide it
          from the pickers without losing its history.
        </p>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Add service
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Service</th>
                <th className="px-4 py-3.5">Day</th>
                <th className="px-4 py-3.5">Time</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Active</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services === null &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {services?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <CalendarDays className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">No services yet</p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Add your Sunday service, midweek meeting or Sunday school.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {services?.map((s) => (
                <tr
                  key={s._id}
                  className={`border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60 ${
                    s.active ? "" : "text-slate-400"
                  }`}
                >
                  <td className="px-5 py-3.5 font-semibold text-slate-900">
                    <span className={s.active ? "" : "text-slate-400 line-through"}>{s.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{s.dayOfWeek || "Any day"}</td>
                  <td className="px-4 py-3.5 text-slate-600">{fmtTime(s.time)}</td>
                  <td className="px-4 py-3.5 text-slate-600">{s.location || "—"}</td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.active}
                      aria-label={`${s.active ? "Deactivate" : "Activate"} ${s.name}`}
                      disabled={togglingId === s._id}
                      onClick={() => toggleActive(s)}
                      className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
                        s.active ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                          s.active ? "translate-x-5.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label={`Edit ${s.name}`}
                        onClick={() => openEdit(s)}
                        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setDeleting(s)}
                        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit service" : "Add service"}
        subtitle="A recurring gathering you take attendance for."
      >
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Name"
            required
            value={form.name}
            onChange={set("name")}
            placeholder="Sunday Service"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Day of week"
              value={form.dayOfWeek}
              onChange={set("dayOfWeek")}
              options={DAYS_OF_WEEK}
              placeholder="Any day"
            />
            <TextField label="Time" type="time" value={form.time} onChange={set("time")} />
          </div>
          <TextField
            label="Location"
            value={form.location}
            onChange={set("location")}
            placeholder="Main hall"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add service"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this service?"
        message={`${deleting?.name} will move to the Recycle Bin. Services with attendance records can't be deleted — deactivate them instead.`}
      />
    </div>
  );
}
