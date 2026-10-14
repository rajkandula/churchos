"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  GROUP_FREQUENCY_LABELS,
  GROUP_TYPE_LABELS,
  type GroupDto,
} from "./types";

const emptyForm = {
  name: "",
  type: "small-group",
  description: "",
  meetingDay: "",
  meetingTime: "",
  frequency: "weekly",
  location: "",
  capacity: "",
  tags: "",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:border-indigo-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-indigo-600"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (group: GroupDto) => void;
  existing?: GroupDto | null;
};

/** Mounts a fresh form each time the drawer opens (keyed on the group), so
 *  the form state seeds straight from props — no effect needed. */
export function GroupDrawer(props: DrawerProps) {
  if (!props.open) return null;
  return <GroupForm key={props.existing?._id ?? "new"} {...props} />;
}

function GroupForm({ open, onClose, onSaved, existing }: DrawerProps) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          type: existing.type,
          description: existing.description ?? "",
          meetingDay: existing.meetingDay ?? "",
          meetingTime: existing.meetingTime ?? "",
          frequency: existing.frequency,
          location: existing.location ?? "",
          capacity: existing.capacity ? String(existing.capacity) : "",
          tags: (existing.tags ?? []).join(", "),
        }
      : emptyForm
  );
  const [leader, setLeader] = useState<PickedPerson | null>(() =>
    existing?.leader
      ? {
          _id: existing.leader,
          name: existing.leaderName ?? "",
          memberNo: "",
          photoUrl: existing.leaderPhotoUrl ?? "",
        }
      : null
  );
  const [coLeaders, setCoLeaders] = useState<PickedPerson[]>(() =>
    (existing?.coLeaders ?? []).map((c) => ({
      _id: c.person,
      name: c.personName,
      memberNo: "",
      photoUrl: c.photoUrl ?? "",
    }))
  );
  const [isOpen, setIsOpen] = useState(existing?.open ?? true);
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof typeof emptyForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function addCoLeader(p: PickedPerson | null) {
    if (!p) return;
    if (leader && leader._id === p._id) {
      toast.error(`${p.name} is already the leader.`);
      return;
    }
    setCoLeaders((prev) => (prev.some((c) => c._id === p._id) ? prev : [...prev, p]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        leader: leader?._id ?? null,
        coLeaders: coLeaders.map((c) => c._id),
        open: isOpen,
        active,
      };
      let group: GroupDto;
      if (existing) {
        ({ group } = await api<{ group: GroupDto }>(`/api/groups/${existing._id}`, {
          method: "PATCH",
          json: payload,
        }));
        toast.success("Group updated.");
      } else {
        ({ group } = await api<{ group: GroupDto }>("/api/groups", {
          method: "POST",
          json: payload,
        }));
        toast.success(`${form.name} created.`);
      }
      onSaved(group);
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
      title={existing ? `Edit ${existing.name}` : "New group"}
      subtitle={
        existing
          ? GROUP_TYPE_LABELS[existing.type]
          : "A small group, ministry, serving team or class."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="group-form" loading={saving}>
            {existing ? "Save changes" : "Create group"}
          </Button>
        </div>
      }
    >
      <form id="group-form" onSubmit={onSubmit} className="space-y-7">
        <section className="space-y-4">
          <SectionTitle>Group</SectionTitle>
          <div className="grid grid-cols-[1fr_10rem] gap-3">
            <TextField
              label="Name"
              required
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Young Adults, Worship Team"
            />
            <SelectField
              label="Type"
              required
              options={Object.entries(GROUP_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={form.type}
              onChange={set("type")}
            />
          </div>
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={set("description")}
            placeholder="What this group is for, who it's for…"
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Leadership</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">Leader</span>
            <PersonPicker value={leader} onChange={setLeader} placeholder="Search for the leader…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">Co-leaders</span>
            {coLeaders.length > 0 && (
              <ul className="space-y-1.5">
                {coLeaders.map((c) => (
                  <li
                    key={c._id}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <Avatar name={c.name} photoUrl={c.photoUrl} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium text-slate-800">
                      {c.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${c.name} as co-leader`}
                      onClick={() =>
                        setCoLeaders((prev) => prev.filter((x) => x._id !== c._id))
                      }
                      className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <PersonPicker value={null} onChange={addCoLeader} placeholder="Add a co-leader…" />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Meeting</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="Day"
              options={DAYS_OF_WEEK}
              placeholder="—"
              value={form.meetingDay}
              onChange={set("meetingDay")}
            />
            <TextField
              label="Time"
              type="time"
              value={form.meetingTime}
              onChange={set("meetingTime")}
            />
            <SelectField
              label="Frequency"
              options={Object.entries(GROUP_FREQUENCY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={form.frequency}
              onChange={set("frequency")}
            />
          </div>
          <TextField
            label="Location"
            value={form.location}
            onChange={set("location")}
            placeholder="Room 2, the Thomases' home, online…"
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Membership</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Capacity"
              type="number"
              min={0}
              inputMode="numeric"
              value={form.capacity}
              onChange={set("capacity")}
              placeholder="No limit"
              hint="Leave blank for no limit."
            />
            <TextField
              label="Tags"
              value={form.tags}
              onChange={set("tags")}
              placeholder="youth, north zone"
              hint="Comma-separated."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              label="Open to new members"
              hint="Shown as accepting members."
              checked={isOpen}
              onChange={setIsOpen}
            />
            <Toggle
              label="Active"
              hint="Inactive groups are hidden by default."
              checked={active}
              onChange={setActive}
            />
          </div>
        </section>
      </form>
    </Drawer>
  );
}
