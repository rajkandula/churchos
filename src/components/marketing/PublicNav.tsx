import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function PublicNav({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="transition-opacity duration-200 hover:opacity-80">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/#apps" className="transition-colors duration-200 hover:text-indigo-600">
            Apps
          </Link>
          <Link href="/#features" className="transition-colors duration-200 hover:text-indigo-600">
            Features
          </Link>
          <Link href="/contact" className="transition-colors duration-200 hover:text-indigo-600">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors duration-200 hover:bg-indigo-700"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors duration-200 hover:bg-indigo-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
