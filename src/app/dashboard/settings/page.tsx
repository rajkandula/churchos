"use client";

import Link from "next/link";
import { ArrowLeft, Church, Copy, Globe, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload";
import { CURRENCY_OPTIONS } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

type ChurchInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  code: string;
  denomination: string;
  pastorName: string;
  website: string;
  currency: string;
};

/** Mirrors normalizeChurchCode on the server, so the preview shows exactly what
 *  will be saved. The server stays the authority — this is only a preview. */
function toLinkName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Copy to the clipboard; false when the browser refuses (insecure context). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const toast = useToast();
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  // The link name as it is actually stored — the public links below must show
  // what works today, not what is being typed above.
  const [savedCode, setSavedCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => {
        setChurch(d.church);
        setSavedCode(d.church.code);
        setOrigin(window.location.origin);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not load settings.")
      );
  }, [toast]);

  async function onLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, "logos");
      // Save it straight away rather than waiting for the Save button —
      // otherwise navigating away loses a logo the owner already chose.
      const d = await api<{ church: ChurchInfo }>("/api/settings/church", {
        method: "PATCH",
        json: { logoUrl: url },
      });
      setChurch((s) => (s ? { ...s, logoUrl: d.church.logoUrl } : s));
      toast.success("Logo saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    setUploadingLogo(true);
    try {
      await api<{ church: ChurchInfo }>("/api/settings/church", {
        method: "PATCH",
        json: { logoUrl: "" },
      });
      setChurch((s) => (s ? { ...s, logoUrl: "" } : s));
      toast.success("Logo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  const setField =
    (key: keyof ChurchInfo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setChurch((s) => (s ? { ...s, [key]: e.target.value } : s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!church) return;
    setSaving(true);
    try {
      const d = await api<{ church: ChurchInfo }>("/api/settings/church", {
        method: "PUT",
        json: church,
      });
      setChurch(d.church);
      setSavedCode(d.church.code);
      toast.success("Church settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const linkName = toLinkName(church?.code ?? "");
  const linkChanged = church !== null && linkName !== savedCode;
  const connectUrl = savedCode ? `${origin}/connect/${savedCode}` : "";

  async function copyUrl(url: string, label: string) {
    if (!url) {
      toast.error("Your public link name isn't ready yet — try again in a moment.");
      return;
    }
    if (await copyText(url)) toast.success(`${label} link copied.`);
    else toast.error("Couldn't copy — select the link and copy it by hand.");
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        Church settings
      </h1>
      <p className="mt-1.5 text-slate-500">
        One place for church-wide configuration — every app reads from here.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,36rem)_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <Church className="h-5 w-5 text-indigo-600" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Church information</h2>
              <p className="text-xs text-slate-500">
                Shown on the dashboard, receipts, certificates and emails
              </p>
            </div>
          </div>

          {church === null ? (
            <div className="mt-6 space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <form onSubmit={save} className="mt-6 space-y-4" noValidate>
              <div className="flex items-center gap-4">
                {church.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={church.logoUrl}
                    alt="Church logo"
                    className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-1"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-300">
                    <Church className="h-7 w-7" aria-hidden />
                  </span>
                )}
                <div className="flex flex-col items-start gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {church.logoUrl ? "Change logo" : "Upload logo"}
                  </Button>
                  <p className="text-xs text-slate-500">
                    Printed on receipts, statements and certificates.
                    {church.logoUrl ? (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="ml-1.5 cursor-pointer font-semibold text-rose-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoPicked}
                />
              </div>
              <TextField
                label="Church name"
                required
                value={church.name}
                onChange={setField("name")}
                placeholder="e.g. Grace Community Church"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Denomination"
                  value={church.denomination}
                  onChange={setField("denomination")}
                  placeholder="e.g. Pentecostal, CSI, Baptist"
                />
                <TextField
                  label="Senior pastor"
                  value={church.pastorName}
                  onChange={setField("pastorName")}
                  placeholder="Signs certificates"
                />
              </div>
              <div>
                <label
                  htmlFor="church-address"
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                >
                  Address
                </label>
                <textarea
                  id="church-address"
                  rows={2}
                  value={church.address}
                  onChange={setField("address")}
                  placeholder="Street, area, city, state, PIN"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Phone"
                  value={church.phone}
                  onChange={setField("phone")}
                  placeholder="Church office number"
                />
                <TextField
                  label="Email"
                  type="email"
                  value={church.email}
                  onChange={setField("email")}
                  placeholder="office@church.org"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Website"
                  value={church.website}
                  onChange={setField("website")}
                  placeholder="https://"
                />
                <SelectField
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={church.currency}
                  onChange={setField("currency")}
                  hint="Used for every amount in Giving."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="church-link-name"
                  className="text-[13px] font-semibold text-slate-700"
                >
                  Public link name
                </label>
                <div className="flex items-stretch rounded-xl border border-slate-200 bg-white transition-shadow duration-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <span className="flex max-w-[45%] shrink-0 items-center rounded-l-xl border-r border-slate-200 bg-slate-50 px-3 select-none">
                    <span className="truncate font-mono text-xs text-slate-500">
                      {origin}/connect/
                    </span>
                  </span>
                  <input
                    id="church-link-name"
                    value={church.code}
                    onChange={setField("code")}
                    placeholder="grace-community-church"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-10 w-full min-w-0 flex-1 rounded-r-xl bg-transparent px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 outline-none"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  The last part of your public web links. Letters, numbers and
                  hyphens.
                </p>
                {linkChanged ? (
                  <p className="text-xs text-slate-500">
                    Will become{" "}
                    <span className="font-mono text-indigo-600">
                      {origin}/connect/{linkName || "…"}
                    </span>
                    . Old links keep working after you save.
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" loading={saving}>
                  <Save className="h-4 w-4" aria-hidden />
                  Save settings
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <Globe className="h-5 w-5 text-indigo-600" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Public links</h2>
              <p className="text-xs text-slate-500">
                Pages anyone can open — no login needed
              </p>
            </div>
          </div>
          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="font-semibold text-slate-800">Connect card</dt>
              <dd className="mt-1.5 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-indigo-600">
                  {connectUrl || "…"}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 shrink-0 px-3"
                  onClick={() => copyUrl(connectUrl, "Connect card")}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy
                </Button>
              </dd>
              <dd className="mt-1.5 text-xs text-slate-500">
                Put this on a QR code at the door — visitors fill it in on their
                phone and land in the Connect app.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">Event registration</dt>
              <dd className="mt-1.5 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                {origin}/register/{savedCode || "…"}/<span className="italic">event</span>
              </dd>
              <dd className="mt-1.5 text-xs text-slate-500">
                Each event carries its own event code at the end —
                copy it from that event in the Events app.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
