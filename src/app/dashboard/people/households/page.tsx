"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Home, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatDate, toDateInput } from "@/lib/client-api";
import { HOUSEHOLD_ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import type { HouseholdDto } from "../types";

type Member = {
  _id: string;
  name: string;
  memberNo: string;
  householdRole?: string;
  phone?: string;
  photoUrl?: string;
  status: string;
  dob?: string | null;
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  anniversary: "",
  notes: "",
  head: "",
};

export default function HouseholdsPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [households, setHouseholds] = useState<HouseholdDto[] | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<HouseholdDto | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<PickedPerson | null>(null);
  const [deleting, setDeleting] = useState<HouseholdDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const openHousehold = useCallback(
    (h: HouseholdDto | null) => {
      setEditing(h);
      setAdding(null);
      if (h) {
        setForm({
          name: h.name,
          phone: h.phone ?? "",
          email: h.email ?? "",
          address: h.address ?? "",
          city: h.city ?? "",
          state: h.state ?? "",
          pincode: h.pincode ?? "",
          anniversary: toDateInput(h.anniversary),
          notes: h.notes ?? "",
          head: h.head ?? "",
        });
        api<{ members: Member[] }>(`/api/households/${h._id}`)
          .then((d) => setMembers(d.members))
          .catch(() => setMembers([]));
      } else {
        setForm(emptyForm);
        setMembers([]);
      }
      setDrawerOpen(true);
    },
    []
  );

  // Deep link from a profile: /households?open=<id> — honoured once, on first load
  const deepLinked = useRef(false);
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    return api<{ households: HouseholdDto[] }>(`/api/households?${params}`)
      .then((d) => {
        setHouseholds(d.households);
        const id = searchParams.get("open");
        if (id && !deepLinked.current) {
          deepLinked.current = true;
          const h = d.households.find((x) => x._id === id);
          if (h) openHousehold(h);
        }
      })
      .catch((err) => {
        setHouseholds([]);
        toast.error(err instanceof Error ? err.message : "Could not load households.");
      });
  }, [debouncedQ, toast, searchParams, openHousehold]);

  useEffect(() => {
    load();
  }, [load]);

  const set =
    (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const roles = Object.fromEntries(members.map((m) => [m._id, m.householdRole ?? ""]));
      if (editing) {
        await api(`/api/households/${editing._id}`, {
          method: "PATCH",
          json: { ...form, roles },
        });
        toast.success("Household saved.");
      } else {
        await api("/api/households", { method: "POST", json: form });
        toast.success("Household created — now add its members.");
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addMember(p: PickedPerson) {
    if (!editing) return;
    try {
      await api(`/api/households/${editing._id}`, {
        method: "PATCH",
        json: { addMemberIds: [p._id] },
      });
      const d = await api<{ members: Member[] }>(`/api/households/${editing._id}`);
      setMembers(d.members);
      setAdding(null);
      toast.success(`${p.name} added to ${editing.name}.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add.");
    }
  }

  async function removeMember(m: Member) {
    if (!editing) return;
    try {
      await api(`/api/households/${editing._id}`, {
        method: "PATCH",
        json: { removeMemberIds: [m._id] },
      });
      setMembers((prev) => prev.filter((x) => x._id !== m._id));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/households/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.name}. Its members stay in People.`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/people"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        People
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Households</h1>
          <p className="mt-1.5 text-slate-500">
            Families and homes — {households?.length ?? "…"} on record. One address, one
            mailing, everyone linked.
          </p>
        </div>
        <Button onClick={() => openHousehold(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          New household
        </Button>
      </div>

      <div className="relative mt-6 max-w-md">
        <Search
          className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search households…"
          aria-label="Search households"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {households === null &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        {households?.length === 0 && (
          <div className="col-span-full flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <Home className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 font-semibold text-slate-900">No households yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Create one per family, then attach its members from the People list or here.
            </p>
          </div>
        )}
        {households?.map((h) => (
          <div
            key={h._id}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => openHousehold(h)}
                className="cursor-pointer text-left"
              >
                <p className="font-bold text-slate-900 group-hover:text-indigo-600">{h.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {h.memberCount ?? 0} member{h.memberCount === 1 ? "" : "s"}
                  {h.headName ? ` · Head: ${h.headName}` : ""}
                </p>
              </button>
              <div className="flex gap-1">
                <button
                  aria-label={`Edit ${h.name}`}
                  onClick={() => openHousehold(h)}
                  className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Delete ${h.name}`}
                  onClick={() => setDeleting(h)}
                  className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-600">
              {(h.memberNames ?? []).join(", ") || "No members attached yet."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {[h.address, h.city].filter(Boolean).join(", ") || "No address"}
              {h.phone ? ` · ${h.phone}` : ""}
            </p>
          </div>
        ))}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? editing.name : "New household"}
        subtitle={editing ? "Members, address and details" : "Name it the way you'd address a letter."}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="household-form" loading={saving}>
              {editing ? "Save changes" : "Create household"}
            </Button>
          </div>
        }
      >
        <form id="household-form" onSubmit={save} className="space-y-6">
          <TextField
            label="Household name"
            required
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. The Thomas family"
          />

          {editing && (
            <section className="space-y-3">
              <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
                Members
              </h3>
              {members.length > 0 && (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m._id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                    >
                      <Avatar name={m.name} photoUrl={m.photoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {m.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {m.memberNo}
                          {m.dob ? ` · b. ${formatDate(m.dob)}` : ""}
                        </p>
                      </div>
                      <select
                        value={m.householdRole ?? ""}
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((x) =>
                              x._id === m._id ? { ...x, householdRole: e.target.value } : x
                            )
                          )
                        }
                        aria-label={`Role of ${m.name}`}
                        className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                      >
                        <option value="">Role</option>
                        {Object.entries(HOUSEHOLD_ROLE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => removeMember(m)}
                        className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Add a person to this household
                </p>
                <PersonPicker
                  value={adding}
                  onChange={(p) => {
                    setAdding(p);
                    if (p) addMember(p);
                  }}
                />
              </div>
              <SelectField
                label="Head of household"
                options={members.map((m) => ({ value: m._id, label: m.name }))}
                placeholder="—"
                value={form.head}
                onChange={set("head")}
              />
            </section>
          )}

          <section className="space-y-4">
            <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
              Contact &amp; address
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Phone" value={form.phone} onChange={set("phone")} />
              <TextField label="Email" type="email" value={form.email} onChange={set("email")} />
            </div>
            <TextField label="Address" value={form.address} onChange={set("address")} />
            <div className="grid grid-cols-3 gap-3">
              <TextField label="City" value={form.city} onChange={set("city")} />
              <TextField label="State" value={form.state} onChange={set("state")} />
              <TextField label="PIN code" value={form.pincode} onChange={set("pincode")} />
            </div>
            <TextField
              label="Anniversary"
              type="date"
              value={form.anniversary}
              onChange={set("anniversary")}
            />
            <TextAreaField label="Notes" value={form.notes} onChange={set("notes")} />
          </section>
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete household?"
        message={`${deleting?.name} will move to the Recycle Bin. Its members stay in People, just unlinked.`}
      />
    </div>
  );
}
