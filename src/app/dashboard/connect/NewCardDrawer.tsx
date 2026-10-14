"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { CardFields, newCardForm, type CardFormState } from "./CardFields";
import type { Assignee, ConnectCardDto } from "./types";

/** "Add card manually" — staff types in a paper card or a phone call. */
export function NewCardDrawer({
  open,
  onClose,
  onSaved,
  assignees,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (card: ConnectCardDto) => void;
  assignees: Assignee[];
}) {
  const toast = useToast();
  const [form, setForm] = useState<CardFormState>(newCardForm);
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  /** Close and clear, so the next "Add card" starts from a blank form. */
  function close() {
    setForm(newCardForm());
    setAssignedTo("");
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { card } = await api<{ card: ConnectCardDto }>("/api/connect", {
        method: "POST",
        json: { ...form, assignedTo: assignedTo || null },
      });
      toast.success(`${card.name}'s card added.`);
      onSaved(card);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Add connect card"
      subtitle="Record a visitor who filled in a paper card or spoke to a greeter."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="new-card-form" loading={saving}>
            Add card
          </Button>
        </div>
      }
    >
      <form id="new-card-form" onSubmit={onSubmit} className="space-y-7">
        <CardFields form={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
        <section className="space-y-4">
          <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
            Follow-up
          </h3>
          <SelectField
            label="Assign to"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Unassigned"
            options={assignees.map((a) => ({ value: a._id, label: a.name }))}
            hint="Who will reach out to this visitor."
          />
        </section>
      </form>
    </Drawer>
  );
}
