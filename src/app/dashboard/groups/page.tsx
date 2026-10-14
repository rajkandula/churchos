"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { GroupDrawer } from "./GroupDrawer";
import {
  GROUP_TYPE_LABELS,
  GROUP_TYPE_STYLES,
  GROUP_TYPES,
  meetingLine,
  type GroupDto,
  type GroupsOptions,
} from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

export default function GroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupDto[] | null>(null);
  const [options, setOptions] = useState<GroupsOptions | null>(null);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GroupDto | null>(null);
  const [deleting, setDeleting] = useState<GroupDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadOptions = useCallback(() => {
    api<GroupsOptions>("/api/groups/options")
      .then(setOptions)
      .catch(() => {
        /* counts simply stay blank */
      });
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (typeFilter) params.set("type", typeFilter);
    if (activeFilter) params.set("active", activeFilter);
    api<{ groups: GroupDto[] }>(`/api/groups?${params}`)
      .then((data) => {
        setGroups(data.groups);
        setLoadError("");
      })
      .catch((err) => {
        setGroups([]);
        setLoadError(err instanceof Error ? err.message : "Could not load groups.");
      });
  }, [debouncedQ, typeFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const refresh = useCallback(() => {
    load();
    loadOptions();
  }, [load, loadOptions]);

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/groups/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.name} — it's in the Recycle Bin.`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = Boolean(debouncedQ || typeFilter || activeFilter !== "true");

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Groups</h1>
          <p className="mt-1.5 text-slate-500">
            Small groups, ministries, teams and classes —{" "}
            {options ? (
              <>
                {options.total} active group{options.total === 1 ? "" : "s"},{" "}
                {options.totalMembers}{" "}
                {options.totalMembers === 1 ? "person" : "people"} involved.
              </>
            ) : (
              "…"
            )}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New group
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Type tiles */}
      {options && (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {options.types.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setTypeFilter((cur) => (cur === t.type ? "" : t.type))}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
                typeFilter === t.type
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <p className="text-lg font-bold text-slate-900">{t.count}</p>
              <p className="truncate text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                {GROUP_TYPE_LABELS[t.type as keyof typeof GROUP_TYPE_LABELS] ?? t.type}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search groups, leaders, locations or tags…"
            aria-label="Search groups"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
          className={selectClass}
        >
          <option value="">All types</option>
          {GROUP_TYPES.map((t) => (
            <option key={t} value={t}>
              {GROUP_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          aria-label="Filter by active"
          className={selectClass}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Grid */}
      {groups === null && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
      )}

      {groups?.length === 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <UsersRound className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">
              {filtered ? "No groups match your filters" : "No groups yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Create your first small group, ministry or serving team and start
              adding people to it.
            </p>
            {!filtered && (
              <Button
                className="mt-5"
                onClick={() => {
                  setEditing(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New group
              </Button>
            )}
          </div>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const meeting = meetingLine(g);
            const full = Boolean(g.capacity && g.memberCount >= g.capacity);
            return (
              <div
                key={g._id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-colors duration-200 hover:border-indigo-200 ${
                  g.active ? "border-slate-200" : "border-slate-200 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${GROUP_TYPE_STYLES[g.type]}`}
                    >
                      {GROUP_TYPE_LABELS[g.type]}
                    </span>
                    {!g.active && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-400/20">
                        Inactive
                      </span>
                    )}
                    {g.open && !full ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-400/20">
                        <Lock className="h-3 w-3" aria-hidden />
                        {full ? "Full" : "Closed"}
                      </span>
                    )}
                  </div>
                  <div className="relative z-10 -mt-1.5 -mr-1.5 flex gap-0.5">
                    <button
                      aria-label={`Edit ${g.name}`}
                      onClick={() => {
                        setEditing(g);
                        setDrawerOpen(true);
                      }}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`Delete ${g.name}`}
                      onClick={() => setDeleting(g)}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <Link
                  href={`/dashboard/groups/${g._id}`}
                  className="mt-3 text-lg font-bold text-slate-900 transition-colors duration-150 hover:text-indigo-600 after:absolute after:inset-0 after:rounded-2xl after:content-['']"
                >
                  {g.name}
                </Link>

                <div className="mt-3 flex items-center gap-2.5">
                  {g.leaderName ? (
                    <>
                      <Avatar name={g.leaderName} photoUrl={g.leaderPhotoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {g.leaderName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Leader
                          {g.coLeaders.length > 0
                            ? ` · ${g.coLeaders.length} co-leader${g.coLeaders.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No leader assigned</p>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate">{meeting || "No regular meeting"}</span>
                  </p>
                  {g.nextMeeting && (
                    <p className="flex items-center gap-2 text-xs text-indigo-600">
                      <MapPin className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                      Next: {g.nextMeeting}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden />
                    {g.memberCount}
                    {g.capacity ? (
                      <span className="font-normal text-slate-400"> / {g.capacity}</span>
                    ) : (
                      <span className="font-normal text-slate-400">
                        {" "}
                        member{g.memberCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  {g.tags.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {g.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                      {g.tags.length > 2 && (
                        <span className="text-[11px] text-slate-400">+{g.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groups && groups.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Showing {groups.length} group{groups.length === 1 ? "" : "s"}
        </p>
      )}

      <GroupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refresh}
        existing={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this group?"
        message={`${deleting?.name} and its ${deleting?.memberCount ?? 0} member${deleting?.memberCount === 1 ? "" : "s"} and meeting log will move to the Recycle Bin. People's own records are not affected.`}
      />
    </div>
  );
}
