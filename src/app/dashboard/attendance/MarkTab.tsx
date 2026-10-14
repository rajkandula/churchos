"use client";

import Link from "next/link";
import { Check, CheckCircle2, Circle, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatDate, formatDateTime } from "@/lib/client-api";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { addDaysToKey, todayKey } from "@/lib/attendance-dates";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import {
  inputClass,
  selectClass,
  serviceLabel,
  type AttendanceDto,
  type RosterPerson,
  type ServiceDto,
} from "./types";

/** The most recent calendar day matching the service's weekday (today if it matches). */
function defaultDateFor(service?: ServiceDto): string {
  const today = todayKey();
  if (!service?.dayOfWeek) return today;
  const idx = (DAYS_OF_WEEK as readonly string[]).indexOf(service.dayOfWeek);
  if (idx < 0) return today;
  const back = (new Date().getDay() - idx + 7) % 7;
  return back === 0 ? today : addDaysToKey(today, -back);
}

function CountInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-full text-lg font-bold text-slate-900`}
      />
    </label>
  );
}

export function MarkTab({
  services,
  loading,
}: {
  services: ServiceDto[];
  loading: boolean;
}) {
  const toast = useToast();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [people, setPeople] = useState<RosterPerson[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDto | null>(null);
  const [loadError, setLoadError] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [adults, setAdults] = useState("");
  const [children, setChildren] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Which service+date the roster in state belongs to — anything else shows the skeleton
  const [loadedKey, setLoadedKey] = useState("");

  // Pick the first service once the list arrives
  const effectiveServiceId =
    serviceId && services.some((s) => s._id === serviceId) ? serviceId : services[0]?._id ?? "";
  const service = services.find((s) => s._id === effectiveServiceId);

  const key = `${effectiveServiceId}|${date}`;

  useEffect(() => {
    if (!effectiveServiceId || !date) return;
    let cancelled = false;
    const thisKey = `${effectiveServiceId}|${date}`;
    api<{ attendance: AttendanceDto | null; people: RosterPerson[] }>(
      `/api/attendance?service=${effectiveServiceId}&date=${date}`
    )
      .then((data) => {
        if (cancelled) return;
        setPeople(data.people);
        setAttendance(data.attendance);
        setHeadcount(data.attendance ? String(data.attendance.headcount) : "");
        setAdults(data.attendance?.adults != null ? String(data.attendance.adults) : "");
        setChildren(data.attendance?.children != null ? String(data.attendance.children) : "");
        setNote(data.attendance?.note ?? "");
        setDirty(false);
        setLoadError("");
        setLoadedKey(thisKey);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPeople([]);
        setAttendance(null);
        setLoadError(err instanceof Error ? err.message : "Could not load the roster.");
        setLoadedKey(thisKey);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveServiceId, date]);

  const ready = loadedKey === key;
  const roster = ready ? people : null;

  function changeService(id: string) {
    setServiceId(id);
    setDate(defaultDateFor(services.find((s) => s._id === id)));
  }

  function toggle(id: string) {
    setPeople((cur) =>
      cur?.map((p) => (p._id === id ? { ...p, present: !p.present } : p)) ?? null
    );
    setDirty(true);
  }

  function setAll(present: boolean) {
    setPeople((cur) => cur?.map((p) => ({ ...p, present })) ?? null);
    setDirty(true);
  }

  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
  };

  async function save() {
    if (!effectiveServiceId || !roster) return;
    setSaving(true);
    try {
      const data = await api<{ attendance: AttendanceDto }>("/api/attendance", {
        method: "PUT",
        json: {
          service: effectiveServiceId,
          date,
          headcount,
          adults,
          children,
          note,
          entries: roster.map((p) => ({ person: p._id, present: p.present })),
        },
      });
      setAttendance(data.attendance);
      setHeadcount(String(data.attendance.headcount));
      setDirty(false);
      toast.success(
        `Saved ${service?.name ?? "attendance"} for ${formatDate(date)} — ${
          data.attendance.entries.filter((e) => e.present).length
        } present.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!roster) return [];
    if (!needle) return roster;
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.memberNo.toLowerCase().includes(needle) ||
        (p.householdName ?? "").toLowerCase().includes(needle)
    );
  }, [roster, q]);

  const presentCount = roster?.filter((p) => p.present).length ?? 0;
  const total = roster?.length ?? 0;

  if (!loading && services.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
          <CheckCircle2 className="h-6 w-6 text-indigo-500" aria-hidden />
        </div>
        <p className="mt-3 font-semibold text-slate-900">No active services</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Add or reactivate a service in the Services tab to start marking attendance.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Pickers */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 sm:flex-none">
          <span className="text-[13px] font-semibold text-slate-700">Service</span>
          <select
            value={effectiveServiceId}
            onChange={(e) => changeService(e.target.value)}
            className={selectClass}
            disabled={loading}
          >
            {services.map((s) => (
              <option key={s._id} value={s._id}>
                {serviceLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Date</span>
          <input
            type="date"
            value={date}
            max={addDaysToKey(todayKey(), 7)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        {attendance && (
          <p className="pb-2.5 text-xs text-slate-500">
            Last saved by <span className="font-semibold text-slate-700">{attendance.markedByName || "—"}</span>{" "}
            {attendance.updatedAt ? `at ${formatDateTime(attendance.updatedAt)}` : ""}
          </p>
        )}
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Headcount card */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <CountInput
            label="Headcount"
            value={headcount}
            onChange={edit(setHeadcount)}
            placeholder={roster ? String(presentCount) : ""}
          />
          <CountInput label="Adults" value={adults} onChange={edit(setAdults)} placeholder="—" />
          <CountInput label="Children" value={children} onChange={edit(setChildren)} placeholder="—" />
        </div>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Note</span>
          <input
            type="text"
            value={note}
            onChange={(e) => edit(setNote)(e.target.value)}
            placeholder="Guest speaker, rain, combined service…"
            className={`${inputClass} w-full`}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Headcount is everyone in the room — leave it blank to use the number marked present.
        </p>
      </div>

      {/* Roster toolbar */}
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
            placeholder="Find someone…"
            aria-label="Search the roster"
            className={`${inputClass} w-full pl-10`}
          />
        </div>
        <Button variant="secondary" onClick={() => setAll(true)} disabled={!roster?.length}>
          <Check className="h-4 w-4" aria-hidden />
          Mark all present
        </Button>
        <Button variant="ghost" onClick={() => setAll(false)} disabled={!roster?.length}>
          Clear
        </Button>
      </div>

      {/* Roster */}
      <div className="mt-4">
        {roster === null && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        )}

        {roster?.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Users className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">No one to mark yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Members, regular attenders and visitors from the People app appear here.
            </p>
            <Link
              href="/dashboard/people"
              className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Go to People →
            </Link>
          </div>
        )}

        {roster && roster.length > 0 && filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No one matches “{q}”.
          </p>
        )}

        {filtered.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => toggle(p._id)}
                aria-pressed={p.present}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                  p.present
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-indigo-200"
                }`}
              >
                <Avatar name={p.name} photoUrl={p.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.name}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.memberNo}
                    {p.householdName ? ` · ${p.householdName}` : ""}
                  </span>
                </span>
                {p.present ? (
                  <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <Circle className="h-7 w-7 shrink-0 text-slate-300" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {roster && roster.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg shadow-slate-900/10 backdrop-blur">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {presentCount} of {total} marked present
            </p>
            <p className="text-xs text-slate-500">
              {service?.name} · {formatDate(date)}
              {dirty ? " · unsaved changes" : attendance ? " · saved" : " · not saved yet"}
            </p>
          </div>
          <Button onClick={save} loading={saving} disabled={!dirty && Boolean(attendance)}>
            <Check className="h-4 w-4" aria-hidden />
            Save attendance
          </Button>
        </div>
      )}
    </div>
  );
}
