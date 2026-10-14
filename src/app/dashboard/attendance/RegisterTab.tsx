"use client";

import { Download, Grid3x3 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { downloadCsv } from "@/lib/csv";
import { addDaysToKey, todayKey } from "@/lib/attendance-dates";
import { Button } from "@/components/ui/Button";
import {
  inputClass,
  selectClass,
  serviceLabel,
  type RegisterData,
  type ServiceDto,
} from "./types";

function shortDate(key: string): string {
  const d = new Date(key);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function percent(present: number, marked: number): string {
  return marked ? `${Math.round((present / marked) * 100)}%` : "—";
}

export function RegisterTab({
  services,
  loading,
}: {
  services: ServiceDto[];
  loading: boolean;
}) {
  const [serviceId, setServiceId] = useState("");
  const [from, setFrom] = useState(addDaysToKey(todayKey(), -84));
  const [to, setTo] = useState(todayKey());
  const [loaded, setLoaded] = useState<RegisterData | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadError, setLoadError] = useState("");

  const effectiveServiceId =
    serviceId && services.some((s) => s._id === serviceId) ? serviceId : services[0]?._id ?? "";
  const service = services.find((s) => s._id === effectiveServiceId);

  const key = `${effectiveServiceId}|${from}|${to}`;

  useEffect(() => {
    if (!effectiveServiceId || !from || !to) return;
    let cancelled = false;
    const thisKey = `${effectiveServiceId}|${from}|${to}`;
    const params = new URLSearchParams({ service: effectiveServiceId, from, to });
    api<RegisterData>(`/api/attendance/register?${params}`)
      .then((d) => {
        if (cancelled) return;
        setLoaded(d);
        setLoadError("");
        setLoadedKey(thisKey);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({ from, to, dates: [], rows: [], headcounts: {} });
        setLoadError(err instanceof Error ? err.message : "Could not load the register.");
        setLoadedKey(thisKey);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveServiceId, from, to]);

  // Anything not matching the current pickers shows the skeleton
  const data = loadedKey === key ? loaded : null;

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `register-${(service?.name ?? "service").replace(/\s+/g, "-").toLowerCase()}-${data.from}-to-${data.to}.csv`,
      ["Person", ...data.dates, "Present", "Marked", "%"],
      [
        ["Headcount", ...data.dates.map((d) => data.headcounts[d] ?? ""), "", "", ""],
        ...data.rows.map((r) => [
          r.personName,
          ...data.dates.map((d) =>
            r.marks[d] === true ? "P" : r.marks[d] === false ? "A" : ""
          ),
          r.presentCount,
          r.markedCount,
          percent(r.presentCount, r.markedCount),
        ]),
      ]
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Service</span>
          <select
            value={effectiveServiceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={selectClass}
            disabled={loading}
          >
            {services.map((s) => (
              <option key={s._id} value={s._id}>
                {serviceLabel(s)}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="ml-auto">
          <Button variant="secondary" onClick={exportCsv} disabled={!data?.dates.length}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {data === null && (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}

        {data && data.dates.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Grid3x3 className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">Nothing marked in this range</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Attendance saved in the Mark tab for {service?.name ?? "this service"} will
              fill in this register.
            </p>
          </div>
        )}

        {data && data.dates.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="sticky left-0 z-10 bg-slate-50 px-5 py-3.5">Person</th>
                  {data.dates.map((d) => (
                    <th key={d} className="px-2 py-3.5 text-center whitespace-nowrap">
                      {shortDate(d)}
                    </th>
                  ))}
                  <th className="px-3 py-3.5 text-right">Present</th>
                  <th className="px-3 py-3.5 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 bg-indigo-50/40 font-semibold text-slate-800">
                  <td className="sticky left-0 z-10 bg-indigo-50 px-5 py-3">Headcount</td>
                  {data.dates.map((d) => (
                    <td key={d} className="px-2 py-3 text-center tabular-nums">
                      {data.headcounts[d] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3" colSpan={2} />
                </tr>
                {data.rows.map((r) => (
                  <tr
                    key={r.person}
                    className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                  >
                    <td className="sticky left-0 z-10 bg-white px-5 py-2.5 font-medium whitespace-nowrap text-slate-900">
                      {r.personName}
                    </td>
                    {data.dates.map((d) => (
                      <td key={d} className="px-2 py-2.5 text-center">
                        {r.marks[d] === true ? (
                          <span className="font-bold text-emerald-600" aria-label="Present">
                            ✓
                          </span>
                        ) : r.marks[d] === false ? (
                          <span className="text-slate-300" aria-label="Absent">
                            ·
                          </span>
                        ) : (
                          <span className="text-slate-200" aria-label="Not marked">
                            {" "}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {r.presentCount}
                      <span className="text-slate-400">/{r.markedCount}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                      {percent(r.presentCount, r.markedCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.dates.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            {data.rows.length} {data.rows.length === 1 ? "person" : "people"} across{" "}
            {data.dates.length} {data.dates.length === 1 ? "service" : "services"} · ✓ present
            · · absent · blank not marked
          </div>
        )}
      </div>
    </div>
  );
}
