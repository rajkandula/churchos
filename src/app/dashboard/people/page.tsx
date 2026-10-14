"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Home,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonDrawer } from "./PersonDrawer";
import { STATUS_STYLES, type PeopleOptions, type PersonDto } from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

export default function PeoplePage() {
  const toast = useToast();
  const [people, setPeople] = useState<PersonDto[] | null>(null);
  const [options, setOptions] = useState<PeopleOptions | null>(null);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [householdFilter, setHouseholdFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PersonDto | null>(null);
  const [deleting, setDeleting] = useState<PersonDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadOptions = useCallback(
    () =>
      api<PeopleOptions>("/api/people/options")
        .then(setOptions)
        .catch(() => {
          /* filters simply stay empty */
        }),
    []
  );

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (householdFilter) params.set("household", householdFilter);
    return api<{ people: PersonDto[] }>(`/api/people?${params}`)
      .then((data) => {
        setPeople(data.people);
        setLoadError("");
      })
      .catch((err) => {
        setPeople([]);
        setLoadError(err instanceof Error ? err.message : "Could not load people.");
      });
  }, [debouncedQ, statusFilter, tagFilter, householdFilter]);

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

  async function changeStatus(person: PersonDto, status: string) {
    const prev = people;
    setPeople(
      (cur) =>
        cur?.map((p) =>
          p._id === person._id ? { ...p, status: status as PersonDto["status"] } : p
        ) ?? null
    );
    try {
      await api(`/api/people/${person._id}`, { method: "PATCH", json: { status } });
      loadOptions();
    } catch (err) {
      setPeople(prev ?? null);
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/people/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.name}'s record — it's in the Recycle Bin.`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (householdFilter) params.set("household", householdFilter);
    window.open(`/api/people/export?${params}`, "_blank");
  }

  const counts = options?.counts ?? {};
  const members = counts.member ?? 0;
  const visitors = counts.visitor ?? 0;

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">People</h1>
          <p className="mt-1.5 text-slate-500">
            The church directory — {options?.total ?? "…"} people on record,{" "}
            {members} member{members === 1 ? "" : "s"}, {visitors} visitor
            {visitors === 1 ? "" : "s"} to follow up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/dashboard/people/households"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
          >
            <Home className="h-4 w-4" aria-hidden />
            Households
          </Link>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add person
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Status tiles */}
      {options && (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(PERSON_STATUS_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter((s) => (s === value ? "" : value))}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
                statusFilter === value
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <p className="text-lg font-bold text-slate-900">{counts[value] ?? 0}</p>
              <p className="truncate text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                {label}
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
            placeholder="Search name, member no, phone or email…"
            aria-label="Search people"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(PERSON_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filter by tag"
          className={selectClass}
          disabled={!options?.tags.length}
        >
          <option value="">All tags</option>
          {options?.tags.map((t) => (
            <option key={t.tag} value={t.tag}>
              {t.tag} ({t.count})
            </option>
          ))}
        </select>
        <select
          value={householdFilter}
          onChange={(e) => setHouseholdFilter(e.target.value)}
          aria-label="Filter by household"
          className={selectClass}
          disabled={!options?.households.length}
        >
          <option value="">All households</option>
          {options?.households.map((h) => (
            <option key={h._id} value={h._id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Person</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Household</th>
                <th className="px-4 py-3.5">Tags</th>
                <th className="px-4 py-3.5">Since</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people === null &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {people?.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">
                        {debouncedQ || statusFilter || tagFilter || householdFilter
                          ? "No one matches your filters"
                          : "No people yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Add your members and regular attenders here, or convert
                        visitor cards from the Connect app.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {people?.map((p) => (
                <tr
                  key={p._id}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dashboard/people/${p._id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={p.name} photoUrl={p.photoUrl} />
                      <div>
                        <p className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-400">{p.memberNo}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-700">{p.phone || "—"}</p>
                    <p className="text-xs text-slate-400">{p.email || ""}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {p.householdName || "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(p.tags ?? []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                      {(p.tags?.length ?? 0) > 3 && (
                        <span className="text-[11px] text-slate-400">
                          +{p.tags!.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {formatDate(p.memberSince ?? p.firstVisit)}
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p, e.target.value)}
                      aria-label={`Status of ${p.name}`}
                      className={`h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30 ${STATUS_STYLES[p.status]}`}
                    >
                      {Object.entries(PERSON_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label={`Edit ${p.name}`}
                        onClick={() => {
                          setEditing(p);
                          setDrawerOpen(true);
                        }}
                        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Delete ${p.name}`}
                        onClick={() => setDeleting(p)}
                        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {people && people.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            Showing {people.length} {people.length === 1 ? "person" : "people"}
          </div>
        )}
      </div>

      <PersonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refresh}
        existing={editing}
        households={options?.households ?? []}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this person?"
        message={`${deleting?.name} (${deleting?.memberNo}) will move to the Recycle Bin. Giving, attendance and group records referencing them will keep their snapshot but no longer link to a profile.`}
      />
    </div>
  );
}
