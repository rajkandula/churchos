"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Suspense, useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordInput } from "@/components/PasswordInput";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary — this page is prerendered.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Set when a guard bounced the visitor here — their cookie was revoked by
  // a password change, an admin reset, or the account being disabled.
  const expired = searchParams.get("expired") === "1";
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { status, mustChangePassword } = await api<{
        status: string;
        mustChangePassword?: boolean;
      }>("/api/auth/login", {
        method: "POST",
        json: { identifier, password },
      });
      // A temporary password (set by the church admin) must be replaced first
      router.push(
        status !== "approved"
          ? "/pending"
          : mustChangePassword
            ? "/dashboard/profile?setPassword=1"
            : "/dashboard"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Sign in to your church&apos;s workspace.
      </p>

      {expired && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 animate-fade-in"
        >
          You were signed out because your password changed or your account was
          updated. Please sign in again.
        </div>
      )}

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

        <TextField
          label="Username or email"
          required
          autoComplete="username"
          placeholder="e.g. samuel.thomas or you@yourchurch.org"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <div className="space-y-2">
          <PasswordInput
            label="Password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[13px] font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
