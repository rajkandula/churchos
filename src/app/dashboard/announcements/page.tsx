"use client";

import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { AnnouncementList } from "./AnnouncementList";
import { Composer } from "./Composer";
import {
  describeSendTime,
  HISTORY_TABS,
  tabFor,
  type AnnouncementDto,
  type AnnouncementOptions,
  type HistoryTab,
  type SendResult,
} from "./types";

type RowAction = { kind: "delete" | "cancel" | "send-now"; row: AnnouncementDto };

export default function AnnouncementsPage() {
  const toast = useToast();

  const [history, setHistory] = useState<AnnouncementDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [options, setOptions] = useState<AnnouncementOptions | null>(null);

  const [tab, setTab] = useState<HistoryTab>("sent");
  const [editing, setEditing] = useState<AnnouncementDto | null>(null);
  // Bumping this remounts the composer, so its fields start from `editing`
  // through useState initialisers rather than being synced in an effect.
  const [composerKey, setComposerKey] = useState(0);

  const [mailNote, setMailNote] = useState("");
  const [pending, setPending] = useState<RowAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The composer reports whether it holds unsaved work; remounting it would
  // throw that away, so the two user-initiated remounts ask first.
  // undefined = nothing pending, null = "clear the composer", row = "edit that".
  const dirtyRef = useRef(false);
  const [pendingDiscard, setPendingDiscard] = useState<
    AnnouncementDto | null | undefined
  >(undefined);

  // Promise-chain loaders: every setState lands in a .then/.catch callback.
  const loadHistory = useCallback(() => {
    api<{ announcements: AnnouncementDto[] }>("/api/announcements")
      .then((data) => {
        setHistory(data.announcements);
        setLoadError("");
      })
      .catch((err) => {
        setHistory([]);
        setLoadError(err instanceof Error ? err.message : "Could not load announcements.");
      });
  }, []);

  const loadOptions = useCallback(() => {
    api<AnnouncementOptions>("/api/announcements/options")
      .then(setOptions)
      .catch(() => {
        /* the pickers simply stay empty */
      });
  }, []);

  useEffect(() => {
    loadHistory();
    loadOptions();
  }, [loadHistory, loadOptions]);

  const buckets = useMemo(() => {
    const out: Record<HistoryTab, AnnouncementDto[]> = { sent: [], scheduled: [], drafts: [] };
    for (const a of history ?? []) out[tabFor(a.state)].push(a);
    return out;
  }, [history]);

  function applyEdit(a: AnnouncementDto) {
    setEditing(a);
    setComposerKey((n) => n + 1);
    setMailNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetComposer() {
    setEditing(null);
    setComposerKey((n) => n + 1);
  }

  // Both remounts the user asks for; a completed save calls the raw versions,
  // since there is nothing left to lose by then.
  function startEdit(a: AnnouncementDto) {
    if (dirtyRef.current) {
      setPendingDiscard(a);
      return;
    }
    applyEdit(a);
  }

  function requestReset() {
    if (dirtyRef.current) {
      setPendingDiscard(null);
      return;
    }
    resetComposer();
  }

  function onSaved(result: SendResult) {
    setMailNote(
      result.warning ??
        (result.mailUnavailable
          ? "Email sending is not set up on this server — the announcement was saved but not emailed."
          : "")
    );
    setTab(tabFor(result.announcement.state));
    resetComposer();
    loadHistory();
  }

  function runPending() {
    if (!pending) return;
    const { kind, row } = pending;
    setBusyId(row._id);

    const request =
      kind === "delete"
        ? api(`/api/announcements/${row._id}`, { method: "DELETE" })
        : api<SendResult>(`/api/announcements/${row._id}`, {
            method: "PATCH",
            json: { action: kind === "cancel" ? "cancel" : "send-now" },
          });

    request
      .then((res) => {
        setBusyId(null);
        setPending(null);
        if (kind === "delete") {
          toast.success(`Deleted "${row.title}" — it's in the Recycle Bin.`);
        } else if (kind === "cancel") {
          toast.success(`Cancelled "${row.title}". Nothing will go out.`);
        } else {
          const result = res as SendResult;
          if (result?.mailUnavailable) {
            setMailNote(
              result.warning ??
                "Email sending is not set up on this server — the announcement was saved but not emailed."
            );
            toast.success("Saved. Emails go out once mail is set up on this server.");
          } else if (result?.warning) {
            // The dispatch failed — nothing went out. Never call that a send.
            setMailNote(result.warning);
            toast.error(result.warning);
          } else {
            const a = result?.announcement;
            toast.success(
              `Sent "${row.title}" to ${a?.sentTo ?? 0} ${
                a?.sentTo === 1 ? "person" : "people"
              }.`
            );
          }
          // Land on the tab the row is actually in: it stays a draft when mail
          // is unavailable, and becomes "failed" (Scheduled tab) on a failure.
          setTab(tabFor(result?.announcement?.state ?? "sent"));
        }
        if (editing && editing._id === row._id) resetComposer();
        loadHistory();
      })
      .catch((err) => {
        setBusyId(null);
        toast.error(err instanceof Error ? err.message : "That didn't work. Please try again.");
      });
  }

  const sentCount = buckets.sent.length;
  const totalEmails = history?.reduce((n, a) => n + (a.sentTo ?? 0), 0) ?? 0;

  const confirmCopy: Record<RowAction["kind"], { title: string; label: string }> = {
    delete: { title: "Delete this announcement?", label: "Delete" },
    cancel: { title: "Cancel this scheduled send?", label: "Cancel send" },
    "send-now": { title: "Send this announcement now?", label: "Send now" },
  };

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Announcements</h1>
        <p className="mt-1.5 text-slate-500">
          Start from a template, see the real email, and send it now or line it up for later —{" "}
          {history ? `${sentCount} sent, ${totalEmails} emails delivered so far.` : "…"}
        </p>
      </div>

      {mailNote && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{mailNote}</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Composer
          key={composerKey}
          initial={editing}
          options={options}
          onSaved={onSaved}
          onCancelEdit={requestReset}
          dirtyRef={dirtyRef}
        />

        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-labelledby="history-heading"
        >
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 id="history-heading" className="text-lg font-bold text-slate-900">
              History
            </h2>
            <p className="text-sm text-slate-500">
              {history ? `${history.length} on record` : "Loading…"}
            </p>
            <div className="mt-3 overflow-x-auto">
              <Tabs
                value={tab}
                onChange={(v) => setTab(v as HistoryTab)}
                tabs={HISTORY_TABS.map((t) => ({
                  value: t.value,
                  label: history ? `${t.label} (${buckets[t.value].length})` : t.label,
                }))}
              />
            </div>
          </div>

          <AnnouncementList
            tab={tab}
            items={history === null ? null : buckets[tab]}
            loadError={loadError}
            busyId={busyId}
            editingId={editing?._id ?? null}
            onEdit={startEdit}
            onDelete={(row) => setPending({ kind: "delete", row })}
            onSendNow={(row) => setPending({ kind: "send-now", row })}
            onCancel={(row) => setPending({ kind: "cancel", row })}
          />
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => !busyId && setPending(null)}
        onConfirm={runPending}
        loading={Boolean(busyId)}
        title={pending ? confirmCopy[pending.kind].title : ""}
        confirmLabel={pending ? confirmCopy[pending.kind].label : "OK"}
        message={
          !pending
            ? ""
            : pending.kind === "delete"
              ? `"${pending.row.title}" will move to the Recycle Bin. Emails that already went out are not affected.`
              : pending.kind === "cancel"
                ? `"${pending.row.title}" was due ${
                    pending.row.sendAt ? describeSendTime(pending.row.sendAt) : "soon"
                  }. Nothing will be emailed — you can reschedule it later.`
                : `"${pending.row.title}" will be emailed straight away to ${pending.row.recipients} matched ${
                    pending.row.recipients === 1 ? "person" : "people"
                  }. This can't be undone.`
        }
      />

      <ConfirmDialog
        open={pendingDiscard !== undefined}
        onClose={() => setPendingDiscard(undefined)}
        onConfirm={() => {
          const next = pendingDiscard;
          setPendingDiscard(undefined);
          if (next) applyEdit(next);
          else resetComposer();
        }}
        title="Discard what you've written?"
        confirmLabel="Discard"
        message={
          pendingDiscard
            ? `The composer will be replaced with "${pendingDiscard.title}". Your unsaved message will be lost.`
            : "Your unsaved message will be lost."
        }
      />
    </div>
  );
}
