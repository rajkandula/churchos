"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  Download,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate, toDateInput } from "@/lib/client-api";
import { downloadCsv } from "@/lib/csv";
import { PERSON_STATUS_LABELS, type PersonStatus } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import { GroupDrawer } from "../GroupDrawer";
import {
  GROUP_FREQUENCY_LABELS,
  GROUP_TYPE_LABELS,
  GROUP_TYPE_STYLES,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
  formatTime12,
  meetingLine,
  type GroupDto,
  type GroupMeetingDto,
  type GroupMemberDto,
} from "../types";

const roleSelectClass =
  "h-8 cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30";

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("members");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Members tab
  const [picked, setPicked] = useState<PickedPerson | null>(null);
  const [addRole, setAddRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<GroupMemberDto | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // Meetings tab
  const [meetingDate, setMeetingDate] = useState(() => toDateInput(new Date()));
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [meetingNote, setMeetingNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState<GroupMeetingDto | null>(null);
  const [deleteMeetingBusy, setDeleteMeetingBusy] = useState(false);

  const load = useCallback(() => {
    api<{ group: GroupDto }>(`/api/groups/${id}`)
      .then((data) => {
        setGroup(data.group);
        setLoadError("");
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load this group.");
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const members = useMemo(() => group?.members ?? [], [group]);
  const meetings = useMemo(() => group?.meetings ?? [], [group]);
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.person, m.personName);
    if (group?.leader) map.set(group.leader, group.leaderName ?? "");
    for (const c of group?.coLeaders ?? []) map.set(c.person, c.personName);
    return map;
  }, [members, group]);

  const full = Boolean(group?.capacity && members.length >= (group?.capacity ?? 0));

  async function addMember() {
    if (!picked || !group) return;
    setAdding(true);
    try {
      const data = await api<{ group: GroupDto }>(`/api/groups/${group._id}/members`, {
        method: "POST",
        json: { personId: picked._id, role: addRole },
      });
      setGroup(data.group);
      toast.success(`${picked.name} added to ${group.name}.`);
      setPicked(null);
      setAddRole("member");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: GroupMemberDto, role: string) {
    if (!group) return;
    const prev = group;
    setGroup({
      ...group,
      members: group.members.map((m) =>
        m.person === member.person ? { ...m, role } : m
      ),
    });
    try {
      const data = await api<{ group: GroupDto }>(`/api/groups/${group._id}/members`, {
        method: "PATCH",
        json: { personId: member.person, role },
      });
      setGroup(data.group);
    } catch (err) {
      setGroup(prev);
      toast.error(err instanceof Error ? err.message : "Could not change role.");
    }
  }

  async function removeMember() {
    if (!removing || !group) return;
    setRemoveBusy(true);
    try {
      const data = await api<{ group: GroupDto }>(`/api/groups/${group._id}/members`, {
        method: "DELETE",
        json: { personId: removing.person },
      });
      setGroup(data.group);
      toast.success(`${removing.personName} removed from ${group.name}.`);
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    } finally {
      setRemoveBusy(false);
    }
  }

  function exportCsv() {
    if (!group) return;
    downloadCsv(
      `${group.name.replace(/[^\w-]+/g, "-").toLowerCase()}-members.csv`,
      ["Name", "Role", "Phone", "Status", "Joined"],
      members.map((m) => [
        m.personName,
        MEMBER_ROLE_LABELS[m.role as keyof typeof MEMBER_ROLE_LABELS] ?? m.role,
        m.phone ?? "",
        m.status ? (PERSON_STATUS_LABELS[m.status as PersonStatus] ?? m.status) : "",
        m.joinedAt ? formatDate(m.joinedAt) : "",
      ])
    );
  }

  function togglePresent(personId: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  async function logMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!group) return;
    setLogging(true);
    try {
      const data = await api<{ meetings: GroupMeetingDto[] }>(
        `/api/groups/${group._id}/meetings`,
        {
          method: "POST",
          json: { date: meetingDate, presentIds: Array.from(present), note: meetingNote },
        }
      );
      setGroup({ ...group, meetings: data.meetings });
      toast.success(`Meeting on ${formatDate(meetingDate)} logged — ${present.size} present.`);
      setPresent(new Set());
      setMeetingNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the meeting.");
    } finally {
      setLogging(false);
    }
  }

  async function deleteMeeting() {
    if (!deletingMeeting || !group) return;
    setDeleteMeetingBusy(true);
    try {
      const data = await api<{ meetings: GroupMeetingDto[] }>(
        `/api/groups/${group._id}/meetings`,
        { method: "DELETE", json: { meetingId: deletingMeeting._id } }
      );
      setGroup({ ...group, meetings: data.meetings });
      toast.success("Meeting removed.");
      setDeletingMeeting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the meeting.");
    } finally {
      setDeleteMeetingBusy(false);
    }
  }

  const meeting = group ? meetingLine(group) : "";

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/groups"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Groups
      </Link>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {!group && !loadError && (
        <div className="mt-4 space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      )}

      {group && (
        <>
          {/* Header */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {group.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${GROUP_TYPE_STYLES[group.type]}`}
                >
                  {GROUP_TYPE_LABELS[group.type]}
                </span>
                {!group.active && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-400/20">
                    Inactive
                  </span>
                )}
                {group.open && !full ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    Open to new members
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-400/20">
                    <Lock className="h-3 w-3" aria-hidden />
                    {full ? "Full" : "Closed"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
                  {meeting || "No regular meeting"}
                </span>
                {group.nextMeeting && (
                  <span className="text-sm text-indigo-600">Next: {group.nextMeeting}</span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" aria-hidden />
                  {members.length}
                  {group.capacity ? ` / ${group.capacity}` : ""}{" "}
                  member{members.length === 1 ? "" : "s"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {group.leader ? (
                  <Link
                    href={`/dashboard/people/${group.leader}`}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-indigo-200"
                  >
                    <Avatar name={group.leaderName ?? ""} photoUrl={group.leaderPhotoUrl} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {group.leaderName}
                      </span>
                      <span className="block text-[11px] text-slate-400">Leader</span>
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-slate-400">No leader assigned yet.</p>
                )}
                {group.coLeaders.map((c) => (
                  <Link
                    key={c.person}
                    href={`/dashboard/people/${c.person}`}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-indigo-200"
                  >
                    <Avatar name={c.personName} photoUrl={c.photoUrl} size="sm" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {c.personName}
                      </span>
                      <span className="block text-[11px] text-slate-400">Co-leader</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Button>
          </div>

          <div className="mt-6">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "members", label: `Members (${members.length})` },
                { value: "meetings", label: `Meetings (${meetings.length})` },
                { value: "about", label: "About" },
              ]}
            />
          </div>

          {/* Members */}
          {tab === "members" && (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Add a member</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-start">
                  <PersonPicker
                    value={picked}
                    onChange={setPicked}
                    placeholder="Search people to add…"
                  />
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    aria-label="Role for the new member"
                    className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {MEMBER_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={addMember}
                    disabled={!picked || full}
                    loading={adding}
                    className="h-11"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add
                  </Button>
                </div>
                {full && (
                  <p className="mt-2 text-xs text-amber-700">
                    This group is at capacity ({group.capacity}). Raise the capacity to add
                    more people.
                  </p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <p className="text-sm font-bold text-slate-900">
                    {members.length} member{members.length === 1 ? "" : "s"}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={exportCsv}
                    disabled={members.length === 0}
                    className="h-8 px-3 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Export CSV
                  </Button>
                </div>
                {members.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">No members yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Search for someone above to add them to this group.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          <th className="px-5 py-3">Person</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr
                            key={m.person}
                            className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3">
                              {m.exists === false ? (
                                <div className="flex items-center gap-3">
                                  <Avatar name={m.personName} />
                                  <div>
                                    <p className="font-semibold text-slate-500">{m.personName}</p>
                                    <p className="text-xs text-slate-400">Record deleted</p>
                                  </div>
                                </div>
                              ) : (
                                <Link
                                  href={`/dashboard/people/${m.person}`}
                                  className="flex items-center gap-3"
                                >
                                  <Avatar name={m.personName} photoUrl={m.photoUrl} />
                                  <div>
                                    <p className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                                      {m.personName}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {m.status
                                        ? (PERSON_STATUS_LABELS[m.status as PersonStatus] ?? m.status)
                                        : ""}
                                    </p>
                                  </div>
                                </Link>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={m.role}
                                onChange={(e) => changeRole(m, e.target.value)}
                                aria-label={`Role of ${m.personName}`}
                                className={roleSelectClass}
                              >
                                {MEMBER_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {MEMBER_ROLE_LABELS[r]}
                                  </option>
                                ))}
                                {!(MEMBER_ROLES as readonly string[]).includes(m.role) && (
                                  <option value={m.role}>{m.role}</option>
                                )}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{m.phone || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(m.joinedAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  aria-label={`Remove ${m.personName}`}
                                  onClick={() => setRemoving(m)}
                                  className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meetings */}
          {tab === "meetings" && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
              <form
                onSubmit={logMeeting}
                className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-sm font-bold text-slate-900">Log a meeting</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Logging the same date again replaces that entry.
                </p>
                <div className="mt-4 space-y-4">
                  <TextField
                    label="Date"
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-700">
                        Who was present ({present.size}/{members.length})
                      </span>
                      <span className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPresent(new Set(members.map((m) => m.person)))}
                          className="cursor-pointer font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresent(new Set())}
                          className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700"
                        >
                          None
                        </button>
                      </span>
                    </div>
                    {members.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                        Add members first to take attendance.
                      </p>
                    ) : (
                      <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                        {members.map((m) => (
                          <li key={m.person}>
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={present.has(m.person)}
                                onChange={() => togglePresent(m.person)}
                                className="h-4 w-4 cursor-pointer accent-indigo-600"
                              />
                              <Avatar name={m.personName} photoUrl={m.photoUrl} size="sm" />
                              <span className="flex-1 truncate text-sm text-slate-800">
                                {m.personName}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <TextAreaField
                    label="Note"
                    value={meetingNote}
                    onChange={(e) => setMeetingNote(e.target.value)}
                    placeholder="What was covered, prayer points, follow-ups…"
                  />
                  <Button type="submit" loading={logging} className="w-full">
                    <CalendarCheck2 className="h-4 w-4" aria-hidden />
                    Log meeting
                  </Button>
                </div>
              </form>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <p className="text-sm font-bold text-slate-900">
                    {meetings.length} meeting{meetings.length === 1 ? "" : "s"} logged
                  </p>
                </div>
                {meetings.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <CalendarCheck2 className="h-6 w-6 text-indigo-500" aria-hidden />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">No meetings logged yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Log each gathering to keep a simple attendance history for this group.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {meetings.map((mt) => {
                      const names = mt.present
                        .map((p) => nameOf.get(p) ?? "")
                        .filter(Boolean);
                      return (
                        <li key={mt._id} className="flex items-start gap-4 px-5 py-4">
                          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                            <span className="text-base leading-none font-bold">
                              {mt.presentCount}
                            </span>
                            <span className="mt-0.5 text-[9px] font-semibold tracking-wide uppercase">
                              present
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatDate(mt.date)}
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {mt.presentCount} of {members.length}
                              </span>
                            </p>
                            {names.length > 0 && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {names.join(", ")}
                              </p>
                            )}
                            {mt.note && (
                              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-slate-600">
                                {mt.note}
                              </p>
                            )}
                          </div>
                          <button
                            aria-label={`Delete meeting on ${formatDate(mt.date)}`}
                            onClick={() => setDeletingMeeting(mt)}
                            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* About */}
          {tab === "about" && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">About</h2>
                {group.description ? (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">
                    {group.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No description yet.</p>
                )}
                <h3 className="mt-6 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Tags
                </h3>
                {group.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">—</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Meeting details</h2>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                  <Fact label="Day" value={group.meetingDay} />
                  <Fact label="Time" value={formatTime12(group.meetingTime)} />
                  <Fact label="Frequency" value={GROUP_FREQUENCY_LABELS[group.frequency]} />
                  <Fact label="Next meeting" value={group.nextMeeting} />
                  <div className="col-span-2">
                    <Fact label="Location" value={group.location} />
                  </div>
                  <Fact
                    label="Capacity"
                    value={
                      group.capacity
                        ? `${members.length} of ${group.capacity}`
                        : `${members.length} · no limit`
                    }
                  />
                  <Fact label="New members" value={group.open ? "Open" : "Closed"} />
                  <Fact label="Type" value={GROUP_TYPE_LABELS[group.type]} />
                  <Fact label="Status" value={group.active ? "Active" : "Inactive"} />
                  <Fact label="Created" value={formatDate(group.createdAt)} />
                </div>
                {group.location && (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {group.location}
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <GroupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={(g) => setGroup((cur) => (cur ? { ...cur, ...g, meetings: g.meetings ?? cur.meetings } : g))}
        existing={group}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        loading={removeBusy}
        confirmLabel="Remove"
        title="Remove from group?"
        message={`${removing?.personName} will be removed from ${group?.name ?? "this group"}. Their past meeting attendance stays in the log.`}
      />

      <ConfirmDialog
        open={Boolean(deletingMeeting)}
        onClose={() => setDeletingMeeting(null)}
        onConfirm={deleteMeeting}
        loading={deleteMeetingBusy}
        title="Delete this meeting?"
        message={`The meeting on ${deletingMeeting ? formatDate(deletingMeeting.date) : ""} and its attendance will be removed from the log.`}
      />
    </div>
  );
}
