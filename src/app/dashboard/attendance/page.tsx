"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { todayKey } from "@/lib/attendance-dates";
import { Tabs } from "@/components/ui/Tabs";
import { MarkTab } from "./MarkTab";
import { RegisterTab } from "./RegisterTab";
import { CheckInTab } from "./CheckInTab";
import { ServicesTab } from "./ServicesTab";
import {
  ATTENDANCE_TABS,
  type AttendanceTab,
  type CheckInDto,
  type ServiceDto,
} from "./types";

export default function AttendancePage() {
  const [tab, setTab] = useState<AttendanceTab>("mark");
  const [services, setServices] = useState<ServiceDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  // Children currently checked in today — shown live on the tab
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // Promise chains rather than async/await: state is only set inside callbacks,
  // which keeps these safe to call from an effect.
  const loadServices = useCallback(() => {
    return api<{ services: ServiceDto[] }>("/api/attendance/services")
      .then((data) => {
        setServices(data.services);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setServices([]);
        setLoadError(err instanceof Error ? err.message : "Could not load services.");
      });
  }, []);

  const loadTodayCount = useCallback(() => {
    return api<{ checkIns: CheckInDto[] }>(`/api/attendance/checkin?date=${todayKey()}`)
      .then((data) => setTodayCount(data.checkIns.filter((c) => !c.checkedOutAt).length))
      .catch(() => {
        /* the tab simply shows no count */
      });
  }, []);

  useEffect(() => {
    loadServices();
    loadTodayCount();
  }, [loadServices, loadTodayCount]);

  const active = (services ?? []).filter((s) => s.active);

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance</h1>
          <p className="mt-1.5 text-slate-500">
            Headcounts and per-person attendance for every service, plus kids
            check-in with printable security labels.
          </p>
        </div>
        <Tabs
          tabs={ATTENDANCE_TABS.map((t) => ({
            value: t.value,
            label:
              t.value === "checkin" && todayCount
                ? `Check-in · ${todayCount}`
                : t.label,
          }))}
          value={tab}
          onChange={(v) => setTab(v as AttendanceTab)}
        />
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      <div className="mt-6">
        {tab === "mark" && <MarkTab services={active} loading={services === null} />}
        {tab === "register" && (
          <RegisterTab services={services ?? []} loading={services === null} />
        )}
        {tab === "checkin" && (
          <CheckInTab
            services={active}
            loading={services === null}
            onTodayCountChange={setTodayCount}
          />
        )}
        {tab === "services" && (
          <ServicesTab services={services} onChanged={loadServices} />
        )}
      </div>
    </div>
  );
}
