"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import { EventDrawer } from "../EventDrawer";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUS_STYLES,
  formatEventRange,
  type EventDto,
  type EventStats,
  type RegistrationDto,
} from "../types";

const emptyStats: EventStats = {
  registered: 0,
  waitlisted: 0,
  attended: 0,
  cancelled: 0,
  registeredCount: 0,
  spotsLeft: null,
};

function StatTile({
  label,
  value,
  tint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tint: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      </div>
    </div>
  );
}

const emptyRegForm = { name: "", phone: "", email: "", guests: "0", notes: "", status: "registered" };

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [event, setEvent] = useState<EventDto | null>(null);
  const [stats, setStats] = useState<EventStats>(emptyStats);
  const [registrations, setRegistrations] = useState<RegistrationDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [copying, setCopying] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"person" | "text">("person");
  const [picked, setPicked] = useState<PickedPerson | null>(null);
  const [regForm, setRegForm] = useState(emptyRegForm);
  const [addBusy, setAddBusy] = useState(false);

  const [deletingReg, setDeletingReg] = useState<RegistrationDto | null>(null);
  const [deleteRegBusy, setDeleteRegBusy] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    api<{ church: { currency?: string } }>("/api/settings/church")
      .then((d) => setCurrency(d.church.currency || "INR"))
      .catch(() => {
        /* default currency is fine */
      });
  }, []);

  // Promise-chained (not async/await) so no setState runs synchronously
  // inside the effect that calls it.
  const load = useCallback(() => {
    return Promise.all([
      api<{ event: EventDto; stats: EventStats }>(`/api/events/${id}`),
      api<{ registrations: RegistrationDto[]; stats: EventStats }>(
        `/api/events/${id}/registrations`
      ),
    ])
      .then(([e, r]) => {
        setEvent(e.event);
        setStats(r.stats);
        setRegistrations(r.registrations);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load this event.");
        setRegistrations([]);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink() {
    setCopying(true);
    try {
      const { url } = await api<{ url: string }>(`/api/events/${id}/share-link`);
      await navigator.clipboard.writeText(url);
      toast.success("Public registration link copied.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy the link.");
    } finally {
      setCopying(false);
    }
  }

  async function onDeleteEvent() {
    setDeleteBusy(true);
    try {
      await api(`/api/events/${id}`, { method: "DELETE" });
      toast.success("Event deleted — it's in the Recycle Bin with its registrations.");
      router.push("/dashboard/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
      setDeleteBusy(false);
    }
  }

  function openAdd() {
    setAddMode("person");
    setPicked(null);
    setRegForm(emptyRegForm);
    setAddOpen(true);
  }

  async function onAddRegistration(e: React.FormEvent) {
    e.preventDefault();
    if (addMode === "person" && !picked) {
      toast.error("Pick a person, or switch to free text.");
      return;
    }
    setAddBusy(true);
    try {
      const data = await api<{ registration: RegistrationDto; stats: EventStats }>(
        `/api/events/${id}/registrations`,
        {
          method: "POST",
          json: {
            person: addMode === "person" ? picked?._id : "",
            name: addMode === "person" ? "" : regForm.name,
            phone: addMode === "person" ? "" : regForm.phone,
            email: addMode === "person" ? "" : regForm.email,
            guests: regForm.guests,
            notes: regForm.notes,
            status: regForm.status,
          },
        }
      );
      setRegistrations((cur) => [data.registration, ...(cur ?? [])]);
      setStats(data.stats);
      setEvent((ev) =>
        ev ? { ...ev, registeredCount: data.stats.registeredCount, spotsLeft: data.stats.spotsLeft } : ev
      );
      toast.success(`${data.registration.name} registered.`);
      setAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add registration.");
    } finally {
      setAddBusy(false);
    }
  }

  async function changeRegStatus(reg: RegistrationDto, status: string) {
    const prev = registrations;
    setRegistrations(
      (cur) =>
        cur?.map((r) =>
          r._id === reg._id ? { ...r, status: status as RegistrationDto["status"] } : r
        ) ?? null
    );
    try {
      const data = await api<{ registration: RegistrationDto; stats: EventStats }>(
        `/api/events/${id}/registrations/${reg._id}`,
        { method: "PATCH", json: { status } }
      );
      setStats(data.stats);
      setEvent((ev) =>
        ev ? { ...ev, registeredCount: data.stats.registeredCount, spotsLeft: data.stats.spotsLeft } : ev
      );
    } catch (err) {
      setRegistrations(prev ?? null);
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  async function convertToPerson(reg: RegistrationDto) {
    setConvertingId(reg._id);
    try {
      const data = await api<{
        registration: RegistrationDto;
        person: { _id: string; name: string; memberNo: string };
      }>(`/api/events/${id}/registrations/${reg._id}`, {
        method: "PATCH",
        json: { action: "createPerson" },
      });
      setRegistrations(
        (cur) => cur?.map((r) => (r._id === reg._id ? data.registration : r)) ?? null
      );
      toast.success(`${data.person.name} added to People as ${data.person.memberNo}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add to People.");
    } finally {
      setConvertingId(null);
    }
  }

  async function onDeleteReg() {
    if (!deletingReg) return;
    setDeleteRegBusy(true);
    try {
      const data = await api<{ ok: true; stats: EventStats }>(
        `/api/events/${id}/registrations/${deletingReg._id}`,
        { method: "DELETE" }
      );
      setRegistrations((cur) => cur?.filter((r) => r._id !== deletingReg._id) ?? null);
      setStats(data.stats);
      setEvent((ev) =>
        ev ? { ...ev, registeredCount: data.stats.registeredCount, spotsLeft: data.stats.spotsLeft } : ev
      );
      toast.success(`Removed ${deletingReg.name} — it's in the Recycle Bin.`);
      setDeletingReg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteRegBusy(false);
    }
  }

  const setReg =
    (key: keyof typeof emptyRegForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setRegForm((f) => ({ ...f, [key]: e.target.value }));

  const cap = event?.capacity ?? null;
  const pct =
    event && cap ? Math.min(100, Math.round((event.registeredCount / cap) * 100)) : null;

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Events
      </Link>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {!event && !loadError && (
        <div className="mt-4 space-y-3">
          <div className="h-8 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      {event && (
        <>
          {/* Header */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {event.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverUrl} alt="" className="h-48 w-full object-cover sm:h-56" />
            ) : (
              <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600">
                <CalendarDays className="h-10 w-10 text-white/60" aria-hidden />
              </div>
            )}
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                      {event.title}
                    </h1>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${EVENT_STATUS_STYLES[event.status]}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                    {!event.registrationOpen && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-500/20 ring-inset">
                        Registration closed
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                      {formatEventRange(event.startAt, event.endAt)}
                    </span>
                    {event.venue && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                        {event.venue}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-slate-400" aria-hidden />
                      {event.fee > 0 ? formatMoney(event.fee, currency) : "Free"}
                    </span>
                    {event.organizerName && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-slate-400" aria-hidden />
                        {event.organizer ? (
                          <Link
                            href={`/dashboard/people/${event.organizer}`}
                            className="font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {event.organizerName}
                          </Link>
                        ) : (
                          event.organizerName
                        )}
                      </span>
                    )}
                  </div>
                  {(event.tags?.length ?? 0) > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {event.tags!.map((t) => (
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
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={copyLink} loading={copying}>
                    <Link2 className="h-4 w-4" aria-hidden />
                    Copy public link
                  </Button>
                  <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </Button>
                </div>
              </div>

              {event.description && (
                <p className="mt-5 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-slate-600">
                  {event.description}
                </p>
              )}

              {pct !== null && (
                <div className="mt-5 max-w-md">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>
                      {event.registeredCount} of {cap} seats taken
                    </span>
                    <span className={event.spotsLeft === 0 ? "text-rose-600" : "text-slate-400"}>
                      {event.spotsLeft === 0 ? "Full" : `${event.spotsLeft} left`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        event.spotsLeft === 0
                          ? "bg-rose-500"
                          : "bg-gradient-to-r from-indigo-500 to-violet-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stat tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Registered"
              value={stats.registered}
              tint="bg-sky-50 text-sky-600"
              icon={Users}
            />
            <StatTile
              label="Waitlisted"
              value={stats.waitlisted}
              tint="bg-amber-50 text-amber-600"
              icon={Clock}
            />
            <StatTile
              label="Attended"
              value={stats.attended}
              tint="bg-emerald-50 text-emerald-600"
              icon={CheckCircle2}
            />
            <StatTile
              label="Spots left"
              value={stats.spotsLeft === null ? "∞" : stats.spotsLeft}
              tint="bg-indigo-50 text-indigo-600"
              icon={CalendarDays}
            />
          </div>

          {/* Registrations */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              Registrations
              {registrations && (
                <span className="ml-2 text-sm font-medium text-slate-400">
                  {registrations.length}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => window.open(`/api/events/${id}/registrations/export`, "_blank")}
                disabled={!registrations?.length}
              >
                <Download className="h-4 w-4" aria-hidden />
                Export CSV
              </Button>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" aria-hidden />
                Add registration
              </Button>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Phone</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Guests</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Source</th>
                    <th className="px-4 py-3.5">Registered</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations === null &&
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}

                  {registrations?.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center px-6 py-14 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                            <UserPlus className="h-6 w-6 text-indigo-500" aria-hidden />
                          </div>
                          <p className="mt-3 font-semibold text-slate-900">No registrations yet</p>
                          <p className="mt-1 max-w-sm text-sm text-slate-500">
                            Copy the public link and share it, or add people yourself.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {registrations?.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3.5">
                        {r.person ? (
                          <Link
                            href={`/dashboard/people/${r.person}`}
                            className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600"
                          >
                            {r.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-900">{r.name}</span>
                        )}
                        {r.notes && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400" title={r.notes}>
                            {r.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{r.phone || "—"}</td>
                      <td className="px-4 py-3.5 text-slate-700">{r.email || "—"}</td>
                      <td className="px-4 py-3.5 text-slate-700">{r.guests || 0}</td>
                      <td className="px-4 py-3.5">
                        <select
                          value={r.status}
                          onChange={(e) => changeRegStatus(r, e.target.value)}
                          aria-label={`Status of ${r.name}`}
                          className={`h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30 ${REGISTRATION_STATUS_STYLES[r.status]}`}
                        >
                          {Object.entries(REGISTRATION_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            r.source === "public"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.source === "public" ? "Public link" : "Admin"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{formatDateTime(r.registeredAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {!r.person && (
                            <button
                              type="button"
                              onClick={() => convertToPerson(r)}
                              disabled={convertingId === r._id}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 transition-colors duration-200 hover:bg-indigo-50 disabled:opacity-60"
                            >
                              <UserPlus className="h-3.5 w-3.5" aria-hidden />
                              {convertingId === r._id ? "Adding…" : "Add to People"}
                            </button>
                          )}
                          <button
                            aria-label={`Delete registration for ${r.name}`}
                            onClick={() => setDeletingReg(r)}
                            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <EventDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSaved={(saved) => {
              setEvent(saved);
              load();
            }}
            existing={event}
            currency={currency}
          />

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={onDeleteEvent}
            loading={deleteBusy}
            title="Delete this event?"
            message={`"${event.title}" and its ${registrations?.length ?? 0} registration${
              registrations?.length === 1 ? "" : "s"
            } will move to the Recycle Bin. The public link will stop working.`}
          />

          <ConfirmDialog
            open={Boolean(deletingReg)}
            onClose={() => setDeletingReg(null)}
            onConfirm={onDeleteReg}
            loading={deleteRegBusy}
            title="Remove this registration?"
            message={`${deletingReg?.name}'s registration will move to the Recycle Bin. Their People record (if any) is not affected.`}
          />

          <Modal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            title="Add registration"
            subtitle="Register someone from People, or type their details."
          >
            <form onSubmit={onAddRegistration} className="space-y-4">
              <div
                role="tablist"
                className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
              >
                {(
                  [
                    ["person", "From People"],
                    ["text", "Free text"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={addMode === value}
                    onClick={() => setAddMode(value)}
                    className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                      addMode === value
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {addMode === "person" ? (
                <PersonPicker value={picked} onChange={setPicked} />
              ) : (
                <>
                  <TextField
                    label="Name"
                    required
                    value={regForm.name}
                    onChange={setReg("name")}
                    placeholder="Full name"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Phone"
                      inputMode="tel"
                      value={regForm.phone}
                      onChange={setReg("phone")}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={regForm.email}
                      onChange={setReg("email")}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Extra guests"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={50}
                  value={regForm.guests}
                  onChange={setReg("guests")}
                />
                <SelectField
                  label="Status"
                  options={Object.entries(REGISTRATION_STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={regForm.status}
                  onChange={setReg("status")}
                />
              </div>
              <TextAreaField
                label="Notes"
                value={regForm.notes}
                onChange={setReg("notes")}
                placeholder="Dietary needs, transport, anything to remember…"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={addBusy}>
                  Add registration
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
