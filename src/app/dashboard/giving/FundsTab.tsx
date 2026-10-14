"use client";

import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { iconButtonClass, type FundDto } from "./types";

const emptyForm = { name: "", description: "" };

export function FundsTab({
  funds,
  currency,
  year,
  onChanged,
}: {
  funds: FundDto[] | null;
  currency: string;
  year: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FundDto | null>(null);
  const [deleting, setDeleting] = useState<FundDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleActive(fund: FundDto) {
    setToggling(fund._id);
    try {
      await api(`/api/giving/funds/${fund._id}`, {
        method: "PATCH",
        json: { active: !fund.active },
      });
      toast.success(`${fund.name} ${fund.active ? "deactivated" : "reactivated"}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setToggling(null);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/giving/funds/${deleting._id}`, { method: "DELETE" });
      toast.success(`${deleting.name} deleted — it's in the Recycle Bin.`);
      setDeleting(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Funds are the purposes people give towards. Inactive funds stay on old receipts
          but are hidden when recording new gifts.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add fund
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {funds === null &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}

        {funds?.length === 0 && (
          <div className="col-span-full flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Landmark className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">No funds yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Add a fund like General, Building or Missions to start recording gifts.
            </p>
          </div>
        )}

        {funds?.map((f) => (
          <div
            key={f._id}
            className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-colors duration-200 ${
              f.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-75"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    f.active ? "bg-indigo-50" : "bg-slate-100"
                  }`}
                >
                  <Landmark
                    className={`h-5 w-5 ${f.active ? "text-indigo-600" : "text-slate-400"}`}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{f.name}</p>
                  <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    {f.active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button
                  aria-label={`Edit ${f.name}`}
                  onClick={() => {
                    setEditing(f);
                    setModalOpen(true);
                  }}
                  className={iconButtonClass}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Delete ${f.name}`}
                  onClick={() => setDeleting(f)}
                  className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="mt-3 min-h-10 text-sm leading-relaxed text-slate-500">
              {f.description || "No description."}
            </p>

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  Received in {year}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {formatMoney(f.total, currency)}
                </p>
                <p className="text-xs text-slate-500">
                  {f.count} gift{f.count === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.active}
                aria-label={`${f.active ? "Deactivate" : "Activate"} ${f.name}`}
                disabled={toggling === f._id}
                onClick={() => toggleActive(f)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60 ${
                  f.active ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    f.active ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New fund"}
        subtitle={
          editing
            ? "Renaming updates the name on existing receipts too."
            : "A purpose people can give towards."
        }
      >
        {/* Keyed so each open (or a different fund) starts from fresh state */}
        <FundForm
          key={editing?._id ?? "new"}
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={onChanged}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this fund?"
        message={`${deleting?.name} will move to the Recycle Bin. Funds with donations recorded against them cannot be deleted — deactivate those instead.`}
      />
    </>
  );
}

function FundForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: FundDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing ? { name: existing.name, description: existing.description ?? "" } : emptyForm
  );
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (existing) {
        await api(`/api/giving/funds/${existing._id}`, { method: "PATCH", json: form });
        toast.success("Fund updated.");
      } else {
        await api("/api/giving/funds", { method: "POST", json: form });
        toast.success(`${form.name} added.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Name"
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Building Fund"
        maxLength={80}
      />
      <TextAreaField
        label="Description"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="What this fund is for"
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Add fund"}
        </Button>
      </div>
    </form>
  );
}
