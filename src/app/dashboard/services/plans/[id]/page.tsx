"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  CircleAlert,
  Clock,
  Cross,
  Film,
  HandCoins,
  Loader2,
  Megaphone,
  Mic2,
  Music,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wine,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, formatDate, toDateInput } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  ITEM_TYPES,
  ITEM_TYPE_DEFAULT_MIN,
  ITEM_TYPE_LABELS,
  PLAN_STATUSES,
  VOLUNTEER_STATUS_LABELS,
  VOLUNTEER_STATUS_STYLES,
  formatDuration,
  totalMinutes,
  type ItemType,
  type PlanDto,
  type PlanItemDto,
  type PlanVolunteerDto,
  type TeamDto,
  type VolunteerStatus,
} from "../../types";

type LocalItem = PlanItemDto & { _key: string };
type LocalVolunteer = PlanVolunteerDto & { _key: string };
type LocalPlan = Omit<PlanDto, "items" | "volunteers"> & {
  items: LocalItem[];
  volunteers: LocalVolunteer[];
};
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";
const selectClass = `${inputClass} cursor-pointer`;

const TYPE_ICONS: Record<ItemType, typeof Music> = {
  song: Music,
  prayer: Sparkles,
  scripture: BookOpen,
  sermon: Mic2,
  announcement: Megaphone,
  offering: HandCoins,
  communion: Wine,
  video: Film,
  other: Cross,
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function withKeys(plan: PlanDto): LocalPlan {
  return {
    ...plan,
    items: plan.items.map((i) => ({ ...i, _key: i._id ?? newKey() })),
    volunteers: plan.volunteers.map((v) => ({ ...v, _key: v._id ?? newKey() })),
  };
}

function itemsForApi(items: LocalItem[]) {
  return items.map((i) => ({
    _id: i._id,
    type: i.type,
    // A title being retyped is briefly empty — never fail the autosave for it
    title: i.title.trim() || ITEM_TYPE_LABELS[i.type],
    detail: i.detail ?? "",
    owner: i.owner ?? null,
    durationMin: i.durationMin,
  }));
}

function volunteersForApi(volunteers: LocalVolunteer[]) {
  return volunteers.map((v) => ({
    _id: v._id,
    team: v.team,
    role: v.role,
    person: v.person ?? null,
    status: v.status,
  }));
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold text-slate-700">{children}</span>;
}

/** Compact person chooser for an item's owner — a pill when set, a
 *  search box only while choosing. */
function OwnerPicker({
  item,
  onChange,
}: {
  item: LocalItem;
  onChange: (p: PickedPerson | null) => void;
}) {
  const [searching, setSearching] = useState(false);
  if (item.owner) {
    return (
      <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 pl-1.5 pr-1 text-sm">
        <Avatar name={item.ownerName ?? ""} photoUrl={item.ownerPhotoUrl} size="sm" className="h-6 w-6 text-[9px]" />
        <span className="truncate font-medium text-slate-800">{item.ownerName}</span>
        <button
          type="button"
          aria-label={`Clear ${item.ownerName}`}
          onClick={() => onChange(null)}
          className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }
  if (searching) {
    return (
      <div className="w-full sm:w-72">
        <PersonPicker
          value={null}
          onChange={(p) => {
            onChange(p);
            setSearching(false);
          }}
          placeholder="Who leads this?"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setSearching(true)}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:border-indigo-300 hover:text-indigo-600"
    >
      <UserPlus className="h-3.5 w-3.5" aria-hidden />
      Assign leader
    </button>
  );
}

/** One volunteer slot — pick a team member (or search anyone), then confirm/decline. */
function SlotRow({
  team,
  role,
  slot,
  statusBusy,
  onAssign,
  onStatus,
  onClear,
}: {
  team: TeamDto | null;
  role: string;
  slot: LocalVolunteer | null;
  statusBusy: boolean;
  onAssign: (p: PickedPerson) => void;
  onStatus: (status: VolunteerStatus) => void;
  onClear: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const suggested = useMemo(() => {
    const members = team?.members ?? [];
    const withRole = members.filter((m) => m.roles.includes(role));
    const rest = members.filter((m) => !m.roles.includes(role));
    return [...withRole, ...rest];
  }, [team, role]);

  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-full shrink-0 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:w-28 sm:truncate">
        {role || "Slot"}
      </span>
      <div className="min-w-0 flex-1">
        {slot?.person ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={slot.personName ?? ""} photoUrl={slot.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{slot.personName}</p>
              {slot.phone && <p className="truncate text-xs text-slate-400">{slot.phone}</p>}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${VOLUNTEER_STATUS_STYLES[slot.status]}`}
            >
              {VOLUNTEER_STATUS_LABELS[slot.status]}
            </span>
            <div className="flex items-center gap-0.5">
              {slot.status !== "confirmed" && (
                <button
                  type="button"
                  aria-label={`Confirm ${slot.personName}`}
                  title={slot._id ? "Confirm" : "Saving…"}
                  disabled={!slot._id || statusBusy}
                  onClick={() => onStatus("confirmed")}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-wait disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              {slot.status !== "declined" && (
                <button
                  type="button"
                  aria-label={`Decline ${slot.personName}`}
                  title={slot._id ? "Decline" : "Saving…"}
                  disabled={!slot._id || statusBusy}
                  onClick={() => onStatus("declined")}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {slot.status !== "scheduled" && (
                <button
                  type="button"
                  title="Back to scheduled"
                  aria-label="Reset to scheduled"
                  disabled={!slot._id || statusBusy}
                  onClick={() => onStatus("scheduled")}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <Clock className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${slot.personName} from this slot`}
                title="Remove"
                onClick={onClear}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : searching || suggested.length === 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <PersonPicker
                value={null}
                onChange={(p) => {
                  if (p) onAssign(p);
                  setSearching(false);
                }}
                placeholder={`Search anyone for ${role || "this slot"}…`}
              />
            </div>
            {suggested.length > 0 && (
              <button
                type="button"
                onClick={() => setSearching(false)}
                className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-indigo-600"
              >
                Team list
              </button>
            )}
            {slot && (
              <button
                type="button"
                aria-label="Remove this slot"
                onClick={onClear}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              aria-label={`Choose ${role} from the ${team?.name ?? ""} team`}
              value=""
              onChange={(e) => {
                if (e.target.value === "__search") {
                  setSearching(true);
                  return;
                }
                const m = suggested.find((x) => x.person === e.target.value);
                if (m) onAssign({ _id: m.person, name: m.personName, memberNo: m.memberNo ?? "" });
              }}
              className={selectClass}
            >
              <option value="">Choose from {team?.name ?? "the team"}…</option>
              {suggested.map((m) => (
                <option key={m.person} value={m.person}>
                  {m.personName}
                  {m.roles.includes(role) ? "" : " (other roles)"}
                </option>
              ))}
              <option value="__search">Search someone else…</option>
            </select>
            {slot && (
              <button
                type="button"
                aria-label="Remove this slot"
                onClick={onClear}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [plan, setPlan] = useState<LocalPlan | null>(null);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<{ type: ItemType; title: string }>({
    type: "song",
    title: "",
  });
  const [newSlotRole, setNewSlotRole] = useState<Record<string, string>>({});

  const pendingRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, t] = await Promise.all([
          api<{ plan: PlanDto }>(`/api/services/plans/${id}`),
          api<{ teams: TeamDto[] }>("/api/services/teams"),
        ]);
        setPlan(withKeys(p.plan));
        setTeams(t.teams.filter((x) => x.active));
        setLoadError("");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load this plan.");
      }
    })();
  }, [id]);

  /** Send whatever is pending. Server ids for new rows are adopted so
   *  confirm/decline works without a reload. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const body = pendingRef.current;
    pendingRef.current = {};
    if (!Object.keys(body).length) return;
    setSaveState("saving");
    try {
      const data = await api<{ plan: PlanDto }>(`/api/services/plans/${id}`, {
        method: "PATCH",
        json: body,
      });
      setPlan((cur) => {
        if (!cur) return cur;
        let next = cur;
        const newer = pendingRef.current;
        if (
          body.items !== undefined &&
          newer.items === undefined &&
          data.plan.items.length === cur.items.length
        ) {
          next = {
            ...next,
            items: cur.items.map((it, i) => ({
              ...it,
              _id: data.plan.items[i]._id,
              ownerName: data.plan.items[i].ownerName,
              ownerMemberNo: data.plan.items[i].ownerMemberNo,
              ownerPhotoUrl: data.plan.items[i].ownerPhotoUrl,
            })),
          };
        }
        if (
          body.volunteers !== undefined &&
          newer.volunteers === undefined &&
          data.plan.volunteers.length === cur.volunteers.length
        ) {
          next = {
            ...next,
            volunteers: cur.volunteers.map((v, i) => ({
              ...v,
              _id: data.plan.volunteers[i]._id,
              teamName: data.plan.volunteers[i].teamName,
              personName: data.plan.volunteers[i].personName,
              memberNo: data.plan.volunteers[i].memberNo,
              photoUrl: data.plan.volunteers[i].photoUrl,
              phone: data.plan.volunteers[i].phone,
            })),
          };
        }
        if (body.preacher !== undefined && newer.preacher === undefined) {
          next = {
            ...next,
            preacherName: data.plan.preacherName,
            preacherMemberNo: data.plan.preacherMemberNo,
            preacherPhotoUrl: data.plan.preacherPhotoUrl,
          };
        }
        return next;
      });
      setSaveState(Object.keys(pendingRef.current).length ? "dirty" : "saved");
    } catch (err) {
      // Keep the failed patch so the next edit retries it
      pendingRef.current = { ...body, ...pendingRef.current };
      setSaveState("error");
      toast.error(err instanceof Error ? err.message : "Could not save changes.");
    }
  }, [id, toast]);

  const queue = useCallback(
    (patch: Record<string, unknown>) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, 800);
    },
    [flush]
  );

  // Don't lose the last keystrokes when leaving the page
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingRef.current).length) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (Object.keys(pendingRef.current).length) flush();
    };
  }, [flush]);

  // ----- header fields
  function setField<K extends keyof LocalPlan>(key: K, value: LocalPlan[K]) {
    setPlan((cur) => (cur ? { ...cur, [key]: value } : cur));
    queue({ [key]: value });
  }

  function setPreacher(p: PickedPerson | null) {
    setPlan((cur) =>
      cur
        ? {
            ...cur,
            preacher: p?._id ?? null,
            preacherName: p?.name ?? "",
            preacherMemberNo: p?.memberNo ?? "",
            preacherPhotoUrl: p?.photoUrl ?? "",
          }
        : cur
    );
    queue({ preacher: p?._id ?? "" });
  }

  // ----- items
  function commitItems(items: LocalItem[]) {
    const ordered = items.map((it, i) => ({ ...it, order: i }));
    setPlan((cur) => (cur ? { ...cur, items: ordered } : cur));
    queue({ items: itemsForApi(ordered) });
  }

  function updateItem(key: string, patch: Partial<LocalItem>) {
    if (!plan) return;
    commitItems(plan.items.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  }

  function moveItem(index: number, dir: -1 | 1) {
    if (!plan) return;
    const target = index + dir;
    if (target < 0 || target >= plan.items.length) return;
    const next = [...plan.items];
    [next[index], next[target]] = [next[target], next[index]];
    commitItems(next);
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;
    const title = newItem.title.trim() || ITEM_TYPE_LABELS[newItem.type];
    commitItems([
      ...plan.items,
      {
        _key: newKey(),
        order: plan.items.length,
        type: newItem.type,
        title,
        detail: "",
        owner: null,
        ownerName: "",
        durationMin: ITEM_TYPE_DEFAULT_MIN[newItem.type],
      },
    ]);
    setNewItem((n) => ({ ...n, title: "" }));
  }

  // ----- volunteers
  function commitVolunteers(volunteers: LocalVolunteer[]) {
    setPlan((cur) => (cur ? { ...cur, volunteers } : cur));
    queue({ volunteers: volunteersForApi(volunteers) });
  }

  function assignSlot(team: TeamDto | null, teamId: string, role: string, slot: LocalVolunteer | null, p: PickedPerson) {
    if (!plan) return;
    const filled: Partial<LocalVolunteer> = {
      person: p._id,
      personName: p.name,
      memberNo: p.memberNo,
      photoUrl: p.photoUrl ?? "",
      phone: p.phone ?? "",
      status: "scheduled",
    };
    if (slot) {
      commitVolunteers(
        plan.volunteers.map((v) => (v._key === slot._key ? { ...v, ...filled, _id: v._id } : v))
      );
    } else {
      commitVolunteers([
        ...plan.volunteers,
        {
          _key: newKey(),
          team: teamId,
          teamName: team?.name ?? "",
          role,
          ...filled,
          status: "scheduled",
        },
      ]);
    }
  }

  function clearSlot(team: TeamDto | null, slot: LocalVolunteer) {
    if (!plan) return;
    const isDefaultRole = team?.roles.includes(slot.role) ?? false;
    if (isDefaultRole || !slot.person) {
      commitVolunteers(plan.volunteers.filter((v) => v._key !== slot._key));
    } else {
      commitVolunteers(
        plan.volunteers.map((v) =>
          v._key === slot._key
            ? { ...v, person: null, personName: "", memberNo: "", photoUrl: "", phone: "", status: "scheduled" }
            : v
        )
      );
    }
  }

  function addSlot(team: TeamDto) {
    if (!plan) return;
    const role = (newSlotRole[team._id] ?? "").trim();
    if (!role) return;
    commitVolunteers([
      ...plan.volunteers,
      {
        _key: newKey(),
        team: team._id,
        teamName: team.name,
        role,
        person: null,
        personName: "",
        status: "scheduled",
      },
    ]);
    setNewSlotRole((r) => ({ ...r, [team._id]: "" }));
  }

  async function setSlotStatus(slot: LocalVolunteer, status: VolunteerStatus) {
    if (!slot._id) return;
    setStatusBusy(slot._key);
    const prev = slot.status;
    setPlan((cur) =>
      cur
        ? { ...cur, volunteers: cur.volunteers.map((v) => (v._key === slot._key ? { ...v, status } : v)) }
        : cur
    );
    try {
      await api(`/api/services/plans/${id}/volunteers/${slot._id}`, {
        method: "PATCH",
        json: { status },
      });
    } catch (err) {
      setPlan((cur) =>
        cur
          ? { ...cur, volunteers: cur.volunteers.map((v) => (v._key === slot._key ? { ...v, status: prev } : v)) }
          : cur
      );
      toast.error(err instanceof Error ? err.message : "Could not update the slot.");
    } finally {
      setStatusBusy(null);
    }
  }

  async function onDelete() {
    setDeleteBusy(true);
    try {
      pendingRef.current = {};
      await api(`/api/services/plans/${id}`, { method: "DELETE" });
      toast.success("Plan deleted — it's in the Recycle Bin.");
      router.push("/dashboard/services");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
      setDeleteBusy(false);
    }
  }

  // ----- derived
  const sections = useMemo(() => {
    if (!plan) return [];
    return teams.map((team) => {
      const slots = plan.volunteers.filter((v) => v.team === team._id);
      const rows: { role: string; slot: LocalVolunteer | null }[] = [];
      for (const role of team.roles) {
        const matching = slots.filter((s) => s.role === role);
        if (matching.length) matching.forEach((s) => rows.push({ role, slot: s }));
        else rows.push({ role, slot: null });
      }
      for (const s of slots) if (!team.roles.includes(s.role)) rows.push({ role: s.role, slot: s });
      return { team, rows };
    });
  }, [plan, teams]);

  const orphans = useMemo(() => {
    if (!plan) return [];
    return plan.volunteers.filter((v) => !teams.some((t) => t._id === v.team));
  }, [plan, teams]);

  const total = plan ? totalMinutes(plan.items) : 0;
  const filled = plan ? plan.volunteers.filter((v) => v.person) : [];
  const confirmed = filled.filter((v) => v.status === "confirmed").length;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Services
        </Link>
        <SaveIndicator state={saveState} onRetry={flush} />
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {!plan && !loadError && (
        <div className="mt-4 space-y-4">
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      )}

      {plan && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{plan.title}</h1>
              <p className="mt-1.5 text-slate-500">
                {formatDate(plan.date)}
                {plan.theme ? ` · ${plan.theme}` : ""} · {plan.items.length} item
                {plan.items.length === 1 ? "" : "s"}, {formatDuration(total)} ·{" "}
                {confirmed}/{filled.length} confirmed
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/dashboard/services/plans/${id}/print`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Print run sheet
              </Link>
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 text-rose-500" aria-hidden />
                Delete
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            {/* ---------- LEFT: header + order of service ---------- */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <Label>Date</Label>
                    <input
                      type="date"
                      value={toDateInput(plan.date)}
                      onChange={(e) => e.target.value && setField("date", `${e.target.value}T00:00:00.000Z`)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <Label>Title</Label>
                    <input
                      value={plan.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Sunday Service"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <Label>Theme</Label>
                    <input
                      value={plan.theme ?? ""}
                      onChange={(e) => setField("theme", e.target.value)}
                      placeholder="Faith that moves mountains"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <Label>Scripture</Label>
                    <input
                      value={plan.scripture ?? ""}
                      onChange={(e) => setField("scripture", e.target.value)}
                      placeholder="Matthew 17:14–20"
                      className={inputClass}
                    />
                  </label>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label>Preacher</Label>
                    <PersonPicker
                      value={
                        plan.preacher
                          ? {
                              _id: plan.preacher,
                              name: plan.preacherName ?? "",
                              memberNo: plan.preacherMemberNo ?? "",
                              photoUrl: plan.preacherPhotoUrl,
                            }
                          : null
                      }
                      onChange={setPreacher}
                      placeholder="Who is preaching?"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Status</Label>
                    <div className="inline-flex h-9 w-fit rounded-lg border border-slate-200 bg-white p-0.5">
                      {PLAN_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setField("status", s)}
                          className={`cursor-pointer rounded-md px-3 text-xs font-semibold capitalize transition-colors duration-150 ${
                            plan.status === s
                              ? s === "final"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-700 text-white"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label>Notes</Label>
                    <textarea
                      value={plan.notes ?? ""}
                      onChange={(e) => setField("notes", e.target.value)}
                      rows={2}
                      placeholder="Cues, reminders, anything the team should know"
                      className={`${inputClass} h-auto min-h-16 resize-y py-2`}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-900">Order of service</h2>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                    {formatDuration(total)}
                  </span>
                </div>

                {plan.items.length === 0 && (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <Music className="h-6 w-6 text-indigo-500" aria-hidden />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">Nothing planned yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Add songs, prayers, the sermon and everything in between below.
                    </p>
                  </div>
                )}

                <ol>
                  {plan.items.map((it, index) => {
                    const Icon = TYPE_ICONS[it.type] ?? Cross;
                    return (
                      <li
                        key={it._key}
                        className="flex gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0"
                      >
                        <div className="flex flex-col items-center gap-0.5 pt-0.5">
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => moveItem(index, -1)}
                            className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={index === plan.items.length - 1}
                            onClick={() => moveItem(index, 1)}
                            className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <select
                              aria-label="Item type"
                              value={it.type}
                              onChange={(e) => updateItem(it._key, { type: e.target.value as ItemType })}
                              className={`${selectClass} w-36 shrink-0`}
                            >
                              {ITEM_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {ITEM_TYPE_LABELS[t]}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label="Item title"
                              value={it.title}
                              onChange={(e) => updateItem(it._key, { title: e.target.value })}
                              placeholder="Title"
                              className={`${inputClass} min-w-40 flex-1 font-semibold`}
                            />
                            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                              <input
                                type="number"
                                min={0}
                                max={600}
                                aria-label="Duration in minutes"
                                value={it.durationMin}
                                onChange={(e) =>
                                  updateItem(it._key, { durationMin: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className={`${inputClass} w-20 text-right`}
                              />
                              min
                            </label>
                            <button
                              type="button"
                              aria-label={`Remove ${it.title}`}
                              onClick={() => commitItems(plan.items.filter((x) => x._key !== it._key))}
                              className="cursor-pointer rounded-lg p-2 text-slate-300 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              aria-label="Detail"
                              value={it.detail ?? ""}
                              onChange={(e) => updateItem(it._key, { detail: e.target.value })}
                              placeholder={
                                it.type === "song"
                                  ? "Key, arrangement…"
                                  : it.type === "scripture"
                                    ? "Reference"
                                    : "Notes"
                              }
                              className={`${inputClass} min-w-40 flex-1`}
                            />
                            <OwnerPicker
                              item={it}
                              onChange={(p) =>
                                updateItem(it._key, {
                                  owner: p?._id ?? null,
                                  ownerName: p?.name ?? "",
                                  ownerMemberNo: p?.memberNo ?? "",
                                  ownerPhotoUrl: p?.photoUrl ?? "",
                                })
                              }
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <form
                  onSubmit={addItem}
                  className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <select
                    aria-label="New item type"
                    value={newItem.type}
                    onChange={(e) => setNewItem((n) => ({ ...n, type: e.target.value as ItemType }))}
                    className={`${selectClass} w-36 shrink-0`}
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ITEM_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="New item title"
                    value={newItem.title}
                    onChange={(e) => setNewItem((n) => ({ ...n, title: e.target.value }))}
                    placeholder={`Add ${ITEM_TYPE_LABELS[newItem.type].toLowerCase()}…`}
                    className={`${inputClass} min-w-40 flex-1`}
                  />
                  <Button type="submit" className="h-9">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add item
                  </Button>
                </form>
              </div>
            </div>

            {/* ---------- RIGHT: volunteers ---------- */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-900">Volunteers</h2>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden />
                    {confirmed}/{filled.length} confirmed
                  </span>
                </div>

                {teams.length === 0 && orphans.length === 0 && (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                      <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">No teams yet</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">
                      Create teams with roles under Services → Teams and they will
                      appear here as slots to fill.
                    </p>
                    <Link
                      href="/dashboard/services?tab=teams"
                      className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Go to Teams →
                    </Link>
                  </div>
                )}

                {sections.map(({ team, rows }) => (
                  <section key={team._id} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{team.name}</h3>
                      {team.leaderName && (
                        <span className="text-xs text-slate-400">Led by {team.leaderName}</span>
                      )}
                    </div>
                    {rows.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">
                        No roles on this team — add a slot below.
                      </p>
                    )}
                    <div className="mt-1 divide-y divide-slate-50">
                      {rows.map(({ role, slot }, i) => (
                        <SlotRow
                          key={slot?._key ?? `${role}-${i}`}
                          team={team}
                          role={role}
                          slot={slot}
                          statusBusy={statusBusy === slot?._key}
                          onAssign={(p) => assignSlot(team, team._id, role, slot, p)}
                          onStatus={(s) => slot && setSlotStatus(slot, s)}
                          onClear={() => slot && clearSlot(team, slot)}
                        />
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addSlot(team);
                      }}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input
                        aria-label={`New slot role for ${team.name}`}
                        value={newSlotRole[team._id] ?? ""}
                        onChange={(e) => setNewSlotRole((r) => ({ ...r, [team._id]: e.target.value }))}
                        placeholder="Add slot — e.g. Second vocals"
                        list={`roles-${team._id}`}
                        className={`${inputClass} h-8 flex-1 text-xs`}
                      />
                      <datalist id={`roles-${team._id}`}>
                        {team.roles.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                      <button
                        type="submit"
                        disabled={!(newSlotRole[team._id] ?? "").trim()}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add slot
                      </button>
                    </form>
                  </section>
                ))}

                {orphans.length > 0 && (
                  <section className="border-b border-slate-100 px-5 py-4 last:border-b-0">
                    <h3 className="font-semibold text-slate-900">Other</h3>
                    <p className="text-xs text-slate-400">Slots from teams that no longer exist.</p>
                    <div className="mt-1 divide-y divide-slate-50">
                      {orphans.map((slot) => (
                        <SlotRow
                          key={slot._key}
                          team={null}
                          role={`${slot.teamName ? `${slot.teamName} · ` : ""}${slot.role}`}
                          slot={slot}
                          statusBusy={statusBusy === slot._key}
                          onAssign={(p) => assignSlot(null, slot.team, slot.role, slot, p)}
                          onStatus={(s) => setSlotStatus(slot, s)}
                          onClear={() =>
                            commitVolunteers(plan.volunteers.filter((v) => v._key !== slot._key))
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this plan?"
        message={`${plan?.title ?? "This plan"} on ${formatDate(plan?.date)} will move to the Recycle Bin, including its order of service and volunteer roster.`}
      />
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100"
      >
        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
        Not saved — retry
      </button>
    );
  }
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        state === "saved"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {state === "saving" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : state === "saved" ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Clock className="h-3.5 w-3.5" aria-hidden />
      )}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Unsaved changes"}
    </span>
  );
}
