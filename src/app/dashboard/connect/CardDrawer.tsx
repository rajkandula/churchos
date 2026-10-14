"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { api, formatDate, formatDateTime } from "@/lib/client-api";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { CardFields, cardToForm, type CardFormState } from "./CardFields";
import {
  AGE_GROUP_LABELS,
  CONNECT_STATUSES,
  CONNECT_STATUS_LABELS,
  FOLLOW_UP_METHODS,
  FOLLOW_UP_METHOD_LABELS,
  STATUS_STYLES,
  daysSince,
  type Assignee,
  type ConnectCardDto,
  type FollowUpDto,
} from "./types";

const selectClass =
  "h-9 cursor-pointer rounded-xl border bg-white px-3 text-xs font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

/** Full card: details, follow-up timeline, assign, edit, convert, delete.
 *  The parent keys this by card id, so transient state resets per card. */
export function CardDrawer({
  card,
  onClose,
  onChanged,
  onDeleted,
  assignees,
}: {
  card: ConnectCardDto | null;
  onClose: () => void;
  onChanged: (card: ConnectCardDto) => void;
  onDeleted: (id: string) => void;
  assignees: Assignee[];
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const [fuMethod, setFuMethod] = useState<string>("call");
  const [fuNote, setFuNote] = useState("");
  const [removingFu, setRemovingFu] = useState<FollowUpDto | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CardFormState | null>(() =>
    card ? cardToForm(card) : null
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!card) return null;

  async function patch(json: Record<string, unknown>, label: string) {
    if (!card) return;
    setBusy(label);
    try {
      const { card: next } = await api<{ card: ConnectCardDto }>(
        `/api/connect/${card._id}`,
        { method: "PATCH", json }
      );
      onChanged(next);
      return next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const next = await patch({ ...form }, "edit");
    if (next) {
      toast.success("Card updated.");
      setEditing(false);
    }
  }

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    setBusy("followup");
    try {
      const { card: next } = await api<{ card: ConnectCardDto }>(
        `/api/connect/${card._id}/follow-ups`,
        { method: "POST", json: { method: fuMethod, note: fuNote } }
      );
      onChanged(next);
      setFuNote("");
      toast.success("Follow-up logged.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log follow-up.");
    } finally {
      setBusy(null);
    }
  }

  async function removeFollowUp() {
    if (!card || !removingFu) return;
    setBusy("removefu");
    try {
      const { card: next } = await api<{ card: ConnectCardDto }>(
        `/api/connect/${card._id}/follow-ups`,
        { method: "DELETE", json: { followUpId: removingFu._id } }
      );
      onChanged(next);
      setRemovingFu(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(null);
    }
  }

  async function convert() {
    if (!card) return;
    setBusy("convert");
    try {
      const { personId } = await api<{ personId: string }>(
        `/api/connect/${card._id}/convert`,
        { method: "POST" }
      );
      onChanged({
        ...card,
        linkedPerson: personId,
        status: card.status === "joined" ? card.status : "joined",
      });
      toast.success(`${card.name} added to People — open the profile from this card.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add to People.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!card) return;
    setBusy("delete");
    try {
      await api(`/api/connect/${card._id}`, { method: "DELETE" });
      toast.success(`Deleted ${card.name}'s card — it's in the Recycle Bin.`);
      setConfirmDelete(false);
      onDeleted(card._id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  }

  const days = daysSince(card.visitDate);
  const followUps = [...card.followUps].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <>
      <Drawer
        open={Boolean(card)}
        onClose={onClose}
        title={card.name}
        subtitle={`Visited ${formatDate(card.visitDate)} · ${
          days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`
        } · ${card.source === "public" ? "via QR / link" : "added by staff"}`}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
            {card.linkedPerson ? (
              <Link
                href={`/dashboard/people/${card.linkedPerson}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition-colors duration-200 hover:bg-emerald-100"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                View in People
              </Link>
            ) : (
              <Button onClick={convert} loading={busy === "convert"} disabled={busy !== null}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Add to People
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-7">
          {/* Pipeline controls */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Status
              <select
                value={card.status}
                onChange={(e) => patch({ status: e.target.value }, "status")}
                disabled={busy !== null}
                className={`${selectClass} ${STATUS_STYLES[card.status]}`}
              >
                {CONNECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONNECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Assigned to
              <select
                value={card.assignedTo ?? ""}
                onChange={(e) => patch({ assignedTo: e.target.value }, "assign")}
                disabled={busy !== null}
                className={`${selectClass} border-slate-200 text-slate-700`}
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
                {card.assignedTo &&
                  !assignees.some((a) => a._id === card.assignedTo) && (
                    <option value={card.assignedTo}>{card.assignedToName}</option>
                  )}
              </select>
            </label>
          </div>

          {card.linkedPerson && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span>This visitor is now in People.</span>
              <Link
                href={`/dashboard/people/${card.linkedPerson}`}
                className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
              >
                Open profile
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          )}

          {/* Details */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Details</SectionTitle>
              <button
                type="button"
                onClick={() => {
                  setForm(cardToForm(card));
                  setEditing((v) => !v);
                }}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                {editing ? "Cancel edit" : "Edit details"}
                {editing ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>

            {editing && form ? (
              <form onSubmit={saveEdits} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <CardFields
                  form={form}
                  onChange={(p) => setForm((f) => (f ? { ...f, ...p } : f))}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditing(false)}
                    disabled={busy === "edit"}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={busy === "edit"}>
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Avatar name={card.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{card.name}</p>
                    <p className="text-xs text-slate-500">
                      {card.firstTime ? "First-time visitor" : "Has visited before"}
                      {card.ageGroup ? ` · ${AGE_GROUP_LABELS[card.ageGroup]}` : ""}
                      {card.howHeard ? ` · ${card.howHeard}` : ""}
                    </p>
                  </div>
                </div>
                <dl className="grid gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    {card.phone ? (
                      <a href={`tel:${card.phone}`} className="hover:text-indigo-600">
                        {card.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">No phone</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    {card.email ? (
                      <a href={`mailto:${card.email}`} className="truncate hover:text-indigo-600">
                        {card.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">No email</span>
                    )}
                  </div>
                  {(card.address || card.city) && (
                    <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      {[card.address, card.city].filter(Boolean).join(", ")}
                    </div>
                  )}
                </dl>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Interested in</p>
                  {card.interests.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {card.interests.map((i) => (
                        <span
                          key={i}
                          className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
                        >
                          {i}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-400">Nothing ticked</p>
                  )}
                </div>
                {card.prayerRequest && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700">Prayer request</p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
                      {card.prayerRequest}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Follow-ups */}
          <section className="space-y-4">
            <SectionTitle>Follow-ups ({followUps.length})</SectionTitle>

            <form
              onSubmit={addFollowUp}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <SelectField
                label="How did you reach out?"
                value={fuMethod}
                onChange={(e) => setFuMethod(e.target.value)}
                options={FOLLOW_UP_METHODS.map((m) => ({
                  value: m,
                  label: FOLLOW_UP_METHOD_LABELS[m],
                }))}
              />
              <TextAreaField
                label="Note"
                value={fuNote}
                onChange={(e) => setFuNote(e.target.value)}
                placeholder="e.g. Spoke to her, she'll join the Sunday small group."
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={busy === "followup"} disabled={busy !== null && busy !== "followup"}>
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  Log follow-up
                </Button>
              </div>
            </form>

            {followUps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                No follow-ups yet — log your first call or message above.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {followUps.map((f) => (
                  <li key={f._id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-200" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {FOLLOW_UP_METHOD_LABELS[f.method] ?? f.method}
                          <span className="font-normal text-slate-500"> · {f.by || "—"}</span>
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(f.at)}</p>
                        {f.note && (
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {f.note}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Remove follow-up"
                        onClick={() => setRemovingFu(f)}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy === "delete"}
        title="Delete this connect card?"
        message={`${card.name}'s card and its follow-up history will move to the Recycle Bin.${
          card.linkedPerson ? " Their People record stays." : ""
        }`}
      />
      <ConfirmDialog
        open={Boolean(removingFu)}
        onClose={() => setRemovingFu(null)}
        onConfirm={removeFollowUp}
        loading={busy === "removefu"}
        title="Remove this follow-up?"
        message="The entry will be removed from the timeline. This cannot be undone."
        confirmLabel="Remove"
      />
    </>
  );
}
