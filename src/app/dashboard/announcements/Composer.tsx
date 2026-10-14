"use client";

import {
  Bookmark,
  CalendarClock,
  Eye,
  Link2,
  Loader2,
  Megaphone,
  Pencil,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { api } from "@/lib/client-api";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { EMAIL_THEMES } from "@/lib/email-render";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { EmailPreview } from "./EmailPreview";
import { SaveTemplateModal } from "./SaveTemplateModal";
import { TemplatePicker } from "./TemplatePicker";
import {
  AUDIENCE_OPTIONS,
  audienceLabel,
  defaultScheduleValue,
  describeSendTime,
  isValidLinkUrl,
  toDateTimeLocalInput,
  type AnnouncementDto,
  type AnnouncementOptions,
  type AudiencePreview,
  type AudienceType,
  type EmailTheme,
  type RenderResult,
  type SendResult,
  type Template,
} from "./types";

const selectClass =
  "h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

type WhenMode = "now" | "later";
type Confirming = "send" | "schedule" | "replace";

export function Composer({
  initial,
  options,
  onSaved,
  onCancelEdit,
  dirtyRef,
}: {
  /** A draft / scheduled row being edited, or null for a fresh message. */
  initial: AnnouncementDto | null;
  options: AnnouncementOptions | null;
  onSaved: (result: SendResult) => void;
  onCancelEdit: () => void;
  /** Set to true while this composer holds work that a remount would lose. */
  dirtyRef?: RefObject<boolean>;
}) {
  const toast = useToast();
  const editing = initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? "");
  const [theme, setTheme] = useState<EmailTheme>(initial?.theme ?? "classic");

  const [audienceType, setAudienceType] = useState<AudienceType>(
    initial?.audienceType ?? "all"
  );
  const [status, setStatus] = useState(initial?.status ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");

  // A row that already had a time — scheduled, or cancelled and being
  // rescheduled — reopens on "Schedule for later".
  const [whenMode, setWhenMode] = useState<WhenMode>(initial?.sendAt ? "later" : "now");
  // Empty for a fresh message: the default depends on the viewer's clock, so
  // it must never be computed during the first (server) render.
  const [sendAtInput, setSendAtInput] = useState(
    initial?.sendAt ? toDateTimeLocalInput(initial.sendAt) : ""
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ template: Template | null } | null>(
    null
  );
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [busy, setBusy] = useState(false);

  /* ---------------------------------------------------------------- audience */

  // Only complete once the chosen picker has a value.
  const audiencePayload = useMemo(() => {
    if (audienceType === "status" && !status) return null;
    if (audienceType === "tag" && !tag) return null;
    if (audienceType === "group" && !group) return null;
    return { audienceType, status, tag, group };
  }, [audienceType, status, tag, group]);

  // Keyed by the payload it answers, so a stale count for a previous audience
  // is never shown and "busy" is derived rather than set.
  const [audienceState, setAudienceState] = useState<{
    key: string;
    data: AudiencePreview | null;
    error: string;
  }>({ key: "", data: null, error: "" });

  const audienceKey = audiencePayload ? JSON.stringify(audiencePayload) : "";

  useEffect(() => {
    if (!audiencePayload || !audienceKey) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api<AudiencePreview>("/api/announcements/preview", {
        method: "POST",
        json: audiencePayload,
      })
        .then((data) => {
          if (!cancelled) setAudienceState({ key: audienceKey, data, error: "" });
        })
        .catch((err) => {
          if (!cancelled)
            setAudienceState({
              key: audienceKey,
              data: null,
              error: err instanceof Error ? err.message : "Could not preview the audience.",
            });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audiencePayload, audienceKey]);

  const audienceCurrent = audienceState.key === audienceKey;
  const preview = audienceKey && audienceCurrent ? audienceState.data : null;
  const previewError = audienceKey && audienceCurrent ? audienceState.error : "";
  const previewBusy = Boolean(audienceKey) && !audienceCurrent;

  /* ----------------------------------------------------------------- design */

  const themeHint = EMAIL_THEMES.find((t) => t.value === theme)?.hint ?? "";

  const ctaUrlValid = isValidLinkUrl(ctaUrl);
  const ctaComplete =
    (!ctaLabel.trim() && !ctaUrl.trim()) ||
    (Boolean(ctaLabel.trim()) && Boolean(ctaUrl.trim()) && ctaUrlValid);

  const renderPayload = useMemo(
    () => ({
      title: title.trim(),
      body,
      ctaLabel: ctaUrlValid ? ctaLabel.trim() : "",
      ctaUrl: ctaUrlValid ? ctaUrl.trim() : "",
      theme,
    }),
    [title, body, ctaLabel, ctaUrl, ctaUrlValid, theme]
  );
  const hasDraftContent = Boolean(title.trim() || body.trim());

  // Work a remount would throw away: a fresh message with anything in it, or
  // an edit that has moved away from the row it started from. Reported by ref,
  // never by setState, so the parent can read it without re-rendering us.
  const isDirty = editing
    ? title !== (initial?.title ?? "") ||
      body !== (initial?.body ?? "") ||
      ctaLabel !== (initial?.ctaLabel ?? "") ||
      ctaUrl !== (initial?.ctaUrl ?? "") ||
      theme !== (initial?.theme ?? "classic") ||
      audienceType !== (initial?.audienceType ?? "all") ||
      status !== (initial?.status ?? "") ||
      tag !== (initial?.tag ?? "") ||
      group !== (initial?.group ?? "") ||
      sendAtInput !==
        (initial?.sendAt ? toDateTimeLocalInput(initial.sendAt) : "")
    : hasDraftContent;

  useEffect(() => {
    if (dirtyRef) dirtyRef.current = isDirty;
  }, [dirtyRef, isDirty]);

  // The real email, rendered by the server with this church's branding.
  const [renderState, setRenderState] = useState<{
    key: string;
    html: string;
    error: string;
  }>({ key: "", html: "", error: "" });

  const renderKey = hasDraftContent ? JSON.stringify(renderPayload) : "";

  useEffect(() => {
    if (!renderKey) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api<RenderResult>("/api/announcements/render", {
        method: "POST",
        json: renderPayload,
      })
        .then((d) => {
          if (!cancelled) setRenderState({ key: renderKey, html: d.html, error: "" });
        })
        .catch((err) => {
          if (!cancelled)
            setRenderState({
              key: renderKey,
              html: "",
              error: err instanceof Error ? err.message : "Could not build the preview.",
            });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [renderPayload, renderKey]);

  const renderCurrent = renderState.key === renderKey;
  const html = renderKey && renderCurrent ? renderState.html : "";
  const renderError = renderKey && renderCurrent ? renderState.error : "";
  const renderBusy = Boolean(renderKey) && !renderCurrent;

  /* --------------------------------------------------------------- schedule */

  const scheduleDate = useMemo(() => {
    if (whenMode !== "later" || !sendAtInput) return null;
    const d = new Date(sendAtInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [whenMode, sendAtInput]);

  // "Now", read from the clock only in event handlers — never during render,
  // which must stay pure. Both are local "YYYY-MM-DDTHH:mm", so a plain string
  // comparison orders them correctly.
  const [minAt, setMinAt] = useState(() => toDateTimeLocalInput(new Date()));
  const readClock = () => setMinAt(toDateTimeLocalInput(new Date()));

  const schedulePast = Boolean(scheduleDate) && sendAtInput <= minAt;
  const scheduleReady = whenMode === "now" || (Boolean(scheduleDate) && !schedulePast);

  /* ------------------------------------------------------------------ gates */

  // `scheduleReady` matters here too: a chosen time now rides along on every
  // save, and the server rejects one that is invalid or already past.
  const canDraft =
    Boolean(title.trim()) && ctaComplete && scheduleReady && !busy;

  // "Save without sending" cannot turn a draft into a scheduled send — that
  // path deliberately skips the confirm dialog and the body/audience checks —
  // so when a time is picked on a row that is not already scheduled, the
  // primary button is the only way to keep it.
  const scheduleNeedsPrimary =
    whenMode === "later" && editing?.state !== "scheduled";
  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(body.trim()) &&
    Boolean(audiencePayload) &&
    ctaComplete &&
    scheduleReady &&
    !busy;

  /* -------------------------------------------------------------- templates */

  function applyTemplate(t: Template | null) {
    setTitle(t?.title ?? "");
    setBody(t?.body ?? "");
    setCtaLabel(t?.ctaLabel ?? "");
    setCtaUrl(t?.ctaUrl ?? "");
    setPendingTemplate(null);
    setConfirming(null);
    toast.success(t ? "Template loaded — edit it before sending." : "Composer cleared.");
  }

  function requestTemplate(t: Template | null) {
    setPickerOpen(false);
    if (hasDraftContent) {
      setPendingTemplate({ template: t });
      setConfirming("replace");
      return;
    }
    applyTemplate(t);
  }

  /* ----------------------------------------------------------------- saving */

  function save(kind: "send" | "draft" | "schedule") {
    // Editing an existing row PATCHes it — "send" and "schedule" map onto the
    // PATCH verbs so a draft is never duplicated. A PATCH with no action just
    // stores the edits and leaves the row where it is.
    const action = editing
      ? kind === "send"
        ? "send-now"
        : kind === "schedule"
          ? "reschedule"
          : undefined
      : kind;

    setBusy(true);
    api<SendResult>(editing ? `/api/announcements/${editing._id}` : "/api/announcements", {
      method: editing ? "PATCH" : "POST",
      json: {
        title: title.trim(),
        body,
        audienceType,
        status,
        tag,
        group,
        ctaLabel: ctaComplete ? ctaLabel.trim() : "",
        ctaUrl: ctaComplete ? ctaUrl.trim() : "",
        theme,
        ...(action ? { action } : {}),
        // Always carry a chosen time — `scheduleDate` is null unless the user
        // picked one — so editing a scheduled row's time and saving without
        // sending actually stores the new time.
        ...(scheduleDate ? { sendAt: scheduleDate.toISOString() } : {}),
      },
    })
      .then((result) => {
        setBusy(false);
        setConfirming(null);
        const a = result.announcement;
        if (kind === "draft") {
          toast.success(editing ? `Saved changes to "${a.title}".` : `Saved "${a.title}" as a draft.`);
        } else if (kind === "schedule") {
          toast.success(
            `"${a.title}" is scheduled for ${describeSendTime(a.sendAt ?? scheduleDate ?? new Date())}.`
          );
        } else if (result.mailUnavailable) {
          toast.success("Announcement saved. Emails go out once mail is set up on this server.");
        } else if (result.warning) {
          // The dispatch failed — nothing went out. Never call that a send.
          toast.error(result.warning);
        } else {
          toast.success(
            `Sent "${a.title}" to ${a.sentTo} ${a.sentTo === 1 ? "person" : "people"}${
              a.failed ? ` · ${a.failed} failed` : ""
            }.`
          );
        }
        onSaved(result);
      })
      .catch((err) => {
        setBusy(false);
        toast.error(err instanceof Error ? err.message : "Could not save the announcement.");
      });
  }

  /* ------------------------------------------------------------------- view */

  const audienceText = preview
    ? `${preview.withEmail} ${preview.withEmail === 1 ? "person" : "people"} (${audienceLabel(
        { audienceType, status, tag, groupName: preview.groupName },
        PERSON_STATUS_LABELS
      )})`
    : "everyone in the chosen audience";

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="composer-heading"
    >
      {editing && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-2xl border-b border-indigo-100 bg-indigo-50/70 px-6 py-3">
          <Pencil className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-indigo-900">
            Editing: {editing.title || "Untitled"}
          </p>
          <button
            type="button"
            onClick={onCancelEdit}
            className="cursor-pointer text-sm font-semibold text-indigo-700 underline underline-offset-2 transition-colors duration-150 hover:text-indigo-900"
          >
            Cancel edit
          </button>
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <Megaphone className="h-5 w-5 text-indigo-600" aria-hidden />
            </div>
            <div>
              <h2 id="composer-heading" className="text-lg font-bold text-slate-900">
                {editing ? "Edit announcement" : "New announcement"}
              </h2>
              <p className="text-sm text-slate-500">Goes out by email from ChurchOS.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Start from a template
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <TextField
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday service moves to 9:30 AM"
            maxLength={200}
            hint="Used as the email subject."
          />
          <TextAreaField
            label="Message"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={
              "Dear church family,\n\nStarting this Sunday…\n\nLeave a blank line between paragraphs."
            }
            className="min-h-56"
          />

          {/* Button (call to action) */}
          <fieldset>
            <legend className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
              <Link2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Button <span className="font-normal text-slate-400">(optional)</span>
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                aria-label="Button label"
                placeholder="RSVP for the picnic"
                maxLength={60}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              />
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                aria-label="Button link"
                inputMode="url"
                placeholder="https://…"
                className={`h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 ${
                  ctaUrl && !ctaUrlValid
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-500/10"
                }`}
              />
            </div>
            <p
              className={`mt-1.5 text-xs ${
                ctaComplete ? "text-slate-500" : "text-rose-600"
              }`}
            >
              {ctaUrl && !ctaUrlValid
                ? "That link doesn't look right — start it with https://"
                : !ctaComplete
                  ? "A button needs both a label and a link."
                  : "Adds a button to the email — link to an event, a form or your website."}
            </p>
          </fieldset>

          {/* Design */}
          <fieldset>
            <legend className="text-[13px] font-semibold text-slate-700">Design</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {EMAIL_THEMES.map((t) => {
                const active = theme === t.value;
                return (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${
                      active
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="email-theme"
                      value={t.value}
                      checked={active}
                      onChange={() => setTheme(t.value)}
                      className="h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                    />
                    {t.label}
                  </label>
                );
              })}
            </div>
            {themeHint && <p className="mt-1.5 text-xs text-slate-500">{themeHint}</p>}
          </fieldset>

          {/* Live preview */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-500" aria-hidden />
              <h3 className="text-[13px] font-semibold text-slate-700">Preview</h3>
              {renderBusy && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />
              )}
              <span className="ml-auto text-xs text-slate-400">
                Exactly what lands in their inbox
              </span>
            </div>
            <div className="mt-3">
              {renderError ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {renderError}
                </p>
              ) : !hasDraftContent ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                  Write a title and a message — the email builds itself here as you type.
                </p>
              ) : (
                <EmailPreview html={html} loading={renderBusy} />
              )}
            </div>
          </div>

          {/* Audience */}
          <fieldset>
            <legend className="text-[13px] font-semibold text-slate-700">Audience</legend>
            <div className="mt-2 flex flex-col gap-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const active = audienceType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150 ${
                      active
                        ? "border-indigo-300 bg-indigo-50/60"
                        : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={opt.value}
                      checked={active}
                      onChange={() => setAudienceType(opt.value)}
                      className="mt-1 h-4 w-4 cursor-pointer accent-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.hint}</p>
                      {active && opt.value === "status" && (
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          aria-label="Choose a status"
                          className={`${selectClass} mt-2.5`}
                        >
                          <option value="">Choose a status…</option>
                          {(options?.statuses ?? []).map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label} ({s.count})
                            </option>
                          ))}
                        </select>
                      )}
                      {active && opt.value === "tag" && (
                        <select
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          aria-label="Choose a tag"
                          className={`${selectClass} mt-2.5`}
                          disabled={!options?.tags.length}
                        >
                          <option value="">
                            {options && !options.tags.length ? "No tags in use yet" : "Choose a tag…"}
                          </option>
                          {(options?.tags ?? []).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                      {active && opt.value === "group" && (
                        <select
                          value={group ?? ""}
                          onChange={(e) => setGroup(e.target.value)}
                          aria-label="Choose a group"
                          className={`${selectClass} mt-2.5`}
                          disabled={!options?.groups.length}
                        >
                          <option value="">
                            {options && !options.groups.length ? "No groups yet" : "Choose a group…"}
                          </option>
                          {(options?.groups ?? []).map((g) => (
                            <option key={g._id} value={g._id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Live audience line */}
          <div
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm"
          >
            {previewBusy ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
            ) : (
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
            )}
            <div className="min-w-0">
              {previewError ? (
                <p className="text-rose-600">{previewError}</p>
              ) : !audiencePayload ? (
                <p className="text-slate-500">Pick an audience to see who will get this.</p>
              ) : preview ? (
                <>
                  <p className="font-medium text-slate-800">
                    Will reach {preview.recipients} {preview.recipients === 1 ? "person" : "people"} ·{" "}
                    {preview.withEmail} {preview.withEmail === 1 ? "has" : "have"} email ·{" "}
                    {preview.withoutEmail} will be skipped
                  </p>
                  {preview.sample.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {preview.sample.join(", ")}
                      {preview.recipients > preview.sample.length
                        ? ` and ${preview.recipients - preview.sample.length} more`
                        : ""}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-slate-500">Counting…</p>
              )}
            </div>
          </div>

          {/* When to send */}
          <fieldset>
            <legend className="text-[13px] font-semibold text-slate-700">When to send</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "now", label: "Send now", hint: "Goes out the moment you confirm." },
                  {
                    value: "later",
                    label: "Schedule for later",
                    hint: "Pick a date and time.",
                  },
                ] as { value: WhenMode; label: string; hint: string }[]
              ).map((opt) => {
                const active = whenMode === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150 ${
                      active
                        ? "border-indigo-300 bg-indigo-50/60"
                        : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="when"
                      value={opt.value}
                      checked={active}
                      onChange={() => {
                        setWhenMode(opt.value);
                        if (opt.value === "later") {
                          readClock();
                          if (!sendAtInput) setSendAtInput(defaultScheduleValue());
                        }
                      }}
                      className="mt-1 h-4 w-4 cursor-pointer accent-indigo-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {whenMode === "later" && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <label
                  htmlFor="composer-send-at"
                  className="text-[13px] font-semibold text-slate-700"
                >
                  Date and time
                </label>
                <input
                  id="composer-send-at"
                  type="datetime-local"
                  value={sendAtInput}
                  min={minAt}
                  onChange={(e) => {
                    readClock();
                    setSendAtInput(e.target.value);
                  }}
                  className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 sm:w-72"
                />
                {schedulePast ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    That time has already passed — pick a moment in the future.
                  </p>
                ) : scheduleDate ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                    <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    <span>
                      <b className="font-semibold text-slate-800">
                        Sends {describeSendTime(scheduleDate)}, your local time.
                      </b>{" "}
                      Scheduled mail goes out within five minutes of that time.
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Choose when it should go out.</p>
                )}
              </div>
            )}
          </fieldset>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs text-slate-500">People without an email address are skipped.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setSaveTemplateOpen(true)}
                disabled={!title.trim() && !body.trim()}
              >
                <Bookmark className="h-4 w-4" aria-hidden />
                Save as template
              </Button>
              <Button
                variant="secondary"
                onClick={() => save("draft")}
                disabled={!canDraft || scheduleNeedsPrimary}
              >
                <Save className="h-4 w-4" aria-hidden />
                {editing ? "Save without sending" : "Save as draft"}
              </Button>
              <Button
                onClick={() => setConfirming(whenMode === "later" ? "schedule" : "send")}
                disabled={!canSubmit}
              >
                {whenMode === "later" ? (
                  <CalendarClock className="h-4 w-4" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                {editing ? "Update" : whenMode === "later" ? "Schedule" : "Send now"}
              </Button>
              {scheduleNeedsPrimary && (
                <p className="basis-full text-right text-xs text-slate-500">
                  Press {editing ? "Update" : "Schedule"} to schedule this for the
                  time you picked — saving without sending would drop it.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={requestTemplate}
      />

      <SaveTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        draft={{ title, body, ctaLabel, ctaUrl }}
        onSaved={() => setSaveTemplateOpen(false)}
      />

      <ConfirmDialog
        open={confirming === "replace"}
        onClose={() => {
          setConfirming(null);
          setPendingTemplate(null);
        }}
        onConfirm={() => applyTemplate(pendingTemplate?.template ?? null)}
        title={pendingTemplate?.template ? "Replace what you've written?" : "Clear the composer?"}
        confirmLabel={pendingTemplate?.template ? "Replace" : "Clear"}
        message={
          pendingTemplate?.template
            ? `The "${pendingTemplate.template.name}" template will overwrite the title, message and button you have here.`
            : "The title, message and button you have here will be cleared."
        }
      />

      <ConfirmDialog
        open={confirming === "send"}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={() => save("send")}
        loading={busy}
        title="Send this announcement?"
        confirmLabel="Send now"
        message={
          preview
            ? `"${title.trim()}" will be emailed to ${audienceText}. ${preview.withoutEmail} without an email address will be skipped. This can't be undone.`
            : `"${title.trim()}" will be emailed to everyone in the chosen audience. This can't be undone.`
        }
      />

      <ConfirmDialog
        open={confirming === "schedule"}
        onClose={() => !busy && setConfirming(null)}
        onConfirm={() => save("schedule")}
        loading={busy}
        title="Schedule this announcement?"
        confirmLabel="Schedule"
        message={`"${title.trim()}" will be emailed to ${audienceText} on ${
          scheduleDate ? describeSendTime(scheduleDate) : "the time you picked"
        }, your local time. You can edit or cancel it until then.`}
      />
    </section>
  );
}
