import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileBadge,
  HandHeart,
  HardDrive,
  HeartHandshake,
  ListMusic,
  Megaphone,
  MonitorDown,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "ChurchOS — Church management, all in one place",
  description:
    "People, giving, attendance, groups, events, services and more — connected apps that run your whole church from one beautiful place.",
};

const apps = [
  { icon: Users, name: "People", desc: "Members, visitors, households, milestones", accent: "from-indigo-500 to-violet-600" },
  { icon: HeartHandshake, name: "Connect", desc: "Visitor cards and follow-up that never drops anyone", accent: "from-pink-500 to-rose-600" },
  { icon: HandHeart, name: "Giving", desc: "Funds, receipts, pledges, annual statements", accent: "from-emerald-500 to-teal-600" },
  { icon: UserCheck, name: "Attendance", desc: "Headcounts, per-person marking, kids check-in", accent: "from-amber-500 to-orange-600" },
  { icon: UsersRound, name: "Groups", desc: "Small groups, ministries and teams", accent: "from-sky-500 to-indigo-600" },
  { icon: CalendarDays, name: "Events", desc: "Public registration links, capacity, check-in", accent: "from-violet-500 to-purple-600" },
  { icon: ListMusic, name: "Services", desc: "Order of service and volunteer scheduling", accent: "from-cyan-500 to-sky-600" },
  { icon: Megaphone, name: "Announcements", desc: "Email everyone, members, a tag or a group", accent: "from-fuchsia-500 to-violet-600" },
  { icon: FileBadge, name: "Certificates", desc: "Baptism, dedication, marriage, membership", accent: "from-slate-600 to-slate-800" },
  { icon: HardDrive, name: "Drive", desc: "Church documents in folders, previewed in-app", accent: "from-blue-400 to-indigo-600" },
  { icon: BarChart3, name: "Analytics", desc: "The whole church at a glance, every Monday", accent: "from-teal-500 to-emerald-600" },
];

function StatPill({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${tint}`}>{value}</p>
    </div>
  );
}

/** A hand-built, non-interactive preview of the Analytics dashboard. */
function DashboardMock() {
  const bars = [
    ["Jan", 62], ["Feb", 70], ["Mar", 66], ["Apr", 84], ["May", 78], ["Jun", 90],
  ] as const;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-indigo-600/10">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-xs font-medium text-slate-400">churchos.app/dashboard/analytics</span>
      </div>
      <div className="bg-[#f6f7fb] p-4">
        <div className="grid grid-cols-4 gap-2">
          <StatPill label="People" value="1,248" tint="text-slate-900" />
          <StatPill label="Sunday avg" value="612" tint="text-amber-600" />
          <StatPill label="Giving MTD" value="₹4.8L" tint="text-emerald-600" />
          <StatPill label="New visitors" value="19" tint="text-rose-600" />
        </div>
        <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Sunday attendance, last six months
          </p>
          <div className="mt-2 flex h-20 items-end gap-2">
            {bars.map(([label, h]) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-500"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-white">
      <PublicNav signedIn={Boolean(session)} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_60%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Eleven apps, one people record
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Run your whole church from{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                one place
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              People, giving, attendance, groups, events, service planning,
              certificates — connected apps that share one member record. Add a
              visitor once; every app knows them forever.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={session ? "/dashboard" : "/signup"}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                {session ? "Open dashboard" : "Start free"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-600"
              >
                Talk to us
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["No per-member pricing", "Works on any phone", "Your data, exportable anytime"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* Apps grid */}
      <section id="apps" className="border-t border-slate-100 bg-[#f6f7fb] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Every app your office needs
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Each one is simple on its own. Together they replace the spreadsheets,
            WhatsApp groups and paper registers.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map(({ icon: Icon, name, desc, accent }) => (
              <div
                key={name}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-600/10"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-bold text-slate-900">{name}</h3>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section id="features" className="py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3">
          {[
            {
              icon: Users,
              title: "One record for a person's whole journey",
              body:
                "A visitor card becomes a profile in one click. Every gift, service attended, group joined and certificate issued stacks onto the same record — the story of someone's life in your church.",
            },
            {
              icon: HandHeart,
              title: "Giving that reconciles itself",
              body:
                "Record tithes and offerings by fund with auto-numbered receipts. Pledges track themselves. Year-end statements print for every giver in one go.",
            },
            {
              icon: ShieldCheck,
              title: "Safe by default",
              body:
                "Kids check-in with security codes, a full audit trail of who changed what, a recycle bin for anything deleted, and every church's data isolated from every other.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                <Icon className="h-5 w-5 text-indigo-600" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-[#f6f7fb] py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <MonitorDown className="mx-auto h-8 w-8 text-indigo-600" aria-hidden />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Set up in an afternoon
          </h2>
          <p className="mt-3 text-slate-600">
            Create your church, add your people, put a QR code at the door — and
            install ChurchOS as an app on any device.
          </p>
          <Link
            href={session ? "/dashboard" : "/signup"}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            {session ? "Open dashboard" : "Create your church"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
