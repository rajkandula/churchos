"use client";

import { ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  EVENT_STATUS_LABELS,
  toDateTimeInput,
  type EventDto,
} from "./types";

const emptyForm = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  venue: "",
  capacity: "",
  fee: "0",
  status: "published",
  tags: "",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (event: EventDto) => void;
  existing?: EventDto | null;
  currency?: string;
};

/** Mounts a fresh form each time the drawer opens (or the event changes),
 *  so state initialises from props instead of syncing in an effect. */
export function EventDrawer(props: DrawerProps) {
  if (!props.open) return null;
  return <EventDrawerForm key={props.existing?._id ?? "new"} {...props} />;
}

function EventDrawerForm({ open, onClose, onSaved, existing, currency = "INR" }: DrawerProps) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description ?? "",
          startAt: toDateTimeInput(existing.startAt),
          endAt: toDateTimeInput(existing.endAt),
          venue: existing.venue ?? "",
          capacity:
            existing.capacity === null || existing.capacity === undefined
              ? ""
              : String(existing.capacity),
          fee: String(existing.fee ?? 0),
          status: existing.status as string,
          tags: (existing.tags ?? []).join(", "),
        }
      : emptyForm
  );
  const [registrationOpen, setRegistrationOpen] = useState(
    existing ? existing.registrationOpen : true
  );
  const [organizer, setOrganizer] = useState<PickedPerson | null>(
    existing?.organizer
      ? {
          _id: existing.organizer,
          name: existing.organizerName || "Organizer",
          memberNo: "",
        }
      : null
  );
  const [coverUrl, setCoverUrl] = useState(existing?.coverUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const set =
    (key: keyof typeof emptyForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setCoverUrl(await uploadFile(file, "events"));
      toast.success("Cover image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startAt) {
      toast.error("Please choose when the event starts.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        // datetime-local is wall-clock; send the instant so the server stores UTC
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : "",
        venue: form.venue,
        capacity: form.capacity,
        fee: form.fee,
        status: form.status,
        registrationOpen,
        organizer: organizer?._id ?? "",
        organizerName: organizer?.name ?? "",
        coverUrl,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      let saved: EventDto;
      if (existing) {
        const data = await api<{ event: EventDto }>(`/api/events/${existing._id}`, {
          method: "PATCH",
          json: payload,
        });
        saved = data.event;
        toast.success("Event updated.");
      } else {
        const data = await api<{ event: EventDto }>("/api/events", {
          method: "POST",
          json: payload,
        });
        saved = data.event;
        toast.success(`${form.title} created.`);
      }
      onSaved(saved);
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
      title={existing ? "Edit event" : "New event"}
      subtitle={
        existing
          ? existing.title
          : "Share the public link and people register themselves — no login needed."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" loading={saving} disabled={uploading}>
            {existing ? "Save changes" : "Create event"}
          </Button>
        </div>
      }
    >
      <form id="event-form" onSubmit={onSubmit} className="space-y-7">
        <section className="space-y-4">
          <SectionTitle>Event</SectionTitle>

          {/* Cover */}
          <div>
            {coverUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="Cover" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  aria-label="Remove cover image"
                  className="absolute top-2 right-2 cursor-pointer rounded-lg bg-white/90 p-1.5 text-slate-600 shadow transition-colors duration-200 hover:bg-white hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading}
                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 transition-colors duration-200 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Upload className="h-5 w-5 animate-bounce" aria-hidden />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5" aria-hidden />
                    Add a cover image
                    <span className="text-xs font-normal text-slate-400">
                      Shown on the public registration page
                    </span>
                  </>
                )}
              </button>
            )}
            {coverUrl && (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 cursor-pointer text-xs font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700 disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Change cover"}
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={onPickCover}
              className="hidden"
              aria-label="Upload cover image"
            />
          </div>

          <TextField
            label="Title"
            required
            value={form.title}
            onChange={set("title")}
            placeholder="e.g. Youth Camp 2026"
          />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={set("description")}
            placeholder="What's happening, who it's for, what to bring…"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Starts"
              type="datetime-local"
              required
              value={form.startAt}
              onChange={set("startAt")}
            />
            <TextField
              label="Ends"
              type="datetime-local"
              value={form.endAt}
              onChange={set("endAt")}
              min={form.startAt || undefined}
            />
          </div>
          <TextField
            label="Venue"
            value={form.venue}
            onChange={set("venue")}
            placeholder="Main hall, or a full address"
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Registration</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Capacity"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.capacity}
              onChange={set("capacity")}
              placeholder="Unlimited"
              hint="Signups beyond this go on the waitlist."
            />
            <TextField
              label={`Fee (${currency})`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.fee}
              onChange={set("fee")}
              hint="Shown on the public page — collected at the door."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Status"
              options={Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={form.status}
              onChange={set("status")}
              hint="Only published events accept public signups."
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-700">Public signups</span>
              <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-indigo-600"
                />
                Registration open
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Organizer</SectionTitle>
          <PersonPicker
            value={organizer}
            onChange={setOrganizer}
            placeholder="Search People for the organizer…"
          />
          <TextField
            label="Tags"
            value={form.tags}
            onChange={set("tags")}
            placeholder="youth, outreach, conference"
            hint="Comma-separated."
          />
        </section>
      </form>
    </Drawer>
  );
}
