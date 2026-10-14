"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import type { TeamDto } from "./types";

const emptyForm = { name: "", description: "", roles: "" };

/** Create or edit a serving team — name, roles and leader. */
export function TeamDrawer({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (team: TeamDto) => void;
  existing: TeamDto | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [leader, setLeader] = useState<PickedPerson | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the form each time the drawer opens (or opens on a different team) —
  // done during render, the React-recommended way to adjust state to props.
  const [seen, setSeen] = useState({ open, existing });
  if (seen.open !== open || seen.existing !== existing) {
    setSeen({ open, existing });
    if (open) {
      setForm(
        existing
          ? {
              name: existing.name,
              description: existing.description ?? "",
              roles: existing.roles.join(", "),
            }
          : emptyForm
      );
      setLeader(
        existing?.leader
          ? { _id: existing.leader, name: existing.leaderName ?? "", memberNo: "" }
          : null
      );
    }
  }

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Please enter the team's name.");
      return;
    }
    setBusy(true);
    try {
      const json = {
        name: form.name,
        description: form.description,
        roles: form.roles,
        leader: leader?._id ?? "",
      };
      const data = existing
        ? await api<{ team: TeamDto }>(`/api/services/teams/${existing._id}`, {
            method: "PATCH",
            json,
          })
        : await api<{ team: TeamDto }>("/api/services/teams", { method: "POST", json });
      toast.success(existing ? "Team updated." : `Created the ${form.name.trim()} team.`);
      onSaved(data.team);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={existing ? "Edit team" : "New team"}
      subtitle={
        existing
          ? "Rename, change roles or the leader."
          : "Worship, Ushers, Media, Kids — any group that serves on a Sunday."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="team-form" loading={busy}>
            {existing ? "Save changes" : "Create team"}
          </Button>
        </div>
      }
    >
      <form id="team-form" onSubmit={onSubmit} className="space-y-5">
        <TextField
          label="Team name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Worship"
          autoFocus
        />
        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What this team does on a service day"
        />
        <TextField
          label="Roles"
          value={form.roles}
          onChange={(e) => set("roles", e.target.value)}
          placeholder="Vocals, Keys, Drums, Bass"
          hint="Comma-separated. Each role becomes a slot to fill on every service plan."
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Team leader</span>
          <PersonPicker value={leader} onChange={setLeader} placeholder="Search for the leader…" />
        </div>
      </form>
    </Drawer>
  );
}
