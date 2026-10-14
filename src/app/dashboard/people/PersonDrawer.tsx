"use client";

import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api, toDateInput } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload";
import {
  GENDER_OPTIONS,
  HOUSEHOLD_ROLE_LABELS,
  MARITAL_STATUSES,
  PERSON_STATUS_LABELS,
  SOURCE_OPTIONS,
} from "@/lib/constants";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { PersonDto } from "./types";

const emptyForm = {
  name: "",
  status: "visitor",
  gender: "",
  dob: "",
  maritalStatus: "",
  bloodGroup: "",
  occupation: "",
  phone: "",
  altPhone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  household: "",
  householdRole: "",
  memberSince: "",
  firstVisit: "",
  source: "",
  baptismDate: "",
  baptismPlace: "",
  confirmationDate: "",
  marriageDate: "",
  dedicationDate: "",
  tags: "",
  notes: "",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

type DrawerProps = {
  onClose: () => void;
  onSaved: () => void;
  existing?: PersonDto | null;
  households: { _id: string; name: string }[];
  /** Pre-fill for "add to this household" flows. */
  defaults?: Partial<typeof emptyForm>;
};

/** Initial form values — from the record being edited, or the defaults. */
function initialForm(
  existing: PersonDto | null | undefined,
  defaults: Partial<typeof emptyForm> | undefined
): typeof emptyForm {
  if (!existing) return { ...emptyForm, ...(defaults ?? {}) };
  return {
    ...emptyForm,
    ...Object.fromEntries(
      Object.keys(emptyForm).map((k) => [k, String(existing[k as keyof PersonDto] ?? "")])
    ),
    household: existing.household ?? "",
    dob: toDateInput(existing.dob),
    memberSince: toDateInput(existing.memberSince),
    firstVisit: toDateInput(existing.firstVisit),
    baptismDate: toDateInput(existing.baptismDate),
    confirmationDate: toDateInput(existing.confirmationDate),
    marriageDate: toDateInput(existing.marriageDate),
    dedicationDate: toDateInput(existing.dedicationDate),
    tags: (existing.tags ?? []).join(", "),
  } as typeof emptyForm;
}

/** The drawer mounts fresh every time it opens (keyed on the record), so
 *  form state is initialised from props instead of synced in an effect. */
export function PersonDrawer({ open, ...props }: DrawerProps & { open: boolean }) {
  if (!open) return null;
  return <PersonDrawerInner key={props.existing?._id ?? "new"} {...props} />;
}

function PersonDrawerInner({ onClose, onSaved, existing, households, defaults }: DrawerProps) {
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(existing, defaults));
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? "");
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>(
    existing?.documents ?? []
  );
  const [uploading, setUploading] = useState<"photo" | "doc" | null>(null);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const set =
    (key: keyof typeof emptyForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("photo");
    try {
      setPhotoUrl(await uploadFile(file, "photos"));
      toast.success("Photo uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function onPickDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("doc");
    try {
      const url = await uploadFile(file, "documents");
      setDocuments((prev) => [...prev, { name: file.name, url }]);
      toast.success("Document uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        photoUrl,
        documents,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (existing) {
        await api(`/api/people/${existing._id}`, { method: "PATCH", json: payload });
        toast.success("Person updated.");
      } else {
        await api("/api/people", { method: "POST", json: payload });
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
    <Drawer
      open
      onClose={onClose}
      title={existing ? `Edit ${existing.memberNo}` : "New person"}
      subtitle={
        existing
          ? existing.name
          : "A member, regular attender, visitor or child — everything else links to this record."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="person-form"
            loading={saving}
            disabled={uploading !== null}
          >
            {existing ? "Save changes" : "Add person"}
          </Button>
        </div>
      }
    >
      <form id="person-form" onSubmit={onSubmit} className="space-y-7">
        {/* Identity */}
        <section className="space-y-4">
          <SectionTitle>Person</SectionTitle>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Photo"
                  className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs font-medium text-slate-400">
                  Photo
                </div>
              )}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading !== null}
                className="cursor-pointer text-xs font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700 disabled:opacity-60"
              >
                {uploading === "photo" ? "Uploading…" : photoUrl ? "Change" : "Upload"}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={onPickPhoto}
                className="hidden"
                aria-label="Upload photo"
              />
            </div>
            <div className="flex-1 space-y-4">
              <TextField
                label="Full name"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="As you'd print it on a certificate"
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Status"
                  required
                  options={Object.entries(PERSON_STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={form.status}
                  onChange={set("status")}
                />
                <SelectField
                  label="Gender"
                  options={GENDER_OPTIONS}
                  placeholder="Select"
                  value={form.gender}
                  onChange={set("gender")}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Date of birth" type="date" value={form.dob} onChange={set("dob")} />
            <SelectField
              label="Marital status"
              options={MARITAL_STATUSES}
              placeholder="Select"
              value={form.maritalStatus}
              onChange={set("maritalStatus")}
            />
            <TextField
              label="Blood group"
              value={form.bloodGroup}
              onChange={set("bloodGroup")}
              placeholder="e.g. O+"
            />
          </div>
          <TextField
            label="Occupation"
            value={form.occupation}
            onChange={set("occupation")}
            placeholder="e.g. Teacher"
          />
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <SectionTitle>Contact</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Phone"
              inputMode="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="Mobile / WhatsApp"
            />
            <TextField
              label="Alternate phone"
              inputMode="tel"
              value={form.altPhone}
              onChange={set("altPhone")}
            />
          </div>
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="name@example.com"
            hint="Announcements and giving statements go here."
          />
          <TextField
            label="Address"
            value={form.address}
            onChange={set("address")}
            placeholder="House no, street, locality"
          />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="City" value={form.city} onChange={set("city")} />
            <TextField label="State" value={form.state} onChange={set("state")} />
            <TextField
              label="PIN code"
              inputMode="numeric"
              value={form.pincode}
              onChange={set("pincode")}
            />
          </div>
        </section>

        {/* Household */}
        <section className="space-y-4">
          <SectionTitle>Household</SectionTitle>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <SelectField
              label="Household"
              options={households.map((h) => ({ value: h._id, label: h.name }))}
              placeholder="None"
              value={form.household}
              onChange={set("household")}
              hint="Create households from the Households page."
            />
            <SelectField
              label="Role"
              options={Object.entries(HOUSEHOLD_ROLE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              placeholder="—"
              value={form.householdRole}
              onChange={set("householdRole")}
            />
          </div>
        </section>

        {/* Membership */}
        <section className="space-y-4">
          <SectionTitle>Membership</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="First visit"
              type="date"
              value={form.firstVisit}
              onChange={set("firstVisit")}
            />
            <TextField
              label="Member since"
              type="date"
              value={form.memberSince}
              onChange={set("memberSince")}
            />
          </div>
          <SelectField
            label="How they found the church"
            options={SOURCE_OPTIONS}
            placeholder="Select"
            value={form.source}
            onChange={set("source")}
          />
          <TextField
            label="Tags"
            value={form.tags}
            onChange={set("tags")}
            placeholder="choir, youth, usher"
            hint="Comma-separated. Used for filters and announcement audiences."
          />
        </section>

        {/* Milestones */}
        <section className="space-y-4">
          <SectionTitle>Milestones</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Baptism date"
              type="date"
              value={form.baptismDate}
              onChange={set("baptismDate")}
            />
            <TextField
              label="Baptism place"
              value={form.baptismPlace}
              onChange={set("baptismPlace")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Child dedication"
              type="date"
              value={form.dedicationDate}
              onChange={set("dedicationDate")}
            />
            <TextField
              label="Confirmation"
              type="date"
              value={form.confirmationDate}
              onChange={set("confirmationDate")}
            />
            <TextField
              label="Marriage"
              type="date"
              value={form.marriageDate}
              onChange={set("marriageDate")}
            />
          </div>
        </section>

        {/* Documents */}
        <section className="space-y-3">
          <SectionTitle>Documents</SectionTitle>
          {documents.length > 0 && (
            <ul className="space-y-2">
              {documents.map((doc, i) => (
                <li
                  key={`${doc.url}-${i}`}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-indigo-600"
                  >
                    {doc.name}
                  </a>
                  <button
                    type="button"
                    aria-label={`Remove ${doc.name}`}
                    onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))}
                    className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={uploading !== null}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition-colors duration-200 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60"
          >
            {uploading === "doc" ? (
              <>
                <Upload className="h-4 w-4 animate-bounce" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Paperclip className="h-4 w-4" aria-hidden />
                Attach document
              </>
            )}
          </button>
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={onPickDocument}
            className="hidden"
            aria-label="Attach document"
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Notes</SectionTitle>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={set("notes")}
            placeholder="Prayer needs, pastoral notes, anything the office should remember…"
          />
        </section>
      </form>
    </Drawer>
  );
}
