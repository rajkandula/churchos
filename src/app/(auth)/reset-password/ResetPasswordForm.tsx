"use client";

import Link from "next/link";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/PasswordInput";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/reset", {
        method: "POST",
        json: { token, password, confirmPassword },
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reset your password."
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <ShieldCheck className="h-7 w-7 text-emerald-600" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Password updated
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          Your password has been changed. Sign in with your new password to
          continue.
        </p>
        <Link href="/login" className="mt-8 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Pick something strong — at least 8 characters.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 animate-fade-in"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <PasswordInput
          label="New password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          label="Confirm new password"
          required
          autoComplete="new-password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}
