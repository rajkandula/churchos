import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
          <CircleAlert className="h-7 w-7 text-rose-600" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Invalid reset link
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          This link is missing its reset code. Please use the link from your
          email, or request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-block text-sm font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
