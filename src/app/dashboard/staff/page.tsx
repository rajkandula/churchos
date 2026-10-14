"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Download,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { StaffDrawer } from "./StaffDrawer";
import {
  EMPLOYMENT_TYPE_LABELS,
  STAFF_STATUS_LABELS,
  STATUS_STYLES,
  TYPE_PILL_STYLES,
  type StaffDto,
  type StaffListResponse,
  type StaffStatus,
} from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

export default function StaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<StaffDto[] | null>(null);
  const [ministries, setMinistries] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [deleting, setDeleting] = useState<StaffDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Bumping the tick re-runs the fetch effect after a save, status change or
  // delete. The cancelled flag drops responses from superseded requests.
  const [reloadTick, setReloadTick] = useState(0);
  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    if (ministryFilter) params.set("ministry", ministryFilter);
    api<StaffListResponse>(`/api/staff?${params}`)
      .then((data) => {
        if (cancelled) return;
        setLoadError("");
        setStaff(data.staff);
        setMinistries(data.ministries);
        setCounts(data.counts);
        setTotal(data.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStaff([]);
        setLoadError(err instanceof Error ? err.message : "Could not load staff.");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, statusFilter, ministryFilter, reloadTick]);

  async function changeStatus(member: StaffDto, status: string) {
    const prev = staff;
    setStaff(
      (cur) =>
        cur?.map((s) =>
          s._id === member._id ? { ...s, status: status as StaffStatus } : s
        ) ?? null
    );
    try {
      await api(`/api/staff/${member._id}`, { method: "PATCH", json: { status } });
      refresh();
    } catch (err) {
      setStaff(prev ?? null);
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/staff/${deleting._id}`, { method: "DELETE" });
      toast.success(`Removed ${deleting.name} — the record is in the Recycle Bin.`);
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
    if (ministryFilter) params.set("ministry", ministryFilter);
    window.open(`/api/staff/export?${params}`, "_blank");
  }

  function openEdit(member: StaffDto) {
    setEditing(member);
    setDrawerOpen(true);
  }

  const active = counts?.active ?? 0;
  const onLeave = counts?.["on-leave"] ?? 0;
  const filtered = Boolean(debouncedQ || statusFilter || ministryFilter);

  const statusSelect = (member: StaffDto) => (
    <select
      value={member.status}
      onChange={(e) => changeStatus(member, e.target.value)}
      aria-label={`Status of ${member.name}`}
      className={`h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30 ${STATUS_STYLES[member.status]}`}
    >
      {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  const actionButtons = (member: StaffDto) => (
    <div className="flex justify-end gap-1">
      <button
        aria-label={`Edit ${member.name}`}
        onClick={() => openEdit(member)}
        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        aria-label={`Delete ${member.name}`}
        onClick={() => setDeleting(member)}
        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
        <BriefcaseBusiness className="h-6 w-6 text-indigo-500" aria-hidden />
      </div>
      <p className="mt-3 font-semibold text-slate-900">
        {filtered ? "No one matches your filters" : "No staff yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Add your pastors, office staff and ministry leaders so everyone knows
        who does what and how to reach them.
      </p>
    </div>
  );

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff</h1>
          <p className="mt-1.5 text-slate-500">
            Pastors, staff and ministry leaders —{" "}
            {counts ? (
              <>
                <span className="font-semibold text-slate-700">{active}</span> active
                {onLeave > 0 && `, ${onLeave} on leave`}, {total} on record.
              </>
            ) : (
              "…"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
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
            Add staff
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

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, title, ministry, staff no, phone or email…"
            aria-label="Search staff"
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
          {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={ministryFilter}
          onChange={(e) => setMinistryFilter(e.target.value)}
          aria-label="Filter by ministry"
          className={selectClass}
          disabled={!ministries.length}
        >
          <option value="">All ministries</option>
          {ministries.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile: directory cards */}
      <div className="mt-4 grid gap-3 md:hidden">
        {staff === null &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        {staff?.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {emptyState}
          </div>
        )}
        {staff?.map((s) => (
          <div
            key={s._id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Avatar name={s.name} photoUrl={s.photoUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{s.name}</p>
                <p className="truncate text-sm text-slate-600">
                  {s.title || "—"}
                  {s.ministry ? ` · ${s.ministry}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{s.staffNo}</p>
              </div>
              {actionButtons(s)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {statusSelect(s)}
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TYPE_PILL_STYLES[s.employmentType]}`}
              >
                {EMPLOYMENT_TYPE_LABELS[s.employmentType]}
              </span>
              {s.joinDate && (
                <span className="text-xs text-slate-500">
                  Joined {formatDate(s.joinDate)}
                </span>
              )}
            </div>
            {(s.phone || s.email) && (
              <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-sm">
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="inline-flex items-center gap-2 text-slate-700 transition-colors duration-200 hover:text-indigo-600"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {s.phone}
                  </a>
                )}
                {s.email && (
                  <a
                    href={`mailto:${s.email}`}
                    className="inline-flex items-center gap-2 truncate text-slate-700 transition-colors duration-200 hover:text-indigo-600"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate">{s.email}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Staff member</th>
                <th className="px-4 py-3.5">Title</th>
                <th className="px-4 py-3.5">Ministry</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Joined</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff === null &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {staff?.length === 0 && (
                <tr>
                  <td colSpan={8}>{emptyState}</td>
                </tr>
              )}

              {staff?.map((s) => (
                <tr
                  key={s._id}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="flex cursor-pointer items-center gap-3 text-left"
                    >
                      <Avatar name={s.name} photoUrl={s.photoUrl} />
                      <div>
                        <p className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                          {s.name}
                        </p>
                        <p className="text-xs text-slate-400">{s.staffNo}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{s.title || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-600">{s.ministry || "—"}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TYPE_PILL_STYLES[s.employmentType]}`}
                    >
                      {EMPLOYMENT_TYPE_LABELS[s.employmentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-700">{s.phone || "—"}</p>
                    <p className="text-xs text-slate-400">{s.email || ""}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{formatDate(s.joinDate)}</td>
                  <td className="px-4 py-3.5">{statusSelect(s)}</td>
                  <td className="px-4 py-3.5">{actionButtons(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff && staff.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            Showing {staff.length} staff {staff.length === 1 ? "member" : "members"}
          </div>
        )}
      </div>

      <StaffDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refresh}
        existing={editing}
        ministries={ministries}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Remove this staff member?"
        message={`${deleting?.name} (${deleting?.staffNo}) will move to the Recycle Bin. Their People record, if linked, is not affected.`}
      />
    </div>
  );
}
