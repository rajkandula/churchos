"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TEMPLATE_CATEGORIES, type Template } from "./types";

type Draft = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

/** Inner form, remounted by key whenever the modal opens, so its fields start
 *  from the current composer without syncing props in an effect. */
function SaveTemplateForm({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (template: Template) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(draft.title.slice(0, 80));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("General");
  const [saving, setSaving] = useState(false);

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the template a name.");
      return;
    }
    setSaving(true);
    api<{ template: Template }>("/api/announcements/templates", {
      method: "POST",
      json: {
        name: trimmed,
        description: description.trim(),
        title: draft.title.trim(),
        body: draft.body,
        ctaLabel: draft.ctaLabel.trim(),
        ctaUrl: draft.ctaUrl.trim(),
        category,
      },
    })
      .then((res) => {
        setSaving(false);
        toast.success(`Saved "${trimmed}" — it's under Your templates.`);
        onSaved(res.template);
      })
      .catch((err) => {
        setSaving(false);
        toast.error(err instanceof Error ? err.message : "Could not save the template.");
      });
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <TextField
          label="Template name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Weekly service reminder"
          maxLength={80}
          hint="How it will read in the template list."
        />
        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="A short reminder of Sunday's timings, sent every Friday."
          hint="One line about when to use it."
        />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600">What gets saved</p>
          <p className="mt-1 truncate text-sm text-slate-800">
            {draft.title.trim() || "(no title)"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {draft.body.trim().length} characters
            {draft.ctaLabel.trim() ? ` · button "${draft.ctaLabel.trim()}"` : ""}
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving}>
          Save template
        </Button>
      </div>
    </>
  );
}

export function SaveTemplateModal({
  open,
  onClose,
  draft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: Draft;
  onSaved: (template: Template) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as template"
      subtitle="Keep this message to reuse next time."
    >
      {open && (
        <SaveTemplateForm
          key={`${draft.title}|${draft.body.length}`}
          draft={draft}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
