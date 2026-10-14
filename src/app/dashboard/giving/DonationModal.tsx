"use client";

import { useEffect, useState } from "react";
import { api, toDateInput } from "@/lib/client-api";
import { PAYMENT_MODES } from "@/lib/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import { todayInput, type DonationDto, type FundDto } from "./types";

type FormState = {
  fund: string;
  amount: string;
  mode: string;
  date: string;
  reference: string;
  note: string;
};

function initialForm(existing: DonationDto | null | undefined, funds: FundDto[]): FormState {
  if (existing) {
    return {
      fund: existing.fund,
      amount: String(existing.amount),
      mode: existing.mode,
      date: toDateInput(existing.date),
      reference: existing.reference ?? "",
      note: existing.note ?? "",
    };
  }
  return {
    fund: funds.find((f) => f.active)?._id ?? "",
    amount: "",
    mode: "Cash",
    date: todayInput(),
    reference: "",
    note: "",
  };
}

export function DonationModal({
  open,
  onClose,
  onSaved,
  funds,
  existing,
  defaultPerson,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  funds: FundDto[];
  existing?: DonationDto | null;
  /** Pre-select this giver for "record a gift from this person" flows. */
  defaultPerson?: PickedPerson | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? `Edit receipt ${existing.receiptNo}` : "Record a donation"}
      subtitle={
        existing
          ? existing.personName
          : "A receipt number is allocated automatically when you save."
      }
    >
      {/* Keyed so each open (or a different receipt) starts from fresh state */}
      <DonationForm
        key={existing?._id ?? "new"}
        onClose={onClose}
        onSaved={onSaved}
        funds={funds}
        existing={existing}
        defaultPerson={defaultPerson}
      />
    </Modal>
  );
}

function DonationForm({
  onClose,
  onSaved,
  funds,
  existing,
  defaultPerson,
}: {
  onClose: () => void;
  onSaved: () => void;
  funds: FundDto[];
  existing?: DonationDto | null;
  defaultPerson?: PickedPerson | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialForm(existing, funds));
  const [person, setPerson] = useState<PickedPerson | null>(() => {
    if (existing)
      return existing.person
        ? { _id: existing.person, name: existing.personName, memberNo: "" }
        : null;
    return defaultPerson ?? null;
  });
  const [anonymous, setAnonymous] = useState(() => Boolean(existing && !existing.person));
  const [saving, setSaving] = useState(false);

  // Swap the name-only snapshot for the full card (member no, phone)
  const linkedPerson = existing?.person ?? defaultPerson?._id ?? "";
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
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Active funds, plus the fund already on this receipt even if retired
  const fundOptions = funds
    .filter((f) => f.active || f._id === existing?.fund)
    .map((f) => ({ value: f._id, label: f.active ? f.name : `${f.name} (inactive)` }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!anonymous && !person) {
      toast.error("Pick the giver, or mark the gift as anonymous.");
      return;
    }
    if (!form.fund) {
      toast.error("Please choose a fund.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        person: anonymous ? "" : (person?._id ?? ""),
      };
      if (existing) {
        await api(`/api/giving/donations/${existing._id}`, { method: "PATCH", json: payload });
        toast.success(`Receipt ${existing.receiptNo} updated.`);
      } else {
        const data = await api<{ donation: DonationDto }>("/api/giving/donations", {
          method: "POST",
          json: payload,
        });
        toast.success(`Recorded — receipt ${data.donation.receiptNo}.`);
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-700">
            Giver{!anonymous && <span className="ml-0.5 text-rose-500">*</span>}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600"
            />
            Anonymous / cash plate
          </label>
        </div>
        {anonymous ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Recorded as <span className="font-semibold text-slate-700">Anonymous</span> — no
            statement will be issued for this gift.
          </div>
        ) : (
          <PersonPicker value={person} onChange={setPerson} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Fund"
          required
          options={fundOptions}
          placeholder={fundOptions.length ? undefined : "No active funds"}
          value={form.fund}
          onChange={set("fund")}
        />
        <TextField
          label="Amount"
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

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Payment mode"
          required
          options={PAYMENT_MODES}
          value={form.mode}
          onChange={set("mode")}
        />
        <TextField label="Date" required type="date" value={form.date} onChange={set("date")} />
      </div>

      <TextField
        label="Reference"
        value={form.reference}
        onChange={set("reference")}
        placeholder="Cheque no, UPI ref, transaction id…"
      />
      <TextAreaField
        label="Note"
        value={form.note}
        onChange={set("note")}
        placeholder="Thanksgiving offering, in memory of…"
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Record donation"}
        </Button>
      </div>
    </form>
  );
}
