"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { PrintButton } from "@/components/PrintButton";
import type { CheckInDto } from "../../../types";

type ChurchInfo = { name: string; logoUrl?: string };

function Code({ value }: { value: string }) {
  return (
    <p className="font-mono text-6xl font-black tracking-[0.25em] text-slate-900">{value}</p>
  );
}

/** Printable 2-up label: the child's half goes on the child, the guardian's
 *  half is the claim tag — both carry the same security code. */
export default function CheckInLabelPage() {
  const { id } = useParams<{ id: string }>();
  const [checkIn, setCheckIn] = useState<CheckInDto | null>(null);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ checkIn: CheckInDto }>(`/api/attendance/checkin/${id}`)
      .then((d) => setCheckIn(d.checkIn))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load this check-in.")
      );
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => setChurch(d.church))
      .catch(() => setChurch(null));
  }, [id]);

  return (
    <div className="animate-fade-up">
      <style>{`@media print { body { background: #fff !important; } @page { size: A5 landscape; margin: 8mm; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/attendance"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Attendance
        </Link>
        <PrintButton />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden"
        >
          {error}
        </div>
      )}

      {!checkIn && !error && (
        <div className="mt-6 h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      )}

      {checkIn && (
        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-300 bg-white sm:grid-cols-2 print:mt-0 print:max-w-none print:grid-cols-2 print:rounded-none print:border-slate-400">
          {/* Child half */}
          <div className="border-b border-dashed border-slate-300 p-8 sm:border-r sm:border-b-0">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
              {church?.name ?? "Kids check-in"}
              {checkIn.serviceName ? ` · ${checkIn.serviceName}` : ""}
            </p>
            <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">
              {checkIn.personName}
            </p>
            <p className="mt-1 text-lg text-slate-600">
              {checkIn.age !== null ? `Age ${checkIn.age}` : ""}
              {checkIn.age !== null && checkIn.room ? " · " : ""}
              {checkIn.room ? checkIn.room : ""}
            </p>
            <div className="mt-6">
              <Code value={checkIn.securityCode} />
            </div>
            <p className="mt-4 text-sm text-slate-500">{formatDate(checkIn.date)}</p>
            {checkIn.allergies && (
              <div className="mt-4 rounded-lg border-2 border-rose-500 px-3 py-2 text-base font-bold text-rose-700">
                ALLERGIES: {checkIn.allergies}
              </div>
            )}
            {checkIn.notes && <p className="mt-3 text-sm text-slate-600">{checkIn.notes}</p>}
          </div>

          {/* Guardian half */}
          <div className="p-8">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
              Guardian claim tag
            </p>
            <div className="mt-4">
              <Code value={checkIn.securityCode} />
            </div>
            <p className="mt-6 text-2xl font-bold text-slate-900">{checkIn.personName}</p>
            <p className="mt-1 text-slate-600">
              {checkIn.room ? `${checkIn.room} · ` : ""}
              {formatDate(checkIn.date)}
            </p>
            <p className="mt-4 text-sm text-slate-600">
              {checkIn.guardianName ? `${checkIn.guardianName} · ` : ""}
              {checkIn.guardianPhone}
            </p>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Present this tag with the matching code to collect {checkIn.personName.split(" ")[0]}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
