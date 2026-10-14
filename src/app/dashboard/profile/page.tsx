"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, ShieldAlert, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/components/ui/Toast";

type Profile = {
  name: string;
  username: string;
  email: string;
  createdAt?: string;
};

export default function ProfilePage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sent here straight after signing in with a temporary password
  const cameFromLogin = searchParams.get("setPassword") === "1";

  const [profile, setProfile] = useState<Profile | null>(null);
  // The account's own flag, from the server — so the banner survives a
  // reload, a bookmark and a direct visit, not just the login redirect.
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    api<{ profile: Profile; mustChangePassword?: boolean }>("/api/auth/profile")
      .then((d) => {
        setProfile(d.profile);
        setMustChangePassword(d.mustChangePassword === true);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Could not load your profile."
        )
      );
  }, []);

  // Until the profile loads, the login redirect is the only thing we know
  const showPasswordBanner = mustChangePassword || (cameFromLogin && !profile);

  const setField =
    (key: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setProfile((p) => (p ? { ...p, [key]: e.target.value } : p));

  const setPw =
    (key: keyof typeof passwords) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setPasswords((p) => ({ ...p, [key]: e.target.value }));

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", json: profile });
      toast.success("Profile updated.");
      router.refresh(); // navbar + greeting pick up the new session claims
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setChanging(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        json: passwords,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      // The temporary password is gone: drop the banner and the query flag
      // without a reload, and let the apps unlock.
      setMustChangePassword(false);
      toast.success("Password changed.");
      if (cameFromLogin) router.replace("/dashboard/profile");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change your password."
      );
    } finally {
      setChanging(false);
    }
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
        My profile
      </h1>
      <p className="mt-1.5 text-slate-500">
        Your personal account details. Church information lives in{" "}
        <Link
          href="/dashboard/settings"
          className="font-medium text-indigo-600 hover:underline"
        >
          Church settings
        </Link>
        .
      </p>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile details */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <UserRound className="h-5 w-5 text-indigo-600" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Profile details</h2>
              <p className="text-xs text-slate-500">
                Name and sign-in identifiers
              </p>
            </div>
          </div>

          {profile === null && !loadError ? (
            <div className="mt-6 space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : profile ? (
            <form onSubmit={saveProfile} className="mt-6 space-y-4" noValidate>
              <TextField
                label="Full name"
                required
                value={profile.name}
                onChange={setField("name")}
              />
              <TextField
                label="Username"
                required
                value={profile.username}
                onChange={setField("username")}
                hint="Lowercase letters, numbers, dots and underscores."
              />
              <TextField
                label="Email"
                type="email"
                required
                value={profile.email}
                onChange={setField("email")}
              />
              <div className="flex justify-end pt-1">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          ) : null}
        </section>

        {/* Change password */}
        <div className="space-y-4">
        {showPasswordBanner && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 animate-fade-in"
          >
            <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" aria-hidden />
            <p>
              <span className="font-semibold">Set your own password</span> — the one you
              signed in with was temporary. The apps stay locked until you choose a new one.
            </p>
          </div>
        )}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <KeyRound className="h-5 w-5 text-indigo-600" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Change password</h2>
              <p className="text-xs text-slate-500">
                Use at least 8 characters
              </p>
            </div>
          </div>

          <form onSubmit={changePassword} className="mt-6 space-y-4" noValidate>
            <PasswordInput
              label="Current password"
              required
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={setPw("currentPassword")}
            />
            <PasswordInput
              label="New password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={passwords.newPassword}
              onChange={setPw("newPassword")}
            />
            <PasswordInput
              label="Confirm new password"
              required
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={passwords.confirmPassword}
              onChange={setPw("confirmPassword")}
            />
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={changing}>
                Change password
              </Button>
            </div>
          </form>
        </section>
        </div>
      </div>
    </div>
  );
}
