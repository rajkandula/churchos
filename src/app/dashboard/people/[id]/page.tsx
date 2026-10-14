"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  FileText,
  HandHeart,
  Home,
  Pencil,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { HOUSEHOLD_ROLE_LABELS, PERSON_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/Avatar";
import { PersonDrawer } from "../PersonDrawer";
import { PILL_STYLES, type PeopleOptions, type PersonDto } from "../types";

/** Cross-app summaries — each app exposes /api/<app>/person-summary/[id].
 *  All are best-effort: a missing app simply hides its tile. */
type GivingSummary = {
  year: string;
  total: number;
  count: number;
  lastDate?: string | null;
  currency?: string;
};
type AttendanceSummary = {
  label: string;
  present: number;
  total: number;
  percent: number | null;
  lastPresent?: string | null;
};
type GroupsSummary = {
  groups: { _id: string; name: string; type?: string; role?: string }[];
};
type FamilyMember = { _id: string; name: string; householdRole: string; photoUrl: string };

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

function age(dob?: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return years >= 0 ? ` (${years})` : "";
}

export default function PersonProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<PersonDto | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [giving, setGiving] = useState<GivingSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [groups, setGroups] = useState<GroupsSummary | null>(null);
  const [households, setHouseholds] = useState<{ _id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(() => {
    api<{ person: PersonDto; family: FamilyMember[] }>(`/api/people/${id}`)
      .then((data) => {
        setPerson(data.person);
        setFamily(data.family ?? []);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Could not load this person.")
      );
    api<PeopleOptions>("/api/people/options")
      .then((o) => setHouseholds(o.households))
      .catch(() => {});
    api<GivingSummary>(`/api/giving/person-summary/${id}`)
      .then(setGiving)
      .catch(() => setGiving(null));
    api<AttendanceSummary>(`/api/attendance/person-summary/${id}`)
      .then(setAttendance)
      .catch(() => setAttendance(null));
    api<GroupsSummary>(`/api/groups/person-summary/${id}`)
      .then(setGroups)
      .catch(() => setGroups(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/people"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        People
      </Link>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {person && (
        <>
          {/* Header */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={person.name} photoUrl={person.photoUrl} size="xl" />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {person.name}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PILL_STYLES[person.status]}`}
                  >
                    {PERSON_STATUS_LABELS[person.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {person.memberNo}
                  {person.householdName ? ` · ${person.householdName}` : ""}
                  {person.householdRole
                    ? ` (${HOUSEHOLD_ROLE_LABELS[person.householdRole] ?? person.householdRole})`
                    : ""}
                  {person.memberSince ? ` · Member since ${formatDate(person.memberSince)}` : ""}
                </p>
                {(person.tags?.length ?? 0) > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {person.tags!.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Button>
          </div>

          {/* Cross-app tiles */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href={`/dashboard/giving?person=${person._id}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-200"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <HandHeart className="h-5 w-5 text-emerald-600" aria-hidden />
              </span>
              {giving ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(giving.total, giving.currency)} in {giving.year}
                  </p>
                  <p className="text-xs text-slate-500">
                    {giving.count} gift{giving.count === 1 ? "" : "s"}
                    {giving.lastDate ? ` · last ${formatDate(giving.lastDate)}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No giving recorded yet.</p>
              )}
            </Link>
            <Link
              href="/dashboard/attendance"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-200"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <CalendarCheck2 className="h-5 w-5 text-amber-600" aria-hidden />
              </span>
              {attendance && attendance.percent !== null ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {attendance.percent}% present — {attendance.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {attendance.present} of {attendance.total} services
                    {attendance.lastPresent
                      ? ` · last ${formatDate(attendance.lastPresent)}`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No attendance marked yet.</p>
              )}
            </Link>
            <Link
              href="/dashboard/groups"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-200"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50">
                <UsersRound className="h-5 w-5 text-sky-600" aria-hidden />
              </span>
              {groups && groups.groups.length > 0 ? (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {groups.groups.length} group{groups.groups.length === 1 ? "" : "s"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {groups.groups.map((g) => g.name).join(", ")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Not in any group yet.</p>
              )}
            </Link>
          </div>

          {/* Details */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-bold text-slate-900">Personal</h2>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact
                  label="Date of birth"
                  value={person.dob ? `${formatDate(person.dob)}${age(person.dob)}` : ""}
                />
                <Fact label="Gender" value={person.gender} />
                <Fact label="Marital status" value={person.maritalStatus} />
                <Fact label="Blood group" value={person.bloodGroup} />
                <Fact label="Occupation" value={person.occupation} />
                <Fact label="First visit" value={formatDate(person.firstVisit)} />
                <Fact label="Found us via" value={person.source} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-bold text-slate-900">Contact</h2>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact label="Phone" value={person.phone} />
                <Fact label="Alternate" value={person.altPhone} />
                <Fact label="Email" value={person.email} />
                <div className="col-span-2">
                  <Fact
                    label="Address"
                    value={[person.address, person.city, person.state, person.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-bold text-slate-900">Milestones</h2>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact
                  label="Baptism"
                  value={
                    person.baptismDate
                      ? `${formatDate(person.baptismDate)}${person.baptismPlace ? ` · ${person.baptismPlace}` : ""}`
                      : ""
                  }
                />
                <Fact label="Child dedication" value={formatDate(person.dedicationDate)} />
                <Fact label="Confirmation" value={formatDate(person.confirmationDate)} />
                <Fact label="Marriage" value={formatDate(person.marriageDate)} />
                <Fact label="Member since" value={formatDate(person.memberSince)} />
              </div>
              <Link
                href={`/dashboard/certificates?person=${person._id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Issue a certificate
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Household</h2>
                {person.household && (
                  <Link
                    href={`/dashboard/people/households?open=${person.household}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <Home className="h-3.5 w-3.5" aria-hidden />
                    {person.householdName}
                  </Link>
                )}
              </div>
              {person.household ? (
                family.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {family.map((m) => (
                      <li key={m._id}>
                        <Link
                          href={`/dashboard/people/${m._id}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 transition-colors hover:border-indigo-200"
                        >
                          <Avatar name={m.name} photoUrl={m.photoUrl} size="sm" />
                          <span className="flex-1 text-sm font-medium text-slate-800">
                            {m.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {HOUSEHOLD_ROLE_LABELS[m.householdRole] ?? ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No one else in this household yet.
                  </p>
                )
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Not linked to a household. Edit this person to attach one.
                </p>
              )}

              <h2 className="mt-6 text-sm font-bold text-slate-900">Documents</h2>
              {person.documents && person.documents.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {person.documents.map((doc, i) => (
                    <li key={`${doc.url}-${i}`}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                        {doc.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No documents uploaded yet.</p>
              )}
              {person.notes && (
                <>
                  <h2 className="mt-6 text-sm font-bold text-slate-900">Notes</h2>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">
                    {person.notes}
                  </p>
                </>
              )}
            </section>
          </div>
        </>
      )}

      <PersonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
        existing={person}
        households={households}
      />
    </div>
  );
}
