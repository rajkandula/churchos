"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  Crown,
  ListMusic,
  Plus,
  Users,
  UsersRound,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate, toDateInput } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { TeamDrawer } from "./TeamDrawer";
import {
  PLAN_STATUS_STYLES,
  formatDuration,
  monthKey,
  weekday,
  type PlanDto,
  type PlanSummaryDto,
  type TeamDto,
} from "./types";

/** Next Sunday (or today if it is Sunday) as a date-input value. */
function nextSunday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return toDateInput(d);
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesPageInner />
    </Suspense>
  );
}

function ServicesPageInner() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // Deep link: /dashboard/services?tab=teams
  const [tab, setTab] = useState(searchParams.get("tab") === "teams" ? "teams" : "plans");

  const [plans, setPlans] = useState<PlanSummaryDto[] | null>(null);
  const [teams, setTeams] = useState<TeamDto[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    date: nextSunday(),
    title: "Sunday Service",
    theme: "",
    copyFrom: "",
  });
  const [creating, setCreating] = useState(false);
  const [teamDrawer, setTeamDrawer] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api<{ plans: PlanSummaryDto[] }>("/api/services/plans"),
      api<{ teams: TeamDto[] }>("/api/services/teams"),
    ])
      .then(([p, t]) => {
        setPlans(p.plans);
        setTeams(t.teams);
        setLoadError("");
      })
      .catch((err) => {
        setPlans([]);
        setTeams([]);
        setLoadError(err instanceof Error ? err.message : "Could not load services.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PlanSummaryDto[]>();
    for (const p of plans ?? []) {
      const key = monthKey(p.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [plans]);

  const nextPlanId = useMemo(
    () => (plans ?? []).find((p) => new Date(p.date).getTime() >= today)?._id,
    [plans, today]
  );

  // Most recent first — copying last week's order is the common case
  const copyOptions = useMemo(
    () =>
      [...(plans ?? [])]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((p) => ({
          value: p._id,
          label: `${formatDate(p.date)} — ${p.title}${p.itemCount ? ` (${p.itemCount} items)` : ""}`,
        })),
    [plans]
  );

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.date) {
      toast.error("Please choose the service date.");
      return;
    }
    setCreating(true);
    try {
      const data = await api<{ plan: PlanDto }>("/api/services/plans", {
        method: "POST",
        json: planForm,
      });
      toast.success("Plan created.");
      setPlanModal(false);
      router.push(`/dashboard/services/plans/${data.plan._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the plan.");
    } finally {
      setCreating(false);
    }
  }

  const upcoming = (plans ?? []).filter((p) => new Date(p.date).getTime() >= today).length;

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Services</h1>
          <p className="mt-1.5 text-slate-500">
            Plan the order of service and schedule who is serving —{" "}
            {plans ? `${upcoming} upcoming service${upcoming === 1 ? "" : "s"}` : "…"},{" "}
            {teams ? `${teams.length} team${teams.length === 1 ? "" : "s"}` : "…"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {tab === "plans" ? (
            <Button
              onClick={() => {
                setPlanForm({ date: nextSunday(), title: "Sunday Service", theme: "", copyFrom: "" });
                setPlanModal(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New plan
            </Button>
          ) : (
            <Button onClick={() => setTeamDrawer(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New team
            </Button>
          )}
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

      <div className="mt-6">
        <Tabs
          tabs={[
            { value: "plans", label: "Plans" },
            { value: "teams", label: "Teams" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "plans" && (
        <div className="mt-5 space-y-6">
          {plans === null &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}

          {plans?.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                <CalendarDays className="h-6 w-6 text-indigo-500" aria-hidden />
              </div>
              <p className="mt-3 font-semibold text-slate-900">No service plans yet</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Create a plan for the next Sunday, build the running order, and
                schedule your teams.
              </p>
              <Button className="mt-5" onClick={() => setPlanModal(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New plan
              </Button>
            </div>
          )}

          {grouped.map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
                {month}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {list.map((p) => {
                  const past = new Date(p.date).getTime() < today;
                  const isNext = p._id === nextPlanId;
                  return (
                    <Link
                      key={p._id}
                      href={`/dashboard/services/plans/${p._id}`}
                      className={`flex items-center gap-4 border-b border-slate-50 px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-slate-50/60 ${
                        past ? "opacity-70" : ""
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${
                          isNext ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase leading-none opacity-80">
                          {weekday(p.date)}
                        </span>
                        <span className="mt-0.5 text-lg font-bold leading-none">
                          {new Date(p.date).getUTCDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {p.title}
                          {p.theme && (
                            <span className="font-normal text-slate-500"> · {p.theme}</span>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {p.preacherName && (
                            <span className="inline-flex items-center gap-1">
                              <Crown className="h-3 w-3" aria-hidden />
                              {p.preacherName}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <ListMusic className="h-3 w-3" aria-hidden />
                            {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden />
                            {formatDuration(p.totalDurationMin)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden />
                            {p.volunteerCount} serving
                          </span>
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${PLAN_STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "teams" && (
        <div className="mt-5">
          {teams === null && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          )}

          {teams?.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                <UsersRound className="h-6 w-6 text-indigo-500" aria-hidden />
              </div>
              <p className="mt-3 font-semibold text-slate-900">No teams yet</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Set up Worship, Ushers, Media and Kids teams with the roles each
                one fills on a service day.
              </p>
              <Button className="mt-5" onClick={() => setTeamDrawer(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New team
              </Button>
            </div>
          )}

          {teams && teams.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => (
                <Link
                  key={t._id}
                  href={`/dashboard/services/teams/${t._id}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-indigo-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900 transition-colors duration-150 group-hover:text-indigo-600">
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                          {t.description}
                        </p>
                      )}
                    </div>
                    {!t.active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                    {t.leaderName ? (
                      <>
                        <Avatar name={t.leaderName} size="sm" />
                        <span className="truncate">
                          Led by <span className="font-semibold text-slate-800">{t.leaderName}</span>
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">No leader yet</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {t.memberCount ?? t.members.length}
                    </span>
                    {t.roles.slice(0, 5).map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
                      >
                        {r}
                      </span>
                    ))}
                    {t.roles.length > 5 && (
                      <span className="text-[11px] text-slate-400">+{t.roles.length - 5}</span>
                    )}
                    {t.roles.length === 0 && (
                      <span className="text-[11px] text-slate-400">No roles defined</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        title="New service plan"
        subtitle="Start blank or copy last week's order of service and roster."
      >
        <form onSubmit={createPlan} className="space-y-4">
          <TextField
            label="Service date"
            type="date"
            required
            value={planForm.date}
            onChange={(e) => setPlanForm((f) => ({ ...f, date: e.target.value }))}
          />
          <TextField
            label="Title"
            value={planForm.title}
            onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Sunday Service"
          />
          <TextField
            label="Theme"
            value={planForm.theme}
            onChange={(e) => setPlanForm((f) => ({ ...f, theme: e.target.value }))}
            placeholder="Faith that moves mountains"
          />
          <SelectField
            label="Copy from a previous plan"
            value={planForm.copyFrom}
            onChange={(e) => setPlanForm((f) => ({ ...f, copyFrom: e.target.value }))}
            options={copyOptions}
            placeholder="Start from scratch"
            hint="Copies the items and volunteer slots; everyone is reset to “scheduled”."
            disabled={!copyOptions.length}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setPlanModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create plan
            </Button>
          </div>
        </form>
      </Modal>

      <TeamDrawer
        open={teamDrawer}
        onClose={() => setTeamDrawer(false)}
        onSaved={() => load()}
        existing={null}
      />
    </div>
  );
}
