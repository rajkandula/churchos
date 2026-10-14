"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Crown, Pencil, Trash2, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import { TeamDrawer } from "../../TeamDrawer";
import type { TeamDto } from "../../types";

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [team, setTeam] = useState<TeamDto | null>(null);
  const [loadError, setLoadError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [adding, setAdding] = useState<PickedPerson | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ team: TeamDto }>(`/api/services/teams/${id}`)
      .then((data) => {
        setTeam(data.team);
        setLoadError("");
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Could not load this team.")
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(json: Record<string, unknown>, okMessage?: string) {
    try {
      const data = await api<{ team: TeamDto }>(`/api/services/teams/${id}`, {
        method: "PATCH",
        json,
      });
      setTeam(data.team);
      if (okMessage) toast.success(okMessage);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the team.");
      return false;
    }
  }

  async function addMember() {
    if (!adding) return;
    setAddBusy(true);
    const ok = await patch(
      { addMember: { personId: adding._id, roles: [] } },
      `Added ${adding.name} to the team.`
    );
    if (ok) setAdding(null);
    setAddBusy(false);
  }

  async function toggleRole(personId: string, role: string, on: boolean) {
    if (!team) return;
    const member = team.members.find((m) => m.person === personId);
    if (!member) return;
    const roles = on ? [...member.roles, role] : member.roles.filter((r) => r !== role);
    // Optimistic — the checkbox flips instantly
    setTeam({
      ...team,
      members: team.members.map((m) => (m.person === personId ? { ...m, roles } : m)),
    });
    const ok = await patch({ setRoles: { personId, roles } });
    if (!ok) load();
  }

  async function removeMember(personId: string) {
    setRemoving(personId);
    await patch({ removeMember: personId }, "Removed from the team.");
    setRemoving(null);
  }

  async function onDelete() {
    setDeleteBusy(true);
    try {
      await api(`/api/services/teams/${id}`, { method: "DELETE" });
      toast.success(`Deleted the ${team?.name} team — it's in the Recycle Bin.`);
      router.push("/dashboard/services?tab=teams");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/services?tab=teams"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Teams
      </Link>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {!team && !loadError && (
        <div className="mt-4 space-y-4">
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      )}

      {team && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{team.name}</h1>
              <p className="mt-1.5 text-slate-500">
                {team.description || "A serving team."}{" "}
                {team.members.length} member{team.members.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit team
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 text-rose-500" aria-hidden />
                Delete
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Members */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">Members</h2>
                <span className="text-xs text-slate-500">
                  Tick the roles each person can fill
                </span>
              </div>

              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <PersonPicker
                      value={adding}
                      onChange={setAdding}
                      placeholder="Add a member — search by name…"
                    />
                  </div>
                  <Button onClick={addMember} disabled={!adding} loading={addBusy}>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Add
                  </Button>
                </div>
              </div>

              {team.members.length === 0 && (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                    <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">No members yet</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Add the people who serve on this team so they can be
                    scheduled on a service plan.
                  </p>
                </div>
              )}

              <ul>
                {team.members.map((m) => (
                  <li
                    key={m.person}
                    className="flex flex-col gap-3 border-b border-slate-50 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    <Link
                      href={`/dashboard/people/${m.person}`}
                      className="flex min-w-0 items-center gap-3 sm:w-56"
                    >
                      <Avatar name={m.personName} photoUrl={m.photoUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 hover:text-indigo-600">
                          {m.personName}
                          {team.leader === m.person && (
                            <Crown
                              className="ml-1.5 inline h-3.5 w-3.5 text-amber-500"
                              aria-label="Team leader"
                            />
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {m.memberNo}
                          {m.phone ? ` · ${m.phone}` : ""}
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {team.roles.length === 0 && (
                        <span className="text-xs text-slate-400">
                          Define roles on the team to assign them here.
                        </span>
                      )}
                      {team.roles.map((role) => {
                        const on = m.roles.includes(role);
                        return (
                          <label
                            key={role}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                              on
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={on}
                              onChange={(e) => toggleRole(m.person, role, e.target.checked)}
                            />
                            {role}
                          </label>
                        );
                      })}
                    </div>
                    <button
                      aria-label={`Remove ${m.personName} from the team`}
                      onClick={() => removeMember(m.person)}
                      disabled={removing === m.person}
                      className="cursor-pointer self-start rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 sm:self-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Leader
                </h2>
                {team.leaderName ? (
                  <Link
                    href={`/dashboard/people/${team.leader}`}
                    className="mt-3 flex items-center gap-3"
                  >
                    <Avatar name={team.leaderName} size="lg" />
                    <span className="font-semibold text-slate-900 hover:text-indigo-600">
                      {team.leaderName}
                    </span>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No leader assigned.</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Roles
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {team.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                    >
                      {r}
                    </span>
                  ))}
                  {team.roles.length === 0 && (
                    <p className="text-sm text-slate-400">
                      No roles yet — edit the team to add some.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <TeamDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onSaved={(t) => setTeam(t)}
        existing={team}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this team?"
        message={`The ${team?.name ?? ""} team will move to the Recycle Bin. Existing service plans keep the names already scheduled.`}
      />
    </div>
  );
}
