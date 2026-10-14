"use client";

import Link from "next/link";
import { Baby, LogOut, Plus, Printer, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { todayKey } from "@/lib/attendance-dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  ROOM_SUGGESTIONS,
  inputClass,
  selectClass,
  serviceLabel,
  type CheckInDto,
  type ServiceDto,
} from "./types";

function clock(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

const emptyForm = { guardianName: "", guardianPhone: "", room: "", notes: "", allergies: "" };

export function CheckInTab({
  services,
  loading,
  onTodayCountChange,
}: {
  services: ServiceDto[];
  loading: boolean;
  onTodayCountChange: (n: number) => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [serviceId, setServiceId] = useState("");
  const [checkIns, setCheckIns] = useState<CheckInDto[] | null>(null);
  const [loadedDate, setLoadedDate] = useState("");
  const [loadError, setLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CheckInDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const effectiveServiceId =
    serviceId && services.some((s) => s._id === serviceId) ? serviceId : services[0]?._id ?? "";

  const publish = useCallback(
    (list: CheckInDto[], forDate: string) => {
      setCheckIns(list);
      if (forDate === todayKey())
        onTodayCountChange(list.filter((c) => !c.checkedOutAt).length);
    },
    [onTodayCountChange]
  );

  useEffect(() => {
    let cancelled = false;
    const forDate = date;
    api<{ checkIns: CheckInDto[] }>(`/api/attendance/checkin?date=${forDate}`)
      .then((data) => {
        if (cancelled) return;
        publish(data.checkIns, forDate);
        setLoadError("");
        setLoadedDate(forDate);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCheckIns([]);
        setLoadError(err instanceof Error ? err.message : "Could not load check-ins.");
        setLoadedDate(forDate);
      });
    return () => {
      cancelled = true;
    };
  }, [date, publish]);

  // The list in state belongs to `loadedDate`; any other date shows the skeleton
  const list = loadedDate === date ? checkIns : null;

  function openModal() {
    setPerson(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function pickPerson(p: PickedPerson | null) {
    setPerson(p);
    if (p?.phone) setForm((f) => ({ ...f, guardianPhone: f.guardianPhone || p.phone || "" }));
  }

  const set =
    (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) {
      toast.error("Please choose the child.");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ checkIn: CheckInDto }>("/api/attendance/checkin", {
        method: "POST",
        json: { person: person._id, service: effectiveServiceId, date, ...form },
      });
      publish([data.checkIn, ...(checkIns ?? [])], date);
      setModalOpen(false);
      toast.success(`${data.checkIn.personName} checked in — code ${data.checkIn.securityCode}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check in.");
    } finally {
      setSaving(false);
    }
  }

  async function checkout(c: CheckInDto, undo = false) {
    setBusyId(c._id);
    try {
      const data = await api<{ checkIn: CheckInDto }>(`/api/attendance/checkin/${c._id}`, {
        method: "PATCH",
        json: { action: undo ? "undo-checkout" : "checkout" },
      });
      publish(
        (checkIns ?? []).map((x) => (x._id === c._id ? data.checkIn : x)),
        date
      );
      toast.success(undo ? `${c.personName} is checked in again.` : `${c.personName} checked out.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update check-in.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/attendance/checkin/${deleting._id}`, { method: "DELETE" });
      publish((checkIns ?? []).filter((x) => x._id !== deleting._id), date);
      toast.success(`Removed ${deleting.personName}'s check-in — it's in the Recycle Bin.`);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const stillIn = list?.filter((c) => !c.checkedOutAt).length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-56 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Service</span>
          <select
            value={effectiveServiceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={selectClass}
            disabled={loading || services.length === 0}
          >
            {services.length === 0 && <option value="">No active services</option>}
            {services.map((s) => (
              <option key={s._id} value={s._id}>
                {serviceLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-3">
          {list && list.length > 0 && (
            <p className="text-sm text-slate-500">
              <span className="font-bold text-slate-900">{stillIn}</span> still in ·{" "}
              {list.length} today
            </p>
          )}
          <Button onClick={openModal}>
            <Plus className="h-4 w-4" aria-hidden />
            Check in a child
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

      <div className="mt-4">
        {list === null && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        )}

        {list?.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Baby className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">
              No check-ins on {formatDate(date)}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Check a child in to get a security code and a printable label for the guardian.
            </p>
          </div>
        )}

        {list && list.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => {
              const out = Boolean(c.checkedOutAt);
              return (
                <div
                  key={c._id}
                  className={`flex flex-col rounded-2xl border p-5 shadow-sm transition-colors ${
                    out ? "border-slate-200 bg-slate-50/70" : "border-emerald-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={c.personName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{c.personName}</p>
                      <p className="text-xs text-slate-500">
                        {c.age !== null ? `Age ${c.age}` : "Age —"}
                        {c.room ? ` · ${c.room}` : ""}
                        {c.serviceName ? ` · ${c.serviceName}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        out ? "bg-slate-200 text-slate-600" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {out ? "Out" : "In"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                      Security code
                    </p>
                    <p className="font-mono text-3xl font-bold tracking-[0.3em] text-white">
                      {c.securityCode}
                    </p>
                  </div>

                  <dl className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Guardian</dt>
                      <dd className="truncate text-right font-medium text-slate-800">
                        {c.guardianName || "—"} · {c.guardianPhone}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Checked in</dt>
                      <dd className="font-medium text-slate-800">{clock(c.checkedInAt)}</dd>
                    </div>
                    {out && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Checked out</dt>
                        <dd className="font-medium text-slate-800">{clock(c.checkedOutAt)}</dd>
                      </div>
                    )}
                    {c.allergies && (
                      <div className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                        Allergies: {c.allergies}
                      </div>
                    )}
                    {c.notes && <p className="text-xs text-slate-500">{c.notes}</p>}
                  </dl>

                  <div className="mt-4 flex items-center gap-2">
                    {out ? (
                      <Button
                        variant="ghost"
                        onClick={() => checkout(c, true)}
                        loading={busyId === c._id}
                        className="h-9 px-3"
                      >
                        <Undo2 className="h-4 w-4" aria-hidden />
                        Undo
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => checkout(c)}
                        loading={busyId === c._id}
                        className="h-9 px-3"
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        Check out
                      </Button>
                    )}
                    <Link
                      href={`/dashboard/attendance/checkin/${c._id}/label`}
                      target="_blank"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      Print label
                    </Link>
                    <button
                      aria-label={`Delete ${c.personName}'s check-in`}
                      onClick={() => setDeleting(c)}
                      className="ml-auto cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Check in a child"
        subtitle={`${formatDate(date)}${
          services.find((s) => s._id === effectiveServiceId)?.name
            ? ` · ${services.find((s) => s._id === effectiveServiceId)?.name}`
            : ""
        }`}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">
              Child<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <PersonPicker value={person} onChange={pickPerson} placeholder="Search the child's name…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Guardian name"
              value={form.guardianName}
              onChange={set("guardianName")}
              placeholder="Parent or carer"
            />
            <TextField
              label="Guardian phone"
              required
              type="tel"
              value={form.guardianPhone}
              onChange={set("guardianPhone")}
              placeholder="Prefilled from the child's record"
            />
          </div>
          <TextField
            label="Room"
            value={form.room}
            onChange={set("room")}
            list="checkin-room-suggestions"
            placeholder="Nursery, Toddlers, Kids, Teens…"
          />
          <datalist id="checkin-room-suggestions">
            {ROOM_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <TextField
            label="Allergies"
            value={form.allergies}
            onChange={set("allergies")}
            placeholder="Printed on the label"
          />
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={set("notes")}
            placeholder="Pick-up instructions, medication…"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Check in
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this check-in?"
        message={`${deleting?.personName}'s check-in (code ${deleting?.securityCode}) will move to the Recycle Bin.`}
      />
    </div>
  );
}
