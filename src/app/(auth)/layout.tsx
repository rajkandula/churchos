import { redirect } from "next/navigation";
import { HandHeart, HeartHandshake, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { BrandMark } from "@/components/BrandMark";

const highlights = [
  {
    icon: Users,
    title: "Every person in one place",
    text: "Members, visitors, households and milestones — searchable in seconds.",
  },
  {
    icon: HandHeart,
    title: "Giving that reconciles itself",
    text: "Funds, receipts, pledges and year-end statements without the spreadsheet.",
  },
  {
    icon: HeartHandshake,
    title: "Nobody slips through",
    text: "Visitor cards, follow-up, groups and attendance all feed the same record.",
  },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only bounce signed-in visitors when their account still exists —
  // a stale cookie for a deleted user would otherwise loop login ↔ dashboard.
  const session = await getSession();
  if (session) {
    let exists = false;
    try {
      exists = Boolean(
        await withDbRetry(() => User.findById(session.id).select("_id").lean())
      );
    } catch {
      exists = false;
    }
    if (exists) redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-1">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-105 w-105 rounded-full bg-violet-400/20 blur-3xl"
        />

        <BrandMark dark size="lg" />

        <div className="relative animate-fade-up">
          <h1 className="max-w-md text-4xl leading-tight font-bold text-white">
            Everything your church needs, in one place.
          </h1>
          <ul className="mt-10 space-y-6">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-indigo-100" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-indigo-200">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-indigo-300">
          © {new Date().getFullYear()} ChurchOS
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-105 animate-fade-up">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
