"use client";

import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api, toDateInput } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  COMMON_TITLES,
  EMPLOYMENT_TYPE_LABELS,
  STAFF_STATUS_LABELS,
  type StaffDto,
} from "./types";

const emptyForm = {
  name: "",
  title: "",
  ministry: "",
  employmentType: "full-time",
  joinDate: "",
  leaveDate: "",
  status: "active",
  ordinationDate: "",
  phone: "",
  email: "",
  address: "",
  qualifications: "",
  notes: "",
  ecName: "",
  ecPhone: "",
  ecRelation: "",
};

const TITLE_LIST_ID = "staff-title-options";
const MINISTRY_LIST_ID = "staff-ministry-options";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

export function StaffDrawer({
  open,
  onClose,
  onSaved,
  existing,
  ministries,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: StaffDto | null;
  /** Ministries already in use — suggestions for the ministry field. */
  ministries: string[];
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState<"photo" | "doc" | null>(null);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Seed the form each time the drawer opens (or opens on a different
  // record) — done during render, per React's "adjust state when a prop
  // changes" pattern, rather than in an effect.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (existing?._id ?? "new") : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (seedKey !== null && existing) {
      setForm({
        ...emptyForm,
        name: existing.name ?? "",
        title: existing.title ?? "",
        ministry: existing.ministry ?? "",
        employmentType: existing.employmentType ?? "full-time",
        joinDate: toDateInput(existing.joinDate),
        leaveDate: toDateInput(existing.leaveDate),
        status: existing.status ?? "active",
        ordinationDate: toDateInput(existing.ordinationDate),
        phone: existing.phone ?? "",
        email: existing.email ?? "",
        address: existing.address ?? "",
        qualifications: existing.qualifications ?? "",
        notes: existing.notes ?? "",
        ecName: existing.emergencyContact?.name ?? "",
        ecPhone: existing.emergencyContact?.phone ?? "",
        ecRelation: existing.emergencyContact?.relation ?? "",
      });
      setPerson(
        existing.person
          ? {
              _id: existing.person,
              name: existing.personName || existing.name,
              memberNo: existing.personMemberNo ?? "",
              photoUrl: existing.photoUrl,
            }
          : null
      );
      setPhotoUrl(existing.photoUrl ?? "");
      setDocuments(existing.documents ?? []);
    } else if (seedKey !== null) {
      setForm(emptyForm);
      setPerson(null);
      setPhotoUrl("");
      setDocuments([]);
    }
  }

  const set =
    (key: keyof typeof emptyForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Linking a People record fills in whatever is still blank. */
  function onPickPerson(p: PickedPerson | null) {
    setPerson(p);
    if (!p) return;
    setForm((f) => ({
      ...f,
      name: f.name || p.name,
      phone: f.phone || p.phone || "",
      email: f.email || p.email || "",
    }));
    if (p.photoUrl) setPhotoUrl((cur) => cur || p.photoUrl || "");
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("photo");
    try {
      setPhotoUrl(await uploadFile(file, "staff-photos"));
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
      const url = await uploadFile(file, "staff-documents");
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
      const { ecName, ecPhone, ecRelation, ...rest } = form;
      const payload = {
        ...rest,
        photoUrl,
        documents,
        person: person?._id ?? null,
        emergencyContact: { name: ecName, phone: ecPhone, relation: ecRelation },
      };
      if (existing) {
        await api(`/api/staff/${existing._id}`, { method: "PATCH", json: payload });
        toast.success("Staff member updated.");
      } else {
        await api("/api/staff", { method: "POST", json: payload });
        toast.success(`${form.name} added to the team.`);
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
      open={open}
      onClose={onClose}
      title={existing ? `Edit ${existing.staffNo}` : "New staff member"}
      subtitle={
        existing
          ? existing.name
          : "A pastor, staff member or ministry leader — paid or volunteer."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="staff-form"
            loading={saving}
            disabled={uploading !== null}
          >
            {existing ? "Save changes" : "Add staff"}
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} className="space-y-7">
        <datalist id={TITLE_LIST_ID}>
          {COMMON_TITLES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <datalist id={MINISTRY_LIST_ID}>
          {ministries.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        {/* Link to People */}
        <section className="space-y-3">
          <SectionTitle>People record</SectionTitle>
          <PersonPicker
            value={person}
            onChange={onPickPerson}
            placeholder="Link to their People record (optional)…"
          />
          <p className="text-xs text-slate-500">
            Optional. Linking fills in name, contact details and photo from the
            directory.
          </p>
        </section>

        {/* Role */}
        <section className="space-y-4">
          <SectionTitle>Role</SectionTitle>
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
                placeholder="e.g. Rev. Samuel Joseph"
              />
              <TextField
                label="Title"
                list={TITLE_LIST_ID}
                value={form.title}
                onChange={set("title")}
                placeholder="e.g. Senior Pastor"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Ministry / department"
              list={MINISTRY_LIST_ID}
              value={form.ministry}
              onChange={set("ministry")}
              placeholder="e.g. Worship, Youth, Office"
              autoComplete="off"
            />
            <SelectField
              label="Employment type"
              required
              options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={form.employmentType}
              onChange={set("employmentType")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Joined"
              type="date"
              value={form.joinDate}
              onChange={set("joinDate")}
            />
            <TextField
              label="Left"
              type="date"
              value={form.leaveDate}
              onChange={set("leaveDate")}
            />
            <SelectField
              label="Status"
              required
              options={Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={form.status}
              onChange={set("status")}
            />
          </div>
          <TextField
            label="Ordination date"
            type="date"
            value={form.ordinationDate}
            onChange={set("ordinationDate")}
            hint="For ordained ministers — leave blank otherwise."
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
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="name@example.com"
            />
          </div>
          <TextField
            label="Address"
            value={form.address}
            onChange={set("address")}
            placeholder="House no, street, locality, city"
          />
        </section>

        {/* Emergency contact */}
        <section className="space-y-4">
          <SectionTitle>Emergency contact</SectionTitle>
          <div className="grid grid-cols-[1fr_1fr_8rem] gap-3">
            <TextField
              label="Name"
              value={form.ecName}
              onChange={set("ecName")}
              placeholder="Who to call"
            />
            <TextField
              label="Phone"
              inputMode="tel"
              value={form.ecPhone}
              onChange={set("ecPhone")}
            />
            <TextField
              label="Relation"
              value={form.ecRelation}
              onChange={set("ecRelation")}
              placeholder="Spouse"
            />
          </div>
        </section>

        {/* Qualifications */}
        <section className="space-y-4">
          <SectionTitle>Qualifications</SectionTitle>
          <TextAreaField
            label="Qualifications & training"
            value={form.qualifications}
            onChange={set("qualifications")}
            placeholder="Degrees, seminary, certifications, licences…"
          />
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
          <p className="text-xs text-slate-500">
            Appointment letters, ID copies, ordination certificates.
          </p>
        </section>

        {/* Notes */}
        <section className="space-y-4">
          <SectionTitle>Notes</SectionTitle>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={set("notes")}
            placeholder="Anything the office should remember…"
          />
        </section>
      </form>
    </Drawer>
  );
}
