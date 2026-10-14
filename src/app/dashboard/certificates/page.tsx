"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Check,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate, formatDateTime, toDateInput } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import {
  CERTIFICATE_DESCRIPTIONS,
  CERTIFICATE_LABELS,
  CERTIFICATE_TYPES,
  DEFAULT_VERSES,
  MILESTONE_FIELDS,
  TYPE_PILL_STYLES,
  type CertificateDto,
  type CertificateListResponse,
  type CertificateType,
  type ChurchInfo,
} from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

/** The milestone fields we read off a fetched Person to prefill the form. */
type PersonDetail = PickedPerson & {
  baptismDate?: string | null;
  baptismPlace?: string;
  dedicationDate?: string | null;
  marriageDate?: string | null;
  memberSince?: string | null;
  confirmationDate?: string | null;
};

const emptyForm = {
  type: "baptism" as CertificateType,
  fatherName: "",
  motherName: "",
  eventDate: "",
  place: "",
  officiant: "",
  witnesses: "",
  verse: DEFAULT_VERSES.baptism,
  remark: "",
};

const DEFAULT_VERSE_SET = new Set<string>(Object.values(DEFAULT_VERSES));

export default function CertificatesPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [certificates, setCertificates] = useState<CertificateDto[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [spouse, setSpouse] = useState<PickedPerson | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<CertificateDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (typeFilter) params.set("type", typeFilter);
    return api<CertificateListResponse>(`/api/certificates?${params}`)
      .then((data) => {
        setCertificates(data.certificates);
        setCounts(data.counts);
        setTotal(data.total);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setCertificates([]);
        setLoadError(
          err instanceof Error ? err.message : "Could not load certificates."
        );
      });
  }, [debouncedQ, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => {
        setChurch(d.church);
        // Seed the officiant if the modal was opened before settings arrived
        setForm((f) =>
          f.officiant ? f : { ...f, officiant: d.church.pastorName ?? "" }
        );
      })
      .catch(() => {
        /* officiant simply isn't prefilled */
      });
  }, []);

  /** Pull the person's own milestone into the date/place fields. */
  const applyPersonPrefill = useCallback(
    (detail: PersonDetail | null, type: CertificateType) => {
      if (!detail) return;
      const field = MILESTONE_FIELDS[type];
      const milestone = field ? detail[field] : null;
      setForm((f) => ({
        ...f,
        eventDate: milestone ? toDateInput(milestone) : f.eventDate,
        place:
          type === "baptism" && !f.place && detail.baptismPlace
            ? detail.baptismPlace
            : f.place,
      }));
    },
    []
  );

  const fetchPersonDetail = useCallback(async (id: string) => {
    const data = await api<{ person: PersonDetail }>(`/api/certificates/person/${id}`);
    return data.person;
  }, []);

  function openModal(preselected?: PersonDetail | null) {
    setForm({ ...emptyForm, officiant: church?.pastorName ?? "" });
    setPerson(preselected ?? null);
    setSpouse(null);
    setModalOpen(true);
    if (preselected) applyPersonPrefill(preselected, emptyForm.type);
  }

  // The People profile links here with ?person=<id> — preselect and open.
  const presetPersonId = searchParams.get("person") ?? "";
  useEffect(() => {
    if (!presetPersonId || !/^[a-f0-9]{24}$/i.test(presetPersonId)) return;
    let cancelled = false;
    fetchPersonDetail(presetPersonId)
      .then((detail) => {
        if (cancelled) return;
        setForm({ ...emptyForm, officiant: church?.pastorName ?? "" });
        setPerson(detail);
        setSpouse(null);
        setModalOpen(true);
        applyPersonPrefill(detail, emptyForm.type);
      })
      .catch(() => {
        /* the link pointed at a person who no longer exists */
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the URL changes; church merely seeds the officiant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPersonId, fetchPersonDetail, applyPersonPrefill]);

  const set =
    (key: keyof typeof emptyForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function changeType(type: CertificateType) {
    setForm((f) => ({
      ...f,
      type,
      // Keep a hand-written verse; swap a default one for the new default.
      verse: !f.verse.trim() || DEFAULT_VERSE_SET.has(f.verse) ? DEFAULT_VERSES[type] : f.verse,
    }));
    if (type !== "marriage") setSpouse(null);
    applyPersonPrefill(person, type);
  }

  async function onPickPerson(picked: PickedPerson | null) {
    if (!picked) {
      setPerson(null);
      return;
    }
    setPerson(picked);
    try {
      const detail = await fetchPersonDetail(picked._id);
      setPerson(detail);
      applyPersonPrefill(detail, form.type);
    } catch {
      /* fall back to what the picker gave us */
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) {
      toast.error("Please choose a person.");
      return;
    }
    if (form.type === "marriage" && !spouse) {
      toast.error("Please choose the spouse.");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ certificate: CertificateDto }>("/api/certificates", {
        method: "POST",
        json: {
          ...form,
          person: person._id,
          spouse: spouse?._id ?? "",
        },
      });
      toast.success(
        `${data.certificate.serialNo} issued for ${data.certificate.data.personName}.`
      );
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue certificate.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/certificates/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.serialNo} — it's in the Recycle Bin.`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = Boolean(debouncedQ || typeFilter);

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Certificates
          </h1>
          <p className="mt-1.5 text-slate-500">
            Baptism, dedication, marriage, membership, confirmation and
            appreciation — {total ?? "…"} issued so far. Each one is frozen
            at issue and prints exactly the same forever.
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" aria-hidden />
          Issue certificate
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Per-type tiles */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {CERTIFICATE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter((t) => (t === type ? "" : type))}
            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
              typeFilter === type
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-200 bg-white hover:border-indigo-200"
            }`}
          >
            <p className="text-lg font-bold text-slate-900">
              {total === null ? "…" : (counts[type] ?? 0)}
            </p>
            <p className="truncate text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {CERTIFICATE_LABELS[type]}
            </p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or serial no…"
            aria-label="Search certificates"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
          className={selectClass}
        >
          <option value="">All types</option>
          {CERTIFICATE_TYPES.map((type) => (
            <option key={type} value={type}>
              {CERTIFICATE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Serial</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Person</th>
                <th className="px-4 py-3.5">Event date</th>
                <th className="px-4 py-3.5">Issued</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates === null &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {certificates?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <Award className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">
                        {filtered
                          ? "No certificates match your filters"
                          : "No certificates issued yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Issue one from here, or from the Milestones card on a
                        person&apos;s profile.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {certificates?.map((c) => (
                <tr
                  key={c._id}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                    {c.serialNo}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TYPE_PILL_STYLES[c.type]}`}
                    >
                      {CERTIFICATE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.data.personName} />
                      <div className="min-w-0">
                        {c.person ? (
                          <Link
                            href={`/dashboard/people/${c.person}`}
                            className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600"
                          >
                            {c.data.personName}
                          </Link>
                        ) : (
                          <p className="font-semibold text-slate-900">
                            {c.data.personName}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          {c.data.memberNo}
                          {c.type === "marriage" && c.data.spouseName
                            ? ` · with ${c.data.spouseName}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {formatDate(c.data.eventDate)}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-700">{formatDateTime(c.issuedAt)}</p>
                    <p className="text-xs text-slate-400">{c.issuedBy || ""}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/dashboard/certificates/${c._id}/print`}
                        aria-label={`Print ${c.serialNo}`}
                        className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Printer className="h-4 w-4" />
                      </Link>
                      <button
                        aria-label={`Delete ${c.serialNo}`}
                        onClick={() => setDeleting(c)}
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
        {certificates && certificates.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            Showing {certificates.length}{" "}
            {certificates.length === 1 ? "certificate" : "certificates"}
          </div>
        )}
      </div>

      {/* Issue modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Issue a certificate"
        subtitle="Details are frozen at issue — reissue rather than edit."
        wide
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset>
            <legend className="text-[13px] font-semibold text-slate-700">
              Certificate type
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CERTIFICATE_TYPES.map((type) => {
                const active = form.type === type;
                return (
                  <label
                    key={type}
                    className={`relative cursor-pointer rounded-xl border px-3 py-2.5 transition-colors duration-150 ${
                      active
                        ? "border-indigo-400 bg-indigo-50 ring-4 ring-indigo-500/10"
                        : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type}
                      checked={active}
                      onChange={() => changeType(type)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {CERTIFICATE_LABELS[type]}
                      </span>
                      {active && (
                        <Check className="h-4 w-4 text-indigo-600" aria-hidden />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                      {CERTIFICATE_DESCRIPTIONS[type]}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">
              Person<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <PersonPicker value={person} onChange={onPickPerson} />
          </div>

          {form.type === "marriage" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-700">
                Spouse<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <PersonPicker
                value={spouse}
                onChange={setSpouse}
                placeholder="Search for the spouse…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Father's name"
              value={form.fatherName}
              onChange={set("fatherName")}
              placeholder={form.type === "dedication" ? "Printed on the certificate" : ""}
            />
            <TextField
              label="Mother's name"
              value={form.motherName}
              onChange={set("motherName")}
              placeholder={form.type === "dedication" ? "Printed on the certificate" : ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={
                form.type === "appreciation"
                  ? "Date"
                  : `${CERTIFICATE_LABELS[form.type]} date`
              }
              type="date"
              required={form.type !== "appreciation"}
              value={form.eventDate}
              onChange={set("eventDate")}
              hint={
                form.type === "appreciation"
                  ? "Defaults to today."
                  : "Prefilled from the person's record when known."
              }
            />
            <TextField
              label="Place"
              value={form.place}
              onChange={set("place")}
              placeholder={church?.name ?? "Church / venue"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Officiant"
              value={form.officiant}
              onChange={set("officiant")}
              placeholder="Pastor / minister"
            />
            <TextField
              label="Witnesses"
              value={form.witnesses}
              onChange={set("witnesses")}
              placeholder="Names, comma-separated"
            />
          </div>

          <TextAreaField
            label="Scripture"
            value={form.verse}
            onChange={set("verse")}
            hint="Printed in italics under the wording. Edit freely."
          />

          <TextAreaField
            label="Remark"
            value={form.remark}
            onChange={set("remark")}
            placeholder={
              form.type === "appreciation"
                ? "e.g. ten years of faithful service in the choir"
                : "Optional — printed as a small note"
            }
            hint={
              form.type === "appreciation"
                ? "Completes the sentence “is honoured for faithful service — …”"
                : undefined
            }
          />

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              <Award className="h-4 w-4" aria-hidden />
              Issue certificate
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this certificate?"
        message={`${deleting?.serialNo} (${deleting ? CERTIFICATE_LABELS[deleting.type] : ""} — ${deleting?.data.personName}) will move to the Recycle Bin. The person's milestone date stays on their record.`}
      />
    </div>
  );
}
