"use client";

import Link from "next/link";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate, toDateInput } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  PLEDGE_FREQUENCY_LABELS,
  PLEDGE_STATUSES,
  PLEDGE_STATUS_LABELS,
  PLEDGE_STATUS_STYLES,
  PLEDGE_FREQUENCIES,
  iconButtonClass,
  selectClass,
  todayInput,
  type FundDto,
  type PledgeDto,
  type PledgeStatus,
} from "./types";

const emptyForm = {
  fund: "",
  amount: "",
  frequency: "monthly",
  startDate: "",
  endDate: "",
  note: "",
  status: "active",
};

export function PledgesTab({ funds, currency }: { funds: FundDto[]; currency: string }) {
  const toast = useToast();
  const [pledges, setPledges] = useState<PledgeDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PledgeDto | null>(null);
  const [deleting, setDeleting] = useState<PledgeDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Promise chain (not async/await) so every setState runs in a callback,
  // never synchronously inside the effect that triggers the load.
  const load = useCallback(() => {
    return api<{ pledges: PledgeDto[] }>("/api/giving/pledges")
      .then((data) => {
        setPledges(data.pledges);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setPledges([]);
        setLoadError(err instanceof Error ? err.message : "Could not load pledges.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(pledge: PledgeDto, status: string) {
    const prev = pledges;
    setPledges(
      (cur) =>
        cur?.map((p) => (p._id === pledge._id ? { ...p, status: status as PledgeStatus } : p)) ??
        null
    );
    try {
      await api(`/api/giving/pledges/${pledge._id}`, { method: "PATCH", json: { status } });
    } catch (err) {
      setPledges(prev ?? null);
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/giving/pledges/${deleting._id}`, { method: "DELETE" });
      toast.success("Pledge deleted — it's in the Recycle Bin.");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const visible = pledges?.filter((p) => !statusFilter || p.status === statusFilter) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All pledges</option>
          {PLEDGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PLEDGE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          Progress counts the person&apos;s gifts to the pledged fund between the start and end
          dates.
        </p>
        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add pledge
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Person</th>
                <th className="px-4 py-3.5">Fund</th>
                <th className="px-4 py-3.5 text-right">Pledged</th>
                <th className="px-4 py-3.5">Frequency</th>
                <th className="px-4 py-3.5">Period</th>
                <th className="px-4 py-3.5">Given</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible === null &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {visible?.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <Target className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">
                        {statusFilter ? "No pledges with this status" : "No pledges yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Record what people commit to give — for a building project, missions
                        drive or regular tithe — and track it against actual gifts.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {visible?.map((p) => (
                <tr
                  key={p._id}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/people/${p.person}`} className="flex items-center gap-3">
                      <Avatar name={p.personName} />
                      <span className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                        {p.personName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{p.fundName || "Any fund"}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                    {formatMoney(p.amount, currency)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {PLEDGE_FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">
                    {formatDate(p.startDate)}
                    {p.endDate ? ` → ${formatDate(p.endDate)}` : " → open"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="min-w-36">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          {formatMoney(p.given, currency)}
                        </span>
                        <span className="text-slate-400">{p.progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            p.progress >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                          }`}
                          style={{ width: `${Math.min(100, p.progress)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p, e.target.value)}
                      aria-label={`Status of ${p.personName}'s pledge`}
                      className={`h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30 ${PLEDGE_STATUS_STYLES[p.status]}`}
                    >
                      {PLEDGE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PLEDGE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label={`Edit ${p.personName}'s pledge`}
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        className={iconButtonClass}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Delete ${p.personName}'s pledge`}
                        onClick={() => setDeleting(p)}
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
        {visible && visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            <span>
              {visible.length} pledge{visible.length === 1 ? "" : "s"}
            </span>
            <span>
              Pledged{" "}
              <span className="font-bold text-slate-900">
                {formatMoney(
                  visible.reduce((s, p) => s + p.amount, 0),
                  currency
                )}
              </span>{" "}
              · Given{" "}
              <span className="font-bold text-slate-900">
                {formatMoney(
                  visible.reduce((s, p) => s + p.given, 0),
                  currency
                )}
              </span>
            </span>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit pledge" : "New pledge"}
        subtitle={editing ? editing.personName : "A commitment to give over a period."}
      >
        {/* Keyed so each open (or a different pledge) starts from fresh state */}
        <PledgeForm
          key={editing?._id ?? "new"}
          existing={editing}
          funds={funds}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this pledge?"
        message={`${deleting?.personName}'s pledge of ${formatMoney(
          deleting?.amount ?? 0,
          currency
        )} will move to the Recycle Bin. Donations already recorded are not affected.`}
      />
    </>
  );
}

function PledgeForm({
  existing,
  funds,
  onClose,
  onSaved,
}: {
  existing: PledgeDto | null;
  funds: FundDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing
      ? {
          fund: existing.fund ?? "",
          amount: String(existing.amount),
          frequency: existing.frequency as string,
          startDate: toDateInput(existing.startDate),
          endDate: toDateInput(existing.endDate),
          note: existing.note ?? "",
          status: existing.status as string,
        }
      : { ...emptyForm, startDate: todayInput() }
  );
  const [person, setPerson] = useState<PickedPerson | null>(() =>
    existing ? { _id: existing.person, name: existing.personName, memberNo: "" } : null
  );
  const [saving, setSaving] = useState(false);

  // Swap the name-only snapshot for the full card (member no, phone)
  const linkedPerson = existing?.person ?? "";
  useEffect(() => {
    if (!linkedPerson) return;
    let cancelled = false;
    api<{ person: PickedPerson }>(`/api/people/${linkedPerson}`)
      .then((d) => {
        if (!cancelled) setPerson(d.person);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [linkedPerson]);

  const set =
    (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const fundOptions = [
    { value: "", label: "Any fund" },
    ...funds
      .filter((f) => f.active || f._id === existing?.fund)
      .map((f) => ({ value: f._id, label: f.name })),
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) {
      toast.error("Please choose who is pledging.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), person: person._id };
      if (existing) {
        await api(`/api/giving/pledges/${existing._id}`, { method: "PATCH", json: payload });
        toast.success("Pledge updated.");
      } else {
        await api("/api/giving/pledges", { method: "POST", json: payload });
        toast.success(`Pledge recorded for ${person.name}.`);
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
      <div className="space-y-1.5">
        <span className="text-[13px] font-semibold text-slate-700">
          Person<span className="ml-0.5 text-rose-500">*</span>
        </span>
        <PersonPicker value={person} onChange={setPerson} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Fund" options={fundOptions} value={form.fund} onChange={set("fund")} />
        <TextField
          label="Total pledged"
          required
          type="number"
          min={1}
          step="0.01"
          inputMode="decimal"
          value={form.amount}
          onChange={set("amount")}
          placeholder="0"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label="Frequency"
          options={PLEDGE_FREQUENCIES.map((f) => ({
            value: f,
            label: PLEDGE_FREQUENCY_LABELS[f],
          }))}
          value={form.frequency}
          onChange={set("frequency")}
        />
        <TextField label="Starts" type="date" value={form.startDate} onChange={set("startDate")} />
        <TextField label="Ends" type="date" value={form.endDate} onChange={set("endDate")} />
      </div>
      {existing && (
        <SelectField
          label="Status"
          options={PLEDGE_STATUSES.map((s) => ({ value: s, label: PLEDGE_STATUS_LABELS[s] }))}
          value={form.status}
          onChange={set("status")}
        />
      )}
      <TextAreaField
        label="Note"
        value={form.note}
        onChange={set("note")}
        placeholder="e.g. Towards the new sanctuary roof"
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Add pledge"}
        </Button>
      </div>
    </form>
  );
}
